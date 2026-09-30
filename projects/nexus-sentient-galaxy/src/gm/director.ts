import { bus, log, toast } from '../core/log';
import type { Contract, SaveData } from '../core/save';
import { rng, pick, clamp } from '../core/rng';
import { GALAXY, FACTIONS, planetsFor, lightYears } from '../world/galaxy';

/**
 * The Game Master. It keeps a running "tension" estimate from what the player is going through
 * (damage taken, enemies nearby, kills) and compares it with a target pacing curve that
 * rises and falls over a few minutes. Below the curve it escalates; above it, it gives relief.
 */
export interface DirectorHooks {
  state: () => { hull: number; shield: number; hostiles: number; allies: number; docked: boolean; landed: boolean; danger: number; system: number };
  raid: (size: number, heavy: boolean) => void;
  convoy: () => void;
  derelict: () => void;
  flare: () => void;
  patrol: () => void;
}

type Beat = 'raid' | 'convoy' | 'derelict' | 'flare' | 'patrol' | 'rumor';

export class Director {
  tension = 0;
  private clock = 0;
  private cooldown = 25;
  private lastBeat: Beat | null = null;

  constructor(private save: SaveData, private hooks: DirectorHooks) {
    bus.on('kill', e => {
      this.tension += e.by === 'player' ? 0.08 : 0.03;
      if (e.faction === 'pirate' && e.by === 'player') this.progress('bounty', e.system, 1);
    });
    bus.on('scan', e => this.progress('survey', e.system, 1));
    bus.on('creature', () => this.progress('fauna', -1, 1));
    bus.on('dock', e => this.progress('courier', e.system, 1));
  }

  /** Target tension: a slow wave (≈4 min period) scaled by how dangerous the system is. */
  target() {
    const s = this.hooks.state();
    const wave = 0.5 + 0.5 * Math.sin((this.clock / 240) * Math.PI * 2 - 1.2);
    return clamp(0.15 + wave * (0.35 + s.danger * 0.15), 0, 1);
  }

  hurt(amount: number) { this.tension = Math.min(1.5, this.tension + amount * 0.004); }

  update(dt: number) {
    const s = this.hooks.state();
    this.clock += dt;
    // live tension decays toward what's on screen right now
    const present = clamp(s.hostiles * 0.12 + (1 - s.hull / 100) * 0.4, 0, 1);
    this.tension += (present - this.tension) * (1 - Math.exp(-dt * 0.08));
    if (s.docked || s.landed) return;
    this.cooldown -= dt;
    if (this.cooldown > 0) return;

    const gap = this.target() - this.tension;
    let beat: Beat;
    if (s.hull < 35) beat = pick(Math.random, ['derelict', 'patrol', 'rumor'] as Beat[]);
    else if (gap > 0.15 && s.hostiles < 4) beat = Math.random() < 0.3 && s.danger < 3 ? 'convoy' : 'raid';
    else if (gap < -0.1) beat = pick(Math.random, ['derelict', 'rumor', 'patrol'] as Beat[]);
    else beat = pick(Math.random, ['rumor', 'flare', 'derelict', 'raid'] as Beat[]);
    if (beat === this.lastBeat && beat !== 'raid') beat = 'rumor';
    this.lastBeat = beat;
    this.cooldown = 30 + Math.random() * 30;

    switch (beat) {
      case 'raid': {
        const heavy = s.danger >= 2 && Math.random() < 0.5;
        const size = clamp(1 + s.danger + Math.floor(Math.random() * 2), 1, 5);
        this.hooks.raid(size, heavy);
        log('gm', heavy ? `Game Master: a Syndicate gunship wing drops out of warp, ${size} contacts. They came for you.` : `Game Master: ${size} pirate drone${size > 1 ? 's' : ''} inbound. Tension rising.`, true);
        break;
      }
      case 'convoy':
        this.hooks.convoy();
        log('gm', 'Game Master: a Concord freighter is running the lane under escort. Pirates are shadowing it. Protect it for a reward.', true);
        break;
      case 'derelict':
        this.hooks.derelict();
        log('gm', 'Game Master: a distress beacon ahead. A derelict cargo pod, still intact. Fly through it to salvage.', true);
        break;
      case 'flare':
        this.hooks.flare();
        log('gm', `Game Master: stellar flare from ${GALAXY[s.system].name}. Shields are overloaded.`, true);
        break;
      case 'patrol':
        this.hooks.patrol();
        log('gm', 'Game Master: a Veyl Concord patrol has arrived. They will engage any pirates nearby.', true);
        break;
      default: {
        const sys = pick(Math.random, GALAXY);
        const f = FACTIONS[sys.faction];
        const lines = [
          `Rumour on the comm lanes: the ${f.name} is massing ships near ${sys.name}.`,
          `Rumour: a Choir pilgrim claims the star at ${sys.name} is singing out of tune.`,
          `Rumour: Syndicate captains are paying double for Concord transponder codes.`,
          `Rumour: survey teams in ${sys.name} found ruins older than any known species.`,
        ];
        log('gm', pick(Math.random, lines), true);
      }
    }
  }

