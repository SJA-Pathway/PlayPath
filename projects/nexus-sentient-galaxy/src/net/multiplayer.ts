import * as THREE from 'three';
import { Ship } from '../ships/ship';
import { log } from '../core/log';

/**
 * Live multiplayer over a WebSocket to the Worker's Durable Object room for the current star system.
 * Remote pilots are rendered as ships and smoothly interpolated between 10 Hz snapshots.
 */
interface Remote { ship: Ship; target: THREE.Vector3; targetQ: THREE.Quaternion; speed: number; seen: number }

export class Multiplayer {
  readonly remotes = new Map<string, Remote>();
  status: 'offline' | 'connecting' | 'online' = 'offline';
  private ws: WebSocket | null = null;
  private room = '';
  private sendT = 0;
  private retry = 0;
  private retryTimer = 0;
  onChat: (name: string, text: string) => void = () => {};
  onShot: (p: THREE.Vector3, q: THREE.Quaternion) => void = () => {};

  constructor(private scene: () => THREE.Object3D, public me: { name: string; color: number }) {}

  join(room: string) {
    if (room === this.room && this.ws) return;
    this.leave();
    this.room = room;
    this.connect();
  }

  private connect() {
    if (!this.room) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    let ws: WebSocket;
    try { ws = new WebSocket(`${proto}://${location.host}/api/rt/${encodeURIComponent(this.room)}`); } catch { this.status = 'offline'; return; }
    this.ws = ws;
    this.status = 'connecting';
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', name: this.me.name, color: this.me.color })); };
    ws.onmessage = ev => this.handle(ev.data);
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.status = 'offline';
      this.clearRemotes();
      this.ws = null;
      // back off and retry (Workers-hosted only; the Vite dev server has no /api unless wrangler dev runs)
      if (this.retry < 6) { this.retry++; this.retryTimer = window.setTimeout(() => this.connect(), 1500 * this.retry); }
    };
    ws.onerror = () => { /* close handler does the work */ };
  }

  leave() {
    clearTimeout(this.retryTimer);
    const ws = this.ws;
    this.ws = null;
    this.room = '';
    this.retry = 0;
    if (ws) { ws.onclose = null; try { ws.close(); } catch { /* ignore */ } }
    this.clearRemotes();
    this.status = 'offline';
  }

  private clearRemotes() {
    for (const r of this.remotes.values()) { r.ship.obj.removeFromParent(); r.ship.dispose(); }
    this.remotes.clear();
  }

  private add(id: string, name: string, color: number) {
    if (this.remotes.has(id)) return;
    const ship = new Ship('interceptor', 'remote', color, name);
    this.scene().add(ship.obj);
    this.remotes.set(id, { ship, target: new THREE.Vector3(), targetQ: new THREE.Quaternion(), speed: 0, seen: 0 });
  }

  private handle(raw: string) {
    let m: { t: string; [k: string]: unknown };
    try { m = JSON.parse(raw); } catch { return; }
    switch (m.t) {
      case 'welcome':
        this.status = 'online';
        this.retry = 0;
        for (const p of m.peers as { id: string; name: string; color: number }[]) this.add(p.id, p.name, p.color);
        if (this.remotes.size) log('net', `${this.remotes.size} other pilot${this.remotes.size > 1 ? 's' : ''} in this system.`);
        break;
      case 'join':
        this.add(m.id as string, m.name as string, m.color as number);
        log('net', `${m.name} dropped into the system.`);
        break;
      case 'leave': {
        const r = this.remotes.get(m.id as string);
        if (r) { log('net', `${r.ship.name} jumped out.`); r.ship.obj.removeFromParent(); this.remotes.delete(m.id as string); }
        break;
      }
      case 's': {
        const r = this.remotes.get(m.id as string);
        if (!r) return;
        const p = m.p as number[], q = m.q as number[];
        if (r.seen === 0) { r.ship.pos.set(p[0], p[1], p[2]); r.ship.quat.set(q[0], q[1], q[2], q[3]); }
        r.target.set(p[0], p[1], p[2]);
        r.targetQ.set(q[0], q[1], q[2], q[3]);
        r.speed = m.v as number;
        r.seen = performance.now();
        break;
      }
      case 'chat':
        this.onChat(m.name as string, m.text as string);
        break;
      case 'fx': {
        const r = this.remotes.get(m.id as string);
        if (r && m.k === 'laser') this.onShot(r.ship.pos.clone(), r.ship.quat.clone());
        break;
      }
    }
  }

  update(dt: number, me: Ship) {
    for (const r of this.remotes.values()) {
      const k = 1 - Math.exp(-dt * 8);
      r.ship.pos.lerp(r.target, k);
      r.ship.quat.slerp(r.targetQ, k);
      r.ship.vel.set(0, 0, -r.speed).applyQuaternion(r.ship.quat);
      r.ship.ctl.throttle = r.speed / r.ship.stats.maxSpeed;
      // engines glow from the remote's speed
      r.ship.ctl.assist = true;
    }
    if (this.status !== 'online' || !this.ws) return;
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 0.1;
      const p = me.pos, q = me.quat;
      this.ws.send(JSON.stringify({ t: 's', p: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], q: [+q.x.toFixed(4), +q.y.toFixed(4), +q.z.toFixed(4), +q.w.toFixed(4)], v: Math.round(me.speed) }));
    }
  }

  shot() { if (this.status === 'online') this.ws?.send(JSON.stringify({ t: 'fx', k: 'laser', p: [0, 0, 0] })); }
  chat(text: string) { if (this.status === 'online') this.ws?.send(JSON.stringify({ t: 'chat', text })); }
  get count() { return this.remotes.size; }
}
