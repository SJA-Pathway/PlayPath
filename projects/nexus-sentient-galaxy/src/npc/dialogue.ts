import type { NpcMemory } from '../core/save';
import { hashString } from '../core/rng';
import { FACTIONS, GALAXY, planetsFor, BIOME_LABEL, type PlanetDef, type SystemDef } from '../world/galaxy';
import { INTENTS, LINES, COLD_PREFIX, WARM_SUFFIX, GOSSIP_GOOD, GOSSIP_BAD, type Intent, type Temper } from './lines';

export interface NpcReply {
  reply: string;
  reputation_delta: number;
  remember: string;
  mood: string;
  offer: 'none' | 'buy_scan_data' | 'bounty_tip' | 'gift_credits';
  source: 'claude' | 'offline';
}

export interface TalkContext { pirates: number; credits: number; scanned: boolean; pilot: string; npc: Record<string, NpcMemory> }

export function freshMemory(): NpcMemory {
  return { playerName: null, visits: 0, rep: 0, facts: [], soldScan: false, gifted: false, history: [], said: [] };
}

/**
 * Optional Claude uplink. The Worker's /api/health reports whether an API key is configured;
 * without one (the default) every conversation runs on the built-in dialogue data below.
 */
let claudeOnline: boolean | null = null;
export async function checkNpcLink(): Promise<boolean> {
  if (claudeOnline !== null) return claudeOnline;
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    claudeOnline = Boolean((await r.json()).npc);
  } catch { claudeOnline = false; }
  return claudeOnline;
}
export const npcLinkStatus = () => claudeOnline;

export async function talk(p: PlanetDef, sys: SystemDef, mem: NpcMemory, message: string, ctx: TalkContext): Promise<NpcReply> {
  if (claudeOnline === true) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      const res = await fetch('/api/npc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          alien: { name: p.alien.name, species: p.alien.species, faction: FACTIONS[p.alien.faction].name, factionVibe: FACTIONS[p.alien.faction].vibe, temper: p.alien.temper, planet: p.name, biome: BIOME_LABEL[p.biome], lore: p.lore },
          memory: { playerName: mem.playerName, visits: mem.visits, rep: mem.rep, facts: mem.facts },
          world: { system: sys.name, pirates: ctx.pirates, credits: ctx.credits, playerFactionRep: 0 },
          history: mem.history.slice(-10),
          message,
        }),
      });
      clearTimeout(timer);
      if (res.ok) return { ...(await res.json()), source: 'claude' } as NpcReply;
      if (res.status === 503) claudeOnline = false;
    } catch { /* fall through to built-in dialogue */ }
  }
  // Small "transmission" delay so replies don't feel instant and robotic.
  await new Promise(r => setTimeout(r, 350 + Math.random() * 500));
  return localReply(p, sys, mem, message, ctx);
}