  /* ---------------- contracts ---------------- */

  offers(systemId: number): Contract[] {
    const r = rng(systemId * 131 + Math.floor(Date.now() / 600000));
    const here = GALAXY[systemId];
    const near = here.links.map(i => GALAXY[i]);
    const out: Contract[] = [];
    const id = () => Math.floor(r() * 1e9).toString(36);
    const dangerous = [here, ...near].filter(s => s.danger >= 1);
    const bs = pick(r, dangerous.length ? dangerous : [here]);
    const n = 3 + Math.floor(r() * 4);
    out.push({ id: id(), kind: 'bounty', title: `Destroy ${n} Syndicate ships in ${bs.name}`, system: bs.id, target: n, progress: 0, reward: 90 + n * 45 + bs.danger * 30, faction: 0, expires: 0 });
    const ss = pick(r, [here, ...near]);
    const unscanned = planetsFor(ss).filter(p => !this.save.scanned[p.id]).length;
    if (unscanned) {
      const k = Math.min(unscanned, 2 + Math.floor(r() * 2));
      out.push({ id: id(), kind: 'survey', title: `Survey ${k} unscanned worlds in ${ss.name}`, system: ss.id, target: k, progress: 0, reward: 70 * k, faction: 2, expires: 0 });
    }
    const dest = pick(r, near.filter(s => s.station).length ? near.filter(s => s.station) : [here]);
    if (dest !== here) out.push({ id: id(), kind: 'courier', title: `Deliver sealed data to ${dest.name} Highport`, system: dest.id, target: 1, progress: 0, reward: Math.round(80 + lightYears(here, dest) * 6), faction: 0, expires: 0 });
    const fk = 2 + Math.floor(r() * 2);
    out.push({ id: id(), kind: 'fauna', title: `Catalogue ${fk} new alien species (any world)`, system: -1, target: fk, progress: 0, reward: 85 * fk, faction: 2, expires: 0 });
    return out.filter(c => !this.save.contracts.some(a => a.title === c.title));
  }

  accept(c: Contract) {
    if (this.save.contracts.length >= 4) { toast('Contract log full (4 max). Finish one first.', 'bad'); return false; }
    this.save.contracts.push({ ...c });
    log('contract', `Accepted: ${c.title}. Reward ${c.reward} cr.`, true);
    return true;
  }

  abandon(id: string) {
    this.save.contracts = this.save.contracts.filter(c => c.id !== id);
  }

  private progress(kind: Contract['kind'], system: number, n: number) {
    for (const c of [...this.save.contracts]) {
      if (c.kind !== kind || (c.system !== -1 && c.system !== system)) continue;
      c.progress = Math.min(c.target, c.progress + n);
      if (c.progress >= c.target) {
        this.save.credits += c.reward;
        this.save.factionRep[c.faction] = clamp(this.save.factionRep[c.faction] + 6, -100, 100);
        this.save.contracts = this.save.contracts.filter(x => x !== c);
        log('contract', `Contract complete: ${c.title}. +${c.reward} cr, ${FACTIONS[c.faction].short} standing up.`, true);
        toast(`Contract complete: +${c.reward} cr`, 'good');
      } else if (kind !== 'courier') {
        toast(`${c.title}: ${c.progress}/${c.target}`);
      }
    }
  }
}
