import { DurableObject } from 'cloudflare:workers';

/**
 * One room per star system. Pilots in the same system see each other's ships.
 * Uses the WebSocket Hibernation API so idle rooms cost nothing.
 *
 * client → server: {t:'hello', name, color} | {t:'s', p:[x,y,z], q:[x,y,z,w], v} | {t:'chat', text} | {t:'fx', k, p}
 * server → client: {t:'welcome', id, peers} | {t:'join', id, name, color} | {t:'leave', id}
 *                  | {t:'s', id, p, q, v} | {t:'chat', id, name, text} | {t:'fx', id, k, p}
 */
interface Pilot { id: string; name: string; color: number }

const finite = (a: unknown, n: number): a is number[] =>
  Array.isArray(a) && a.length === n && a.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) < 1e6);

export class SystemRoom extends DurableObject {
  async fetch(_req: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const id = crypto.randomUUID().slice(0, 8);
    server.serializeAttachment({ id, name: 'Pilot', color: 0x7fe7ff, hello: false });
    return new Response(null, { status: 101, webSocket: client });
  }

  private pilots(except?: WebSocket) {
    return this.ctx.getWebSockets().filter(ws => ws !== except);
  }

  private broadcast(msg: unknown, except?: WebSocket) {
    const data = JSON.stringify(msg);
    for (const ws of this.pilots(except)) {
      try { ws.send(data); } catch { /* socket closing */ }
    }
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > 1024) return;
    let m: Record<string, unknown>;
    try { m = JSON.parse(raw); } catch { return; }
    const me = ws.deserializeAttachment() as Pilot & { hello: boolean };

    if (m.t === 'hello' && !me.hello) {
      me.name = String(m.name ?? 'Pilot').replace(/[^\w .'-]/g, '').slice(0, 18) || 'Pilot';
      me.color = Number.isInteger(m.color) ? (m.color as number) & 0xffffff : 0x7fe7ff;
      me.hello = true;
      ws.serializeAttachment(me);
      const peers = this.pilots(ws)
        .map(o => o.deserializeAttachment() as Pilot & { hello: boolean })
        .filter(p => p.hello)
        .map(({ id, name, color }) => ({ id, name, color }));
      ws.send(JSON.stringify({ t: 'welcome', id: me.id, peers }));
      this.broadcast({ t: 'join', id: me.id, name: me.name, color: me.color }, ws);
      return;
    }
    if (!me.hello) return;

    if (m.t === 's' && finite(m.p, 3) && finite(m.q, 4)) {
      this.broadcast({ t: 's', id: me.id, p: m.p, q: m.q, v: Number(m.v) || 0 }, ws);
    } else if (m.t === 'chat' && typeof m.text === 'string') {
      const text = m.text.slice(0, 140).trim();
      if (text) this.broadcast({ t: 'chat', id: me.id, name: me.name, text });
    } else if (m.t === 'fx' && typeof m.k === 'string' && finite(m.p, 3)) {
      this.broadcast({ t: 'fx', id: me.id, k: m.k.slice(0, 12), p: m.p }, ws);
    }
  }

  async webSocketClose(ws: WebSocket) {
    const me = ws.deserializeAttachment() as Pilot & { hello: boolean };
    if (me?.hello) this.broadcast({ t: 'leave', id: me.id }, ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }
}