/* ---------------- built-in dialogue engine ---------------- */

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
/** Facts are stored in the third person; aliens say them back to you in the second person. */
const toYou = (f: string) => f.replace(/^The pilot's/, 'your').replace(/^The pilot /, 'you ').replace(/\.$/, '');

function detect(text: string): Intent {
  for (const [intent, re] of INTENTS) if (re.test(text)) return intent;
  return 'fallback';
}

/** Pick a line for this alien's temperament, avoiding the last few it said. */
function pickLine(intent: Intent, temper: Temper, mem: NpcMemory): string {
  const set = LINES[intent];
  const pool = [...(set[temper] ?? []), ...(set.any ?? [])];
  const said = (mem.said ??= []);
  const fresh = pool.filter(l => !said.includes(hashString(l)));
  const choice = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
  said.push(hashString(choice));
  if (said.length > 10) said.shift();
  return choice;
}

function fill(line: string, slots: Record<string, string>): string {
  return line.replace(/\{(\w+)\}/g, (_, k: string) => slots[k] ?? `{${k}}`);
}

function otherAlien(id: string) {
  const [, sysId, idx] = id.split('-').map(Number);
  const sys = GALAXY[sysId];
  const planet = sys ? planetsFor(sys)[idx] : undefined;
  return planet ? { name: planet.alien.name, planet: planet.name, faction: planet.alien.faction } : null;
}

/** What another alien of the same faction has said about the pilot, if anything. */
function gossip(p: PlanetDef, npc: Record<string, NpcMemory>): string {
  for (const [id, m] of Object.entries(npc)) {
    if (id === p.alien.id || m.visits === 0 || Math.abs(m.rep) < 12) continue;
    const o = otherAlien(id);
    if (!o || o.faction !== p.alien.faction) continue;
    const pool = m.rep > 0 ? GOSSIP_GOOD : GOSSIP_BAD;
    return fill(pool[Math.floor(Math.random() * pool.length)], { other: o.name, otherPlanet: o.planet });
  }
  return '';
}

export function greeting(p: PlanetDef, mem: NpcMemory, npc: Record<string, NpcMemory> = {}): string {
  const temper = p.alien.temper as Temper;
  const addr = mem.playerName ?? 'pilot';
  let s: string;
  if (mem.visits <= 1) s = fill(pickLine('greet', temper, mem), baseSlots(p, addr));
  else {
    s = `You again, ${addr}. Visit number ${mem.visits}.`;
    if (mem.facts.length) s += ` I remember ${toYou(mem.facts[mem.facts.length - 1])}.`;
    if (mem.rep < -25) s += ' I have not forgotten your manners.';
    else if (mem.rep > 30) s += ' It is good to see a friend.';
  }
  const g = gossip(p, npc);
  if (g && Math.random() < 0.6) s += ` ${g}`;
  return s;
}

function baseSlots(p: PlanetDef, addr: string): Record<string, string> {
  const fac = FACTIONS[p.alien.faction];
  const rivals = FACTIONS.filter(f => f !== fac);
  return {
    me: p.alien.name, addr, planet: p.name, biome: BIOME_LABEL[p.biome].toLowerCase(), species: p.alien.species, temper: p.alien.temper,
    aSpecies: `${article(p.alien.species)} ${p.alien.species}`, ASpecies: cap(`${article(p.alien.species)} ${p.alien.species}`),
    aBiome: `${article(BIOME_LABEL[p.biome])} ${BIOME_LABEL[p.biome].toLowerCase()}`,
    faction: fac.name, vibe: fac.vibe, rival: rivals[Math.floor(Math.random() * rivals.length)].name,
    rumorSys: GALAXY[Math.floor(Math.random() * GALAXY.length)].name, lore: p.lore, hazard: p.hazard.toLowerCase(),
  };
}

function localReply(p: PlanetDef, sys: SystemDef, mem: NpcMemory, text: string, ctx: TalkContext): NpcReply {
  const temper = p.alien.temper as Temper;
  const intent = detect(text);
  const out: NpcReply = { reply: '', reputation_delta: 0, remember: '', mood: 'neutral', offer: 'none', source: 'offline' };

  // The name is picked up from anywhere in the message.
  const nm = text.match(/(?:my name is|i am called|i'm called|call me|name's|^i am|^i'm)\s+([A-Za-z][A-Za-z'-]{1,15})/i);
  if (nm && !/^(a|an|the|not|here|fine|good|ok|okay|lost|looking|just)$/i.test(nm[1])) {
    const name = cap(nm[1].toLowerCase());
    mem.playerName = name;
    out.remember = `The pilot's name is ${name}.`;
    out.reputation_delta += 2;
  }
  const addr = mem.playerName ?? 'pilot';
  const slots = { ...baseSlots(p, addr), system: sys.name, pirates: String(ctx.pirates), visits: String(mem.visits), name: addr };

  // Lines that depend on game state are computed here, then dropped into their template slot.
  const pirateLine = p.alien.faction === 1
    ? 'Pirates? I know nothing about that. *static* ...Stay out of the eastern lane.'
    : ctx.pirates
      ? `${ctx.pirates} Syndicate ship${ctx.pirates > 1 ? 's are' : ' is'} in ${sys.name} right now. Thin them out and I will make it worth your while.`
      : 'The lanes are quiet today. It will not last; the Syndicate always comes back.';
  let tradeLine: string;
  if (mem.soldScan) tradeLine = `We already did business, ${addr}. Come back when the markets move.`;
  else if (ctx.scanned) { tradeLine = `Your survey of ${p.name} is useful to us. Forty credits, sent. Pleasure, ${addr}.`; out.offer = 'buy_scan_data'; out.reputation_delta += 3; out.remember = out.remember || 'The pilot sold me survey data.'; }
  else tradeLine = `Scan ${p.name} first. Fresh survey data is worth forty credits to me.`;
  const facts = mem.facts.slice(-3).map(f => cap(toYou(f)) + '.').join(' ');
  const memoryLine = mem.visits > 1
    ? `Of course, ${addr}. This is call number ${mem.visits}.${facts ? ` ${facts}` : ''}`
    : facts ? `We only just met, but I am paying attention. ${facts}` : 'We have only just met. Give me something worth remembering.';
  Object.assign(slots, { pirateLine, tradeLine, memoryLine });

  let line = intent === 'name' && nm ? pickLine('name', temper, mem) : pickLine(intent, temper, mem);
  if (intent === 'name' && !nm) line = pickLine('fallback', temper, mem);
  out.reply = fill(line, slots);

  switch (intent) {
    case 'insult': out.reputation_delta -= 12; out.mood = 'hostile'; out.remember = 'The pilot insulted me.'; break;
    case 'compliment': out.reputation_delta += 4; out.mood = 'friendly'; if (!out.remember) out.remember = `The pilot admired ${p.name}.`; break;
    case 'thanks':
      out.reputation_delta += 3; out.mood = 'friendly';
      if (mem.rep > 35 && !mem.gifted) { out.reply += ' And take this, for fuel. You have been a good friend to us.'; out.offer = 'gift_credits'; }
      break;
    case 'greet': out.reputation_delta += 1; break;
    case 'job': case 'pirates': if (ctx.pirates && p.alien.faction !== 1 && out.offer === 'none') out.offer = 'bounty_tip'; break;
    case 'joke': out.mood = 'amused'; out.reputation_delta += 1; break;
    case 'bye': if (mem.rep > 10) out.reputation_delta += 1; break;
  }

  // Mood colours the delivery.
  const rep = mem.rep + out.reputation_delta;
  if (rep < -30 && intent !== 'insult') { out.reply = COLD_PREFIX[Math.floor(Math.random() * COLD_PREFIX.length)] + out.reply; out.mood = 'wary'; }
  else if (rep > 45 && Math.random() < 0.35 && intent !== 'bye') { out.reply += WARM_SUFFIX[Math.floor(Math.random() * WARM_SUFFIX.length)]; out.mood = 'friendly'; }
  if (intent === 'rumor' || intent === 'remember') {
    const g = gossip(p, ctx.npc);
    if (g) out.reply += ` ${g}`;
  }
  return out;
}
