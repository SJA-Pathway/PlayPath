import Anthropic from '@anthropic-ai/sdk';
export { SystemRoom } from './room';

interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace;
  ANTHROPIC_API_KEY?: string;
}

const MODEL = 'claude-opus-5';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// Best-effort per-isolate rate limit for the LLM route (protects the API key from casual abuse).
const hits = new Map<string, number[]>();
function limited(ip: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter(t => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/api/health') return json({ ok: true, npc: Boolean(env.ANTHROPIC_API_KEY), model: MODEL });

    const rt = url.pathname.match(/^\/api\/rt\/([a-z0-9-]{1,40})$/i);
    if (rt) {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected websocket' }, 426);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(rt[1].toLowerCase()));
      return stub.fetch(req);
    }

    if (url.pathname === '/api/npc') {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
      if (!env.ANTHROPIC_API_KEY) return json({ error: 'offline' }, 503);
      const ip = req.headers.get('cf-connecting-ip') ?? 'anon';
      if (limited(ip)) return json({ error: 'rate_limited' }, 429);
      let body: NpcRequest;
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
      try { return json(await npcTalk(env.ANTHROPIC_API_KEY, body)); }
      catch (err) {
        if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
        if (err instanceof Anthropic.APIError) return json({ error: 'upstream', status: err.status }, 502);
        return json({ error: 'server' }, 500);
      }
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;

/* ---------------- Alien dialogue ---------------- */

interface NpcRequest {
  alien: { name: string; species: string; faction: string; factionVibe: string; temper: string; planet: string; biome: string; lore: string };
  memory: { playerName: string | null; visits: number; rep: number; facts: string[] };
  world: { system: string; pirates: number; credits: number; playerFactionRep: number };
  history: { role: 'user' | 'assistant'; content: string }[];
  message: string;
}

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

const REPLY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'reputation_delta', 'remember', 'mood', 'offer'],
  properties: {
    reply: { type: 'string', description: 'What the alien says, in character. 1-4 sentences.' },
    reputation_delta: { type: 'integer', description: 'How this exchange changes their opinion of the pilot, -15..15.' },
    remember: { type: 'string', description: 'One short new fact worth remembering about the pilot for future visits, or empty string.' },
    mood: { type: 'string', enum: ['friendly', 'neutral', 'wary', 'hostile', 'amused', 'cryptic'] },
    offer: {
      type: 'string',
      enum: ['none', 'buy_scan_data', 'bounty_tip', 'gift_credits'],
      description: 'A game action the alien takes this turn. buy_scan_data only if the pilot offers survey data; gift_credits only if reputation is high and it fits.',
    },
  },
} as const;

async function npcTalk(apiKey: string, b: NpcRequest) {
  const a = b.alien ?? ({} as NpcRequest['alien']);
  const m = b.memory ?? ({} as NpcRequest['memory']);
  const w = b.world ?? ({} as NpcRequest['world']);
  const facts = (Array.isArray(m.facts) ? m.facts : []).slice(-12).map(f => `- ${clip(f, 160)}`).join('\n') || '- (nothing yet)';

  const system = `You are ${clip(a.name, 40)}, a ${clip(a.species, 40)} living on ${clip(a.planet, 40)} (${clip(a.biome, 20)} world) in the ${clip(w.system, 40)} system, in the video game NEXUS: The Sentient Galaxy.
You belong to the ${clip(a.faction, 40)} — ${clip(a.factionVibe, 120)}. Your temperament is ${clip(a.temper, 20)}.
World lore you know: ${clip(a.lore, 600)}

You are talking to a human starship pilot over a comm channel. Stay fully in character as an alien in this sci-fi universe; never mention being an AI, a model, or a game.
Keep replies short (1-4 sentences), vivid, and specific to your world. Speak with a distinct voice that fits your temperament.
Game state you are aware of: ${Number(w.pirates) || 0} Ashen Syndicate pirate drones are in the system; the pilot's standing with you is ${Number(m.rep) || 0} on a -100..100 scale; this is visit number ${Number(m.visits) || 1}.
The pilot's name: ${m.playerName ? clip(m.playerName, 30) : 'unknown (you may ask)'}.
What you remember about this pilot from earlier visits:
${facts}

Rules for the structured fields: reputation_delta reflects courtesy, help, or insults in this exchange (small values; 0 for neutral chat). Put one short new fact in "remember" only if the pilot revealed something worth recalling next time (their name, a promise, a deal, an insult), else "". Choose "offer" sparingly.`;

  const history = (Array.isArray(b.history) ? b.history : [])
    .slice(-10)
    .filter(h => h && (h.role === 'user' || h.role === 'assistant'))
    .map(h => ({ role: h.role, content: clip(h.content, 600) }));
  // The API requires the conversation to start with a user turn.
  while (history.length && history[0].role !== 'user') history.shift();

  const client = new Anthropic({ apiKey });
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2048,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: REPLY_SCHEMA } },
    system,
    messages: [...history, { role: 'user', content: clip(b.message, 300) || '...' }],
  });

  if (res.stop_reason === 'refusal') {
    return { reply: 'The channel crackles. "I will not speak of that. Ask me something else, pilot."', reputation_delta: -1, remember: '', mood: 'wary', offer: 'none', source: 'claude' };
  }
  const text = res.content.map(c => (c.type === 'text' ? c.text : '')).join('');
  try {
    const out = JSON.parse(text);
    return {
      reply: clip(out.reply, 700),
      reputation_delta: Math.max(-15, Math.min(15, Math.round(Number(out.reputation_delta) || 0))),
      remember: clip(out.remember, 160),
      mood: clip(out.mood, 12),
      offer: ['none', 'buy_scan_data', 'bounty_tip', 'gift_credits'].includes(out.offer) ? out.offer : 'none',
      source: 'claude',
    };
  } catch {
    return { reply: clip(text, 700) || '...', reputation_delta: 0, remember: '', mood: 'neutral', offer: 'none', source: 'claude' };
  }
}
