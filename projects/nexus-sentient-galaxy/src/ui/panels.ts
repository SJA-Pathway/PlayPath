import { GALAXY, FACTIONS, BIOME_LABEL, DANGER, planetsFor, lightYears, type PlanetDef } from '../world/galaxy';
import { persist, wipeSave } from '../core/save';
import { log, toast } from '../core/log';
import { clamp } from '../core/rng';
import { talk, greeting, freshMemory, checkNpcLink, npcLinkStatus } from '../npc/dialogue';
import type { Game } from '../game';
import type { EvolutionNote } from '../surface/surface';
import { esc } from './hud';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const MODALS = ['start', 'scan', 'comms', 'map', 'station', 'codexPanel', 'report', 'dead'] as const;
type ModalId = (typeof MODALS)[number];

const COLORS = [0x7fe7ff, 0xffb547, 0x6cf0b0, 0xff7ab8, 0xc9a0ff, 0xf2f4f8];

export const UPGRADES = {
  laser: { name: 'Pulse laser', desc: '+3 damage per bolt, less heat', costs: [300, 650, 1200] },
  shield: { name: 'Shield capacitor', desc: '+40 shield capacity, faster recharge', costs: [280, 600, 1100] },
  engine: { name: 'Ion engines', desc: '+12% top speed and acceleration', costs: [250, 550, 1000] },
  rack: { name: 'Missile rack', desc: '+3 missile capacity', costs: [200, 450, 900] },
} as const;

export class Panels {
  open: ModalId | null = 'start';
  private talking: PlanetDef | null = null;
  private busy = false;
  private mapSel: number | null = null;
  private stationTab = 'services';
  private codexTab = 'chronicle';
  private color: number;

  constructor(private g: Game) {
    this.color = g.save.color;
    $('scanClose').onclick = () => this.close();
    $('commsClose').onclick = () => this.close();
    $('mapClose').onclick = () => this.close();
    $('codexClose').onclick = () => this.close();
    $('reportClose').onclick = () => this.close();
    $('undockBtn').onclick = () => this.close();
    $('respawnBtn').onclick = () => { this.close(); g.respawn(); };
    $('warpBtn').onclick = () => { if (this.mapSel != null) { const t = this.mapSel; this.close(); g.jump(t); } };
    $('chatForm').addEventListener('submit', e => { e.preventDefault(); void this.send(); });
    $('mapCanvas').addEventListener('click', e => this.mapClick(e));
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.onclick = () => { this.stationTab = b.dataset.tab!; this.renderStation(); });
    document.querySelectorAll<HTMLButtonElement>('[data-ctab]').forEach(b => b.onclick = () => { this.codexTab = b.dataset.ctab!; this.renderCodex(); });
    for (const inp of ['chatInput', 'pilotName', 'chatlineInput']) {
      $(inp).addEventListener('focus', () => { g.input.typing = true; });
      $(inp).addEventListener('blur', () => { g.input.typing = false; });
    }
    // Escape closes panels even while a text field has focus (game input is suspended then).
    addEventListener('keydown', e => {
      if (e.code === 'Escape' && this.open && this.open !== 'start' && this.open !== 'dead') { e.preventDefault(); this.close(); }
    });
    this.setupStart();
    void checkNpcLink();
  }

  get isOpen() { return this.open !== null; }

  show(id: ModalId) {
    for (const m of MODALS) $(m).hidden = m !== id;
    this.open = id;
    this.g.input.releaseLock();
    this.g.input.clearAll();
  }

  close() {
    if (this.open) $(this.open).hidden = true;
    const was = this.open;
    this.open = null;
    this.talking = null;
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.g.input.typing = false;
    if (was === 'station') this.g.undock();
  }

  /* ---------------- start ---------------- */
  private setupStart() {
    const s = this.g.save;
    ($('pilotName') as HTMLInputElement).value = s.pilot;
    const sw = $('swatches');
    for (const c of COLORS) {
      const b = document.createElement('button');
      b.style.background = `#${c.toString(16).padStart(6, '0')}`;
      b.setAttribute('aria-label', `Colour #${c.toString(16)}`);
      b.setAttribute('aria-pressed', String(c === this.color));
      b.onclick = () => { this.color = c; sw.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
      sw.append(b);
    }
    $('saveNote').textContent = s.pilot ? `Welcome back, ${s.pilot}. ${Object.keys(s.visited).length} systems visited, ${s.credits} cr.` : 'Progress saves in this browser.';
    $('launchBtn').onclick = () => {
      const name = ($('pilotName') as HTMLInputElement).value.trim().replace(/[^\w .'-]/g, '').slice(0, 18) || `Pilot-${Math.floor(Math.random() * 900 + 100)}`;
      s.pilot = name; s.color = this.color;
      persist(s, true);
      this.close();
      this.g.launch();
    };
    $('resetBtn').onclick = () => {
      if ($('resetBtn').dataset.confirm) { wipeSave(); location.reload(); return; }
      $('resetBtn').dataset.confirm = '1';
      $('resetBtn').textContent = 'Click again to erase save';
    };
  }

  /* ---------------- scan ---------------- */
  scan(p: PlanetDef, first: boolean) {
    $('scanTitle').textContent = p.name;
    const chips = $('scanChips');
    chips.innerHTML = '';
    const add = (t: string, c = '') => { const s = document.createElement('span'); s.className = `chip ${c}`; s.textContent = t; chips.append(s); };
    add(BIOME_LABEL[p.biome]);
    add(`Radius ${Math.round(p.radius * 110)} km`);
    add(`Hazard: ${p.hazard}`, p.hazard === 'High' || p.hazard === 'Extreme' ? 'red' : 'amber');
    add(FACTIONS[p.alien.faction].name);
    add(p.inhabited ? 'Inhabited' : 'Outposts only', p.inhabited ? 'ok' : '');
    if (p.landable) add('Landable', 'ok');
    $('scanLore').textContent = p.lore;
    $('scanNote').textContent = first ? 'New discovery: +60 cr. Entry written to the Codex.' : 'Already in your Codex.';
    this.show('scan');
  }

  /* ---------------- comms ---------------- */
  comms(p: PlanetDef) {
    const s = this.g.save;
    const mem = (s.npc[p.alien.id] ??= freshMemory());
    mem.visits++;
    this.talking = p;
    $('commsTitle').textContent = `${p.alien.name} of ${p.name}`;
    const chips = $('commsChips');
    chips.innerHTML = '';
    for (const [t, c] of [[p.alien.species, ''], [FACTIONS[p.alien.faction].name, ''], [`Temperament: ${p.alien.temper}`, 'amber'], [`Visit ${mem.visits}`, 'ok']] as const) {
      const e = document.createElement('span'); e.className = `chip ${c}`; e.textContent = t; chips.append(e);
    }
    $('chat').innerHTML = '';
    for (const h of mem.history.slice(-4)) this.say(h.role === 'user' ? 'You (earlier)' : `${p.alien.name} (earlier)`, h.content, h.role === 'user', true);
    this.say(p.alien.name, greeting(p, mem, s.npc));
    this.updateRep(mem.rep);
    const link = npcLinkStatus();
    $('linkTag').textContent = link === true ? 'Claude uplink' : 'Local comms archive';
    $('linkTag').className = `link ${link === true ? 'on' : 'off'}`;
    persist(s);
    this.show('comms');
    setTimeout(() => $('chatInput').focus(), 60);
  }

  private say(who: string, text: string, mine = false, faded = false) {
    const d = document.createElement('div');
    d.className = `msg ${mine ? 'me' : 'them'}`;
    if (faded) d.style.opacity = '0.55';
    const w = document.createElement('span');
    w.className = 'who';
    w.textContent = who;
    d.append(w, text);
    $('chat').append(d);
    $('chat').scrollTop = 1e6;
  }

  private updateRep(rep: number) {
    const f = $('repFill'), v = clamp(rep, -100, 100);
    f.style.left = v >= 0 ? '50%' : `${50 + v / 2}%`;
    f.style.width = `${Math.abs(v) / 2}%`;
    f.style.background = v >= 0 ? 'var(--ok)' : 'var(--danger)';
  }

  private async send() {
    const inp = $('chatInput') as HTMLInputElement;
    const text = inp.value.trim();
    const p = this.talking;
    if (!text || !p || this.busy) return;
    const g = this.g, s = g.save;
    const mem = (s.npc[p.alien.id] ??= freshMemory());
    inp.value = '';
    this.say('You', text, true);
    this.busy = true;
    ($('chatSend') as HTMLButtonElement).disabled = true;
    const typing = document.createElement('div');
    typing.className = 'msg them typing';
    typing.textContent = 'Receiving transmission…';
    $('chat').append(typing);
    $('chat').scrollTop = 1e6;
    try {
      const r = await talk(p, g.systemDef, mem, text, { pirates: g.hostileCount(), credits: s.credits, scanned: Boolean(s.scanned[p.id]), pilot: s.pilot, npc: s.npc });
      typing.remove();
      if (this.talking !== p) return;
      this.say(p.alien.name, r.reply);
      mem.history.push({ role: 'user', content: text }, { role: 'assistant', content: r.reply });
      if (mem.history.length > 16) mem.history.splice(0, mem.history.length - 16);
      mem.rep = clamp(mem.rep + r.reputation_delta, -100, 100);
      s.factionRep[p.alien.faction] = clamp(s.factionRep[p.alien.faction] + Math.round(r.reputation_delta / 3), -100, 100);
      if (r.remember) { mem.facts.push(r.remember); if (mem.facts.length > 12) mem.facts.shift(); }
      const nm = r.remember.match(/name is ([A-Z][\w'-]+)/);
      if (nm) mem.playerName = nm[1];
      if (r.offer === 'buy_scan_data' && s.scanned[p.id] && !mem.soldScan) {
        mem.soldScan = true; s.credits += 40; toast('Sold survey data: +40 cr', 'good'); log('trade', `${p.alien.name} bought your survey of ${p.name}: +40 cr.`, true);
      } else if (r.offer === 'gift_credits' && !mem.gifted && mem.rep > 25) {
        mem.gifted = true; s.credits += 30; toast(`${p.alien.name} sent you 30 cr`, 'good');
      } else if (r.offer === 'bounty_tip') {
        g.director.accept({ id: Math.random().toString(36).slice(2), kind: 'bounty', title: `${p.alien.name}'s bounty: 3 Syndicate ships in ${g.systemDef.name}`, system: g.systemId, target: 3, progress: 0, reward: 220, faction: p.alien.faction === 1 ? 0 : p.alien.faction, expires: 0 });
      }
      if (r.reputation_delta) toast(`${p.alien.name}: standing ${r.reputation_delta > 0 ? '+' : ''}${r.reputation_delta}`, r.reputation_delta > 0 ? 'good' : 'bad');
      this.updateRep(mem.rep);
      $('linkTag').textContent = r.source === 'claude' ? 'Claude uplink' : 'Local comms archive';
      $('linkTag').className = `link ${r.source === 'claude' ? 'on' : 'off'}`;
      persist(s);
    } finally {
      this.busy = false;
      ($('chatSend') as HTMLButtonElement).disabled = false;
      if (this.talking === p) $('chatInput').focus();
    }
  }

  /* ---------------- galaxy map ---------------- */
  map() {
    this.mapSel = null;
    $('warpBtn').setAttribute('disabled', '');
    $('mapHint').textContent = `You are in ${this.g.systemDef.name}`;
    $('mapInfo').textContent = 'Click a system linked to yours by a jump lane. Red rings are pirate-held.';
    this.show('map');
    this.drawMap();
  }

  private drawMap() {
    const c = $<HTMLCanvasElement>('mapCanvas'), ctx = c.getContext('2d')!, W = c.width, H = c.height;
    const cur = this.g.systemDef, s = this.g.save;
    ctx.fillStyle = '#03060d'; ctx.fillRect(0, 0, W, H);
    // faction territory glow
    for (const sys of GALAXY) {
      const gr = ctx.createRadialGradient(sys.x * W, sys.y * H, 0, sys.x * W, sys.y * H, 90);
      gr.addColorStop(0, FACTIONS[sys.faction].css + '22'); gr.addColorStop(1, '#0000');
      ctx.fillStyle = gr; ctx.fillRect(sys.x * W - 90, sys.y * H - 90, 180, 180);
    }
    ctx.lineWidth = 2;
    for (const sys of GALAXY) for (const l of sys.links) if (l > sys.id) {
      const o = GALAXY[l];
      const active = sys.id === cur.id || o.id === cur.id;
      ctx.strokeStyle = active ? 'rgba(127,231,255,.55)' : 'rgba(127,231,255,.12)';
      ctx.beginPath(); ctx.moveTo(sys.x * W, sys.y * H); ctx.lineTo(o.x * W, o.y * H); ctx.stroke();
    }
    for (const sys of GALAXY) {
      const x = sys.x * W, y = sys.y * H;
      if (sys.danger >= 2) { ctx.strokeStyle = sys.danger === 3 ? 'rgba(255,77,94,.8)' : 'rgba(255,77,94,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.stroke(); }
      ctx.fillStyle = `#${sys.star.color.toString(16).padStart(6, '0')}`;
      ctx.beginPath(); ctx.arc(x, y, s.visited[sys.id] ? 8 : 5, 0, 7); ctx.fill();
      if (sys.station) { ctx.fillStyle = '#ffb547'; ctx.fillRect(x + 9, y + 5, 5, 5); }
      if (s.contracts.some(ct => ct.system === sys.id)) { ctx.strokeStyle = '#6cf0b0'; ctx.lineWidth = 2; ctx.strokeRect(x - 12, y - 12, 24, 24); }
      const sel = sys.id === this.mapSel, here = sys.id === cur.id;
      if (sel || here) { ctx.strokeStyle = here ? '#7fe7ff' : '#ffb547'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 24, 0, 7); ctx.stroke(); }
      ctx.font = `${sel || here ? '600 26px' : '20px'} "IBM Plex Mono", monospace`;
      ctx.fillStyle = here ? '#7fe7ff' : sel ? '#ffb547' : 'rgba(214,228,240,.5)';
      ctx.fillText(sys.name, x + 14, y - 12);
    }
    ctx.font = '20px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(214,228,240,.6)';
    FACTIONS.forEach((f, i) => { ctx.fillStyle = f.css; ctx.fillText(`■ ${f.name}`, 24, H - 90 + i * 28); });
  }

  private mapClick(e: MouseEvent) {
    const c = $<HTMLCanvasElement>('mapCanvas'), b = c.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
    let best: number | null = null, bd = 0.04;
    for (const s of GALAXY) { const d = Math.hypot(s.x - x, (s.y - y) * 0.625); if (d < bd) { bd = d; best = s.id; } }
    if (best == null || best === this.g.systemId) return;
    this.mapSel = best;
    const s = GALAXY[best], cur = this.g.systemDef;
    const linked = cur.links.includes(best);
    const planets = planetsFor(s);
    $('mapInfo').textContent = `${s.name} · ${s.star.cls}-class · ${FACTIONS[s.faction].name} · ${DANGER[s.danger]} · ${planets.length} worlds${s.station ? ' · station' : ''} · ${lightYears(cur, s).toFixed(1)} ly${this.g.save.visited[s.id] ? ' · visited' : ''}${linked ? '' : ' · no direct lane'}`;
    const ok = linked && !this.g.massLocked;
    if (ok) $('warpBtn').removeAttribute('disabled'); else $('warpBtn').setAttribute('disabled', '');
    if (linked && this.g.massLocked) $('mapInfo').textContent += ' · mass-locked by hostiles';
    this.drawMap();
  }

  /* ---------------- station ---------------- */
  station() {
    const st = this.g.system.station!;
    $('stationName').textContent = st.name;
    $('stationFaction').textContent = `${FACTIONS[this.g.systemDef.faction].name} station · ${this.g.systemDef.name}`;
    this.stationTab = 'services';
    this.show('station');
    this.renderStation();
  }

  renderStation() {
    const g = this.g, s = g.save, p = g.player;
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === this.stationTab)));
    $('stationCredits').textContent = `${s.credits.toLocaleString()} cr`;
    const body = $('stationBody');
    body.innerHTML = '';
    const item = (t: string, d: string, btn: string, enabled: boolean, fn: () => void) => {
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `<span class="t">${esc(t)}</span><span class="d">${esc(d)}</span>`;
      const b = document.createElement('button');
      b.textContent = btn;
      b.disabled = !enabled;
      b.onclick = () => { fn(); g.audio.play('ui'); persist(s); this.renderStation(); };
      el.append(b);
      body.append(el);
    };
    const rep = s.factionRep[g.systemDef.faction];
    const discount = rep > 30 ? 0.85 : rep < -20 ? 1.3 : 1;
    if (this.stationTab === 'services') {
      const dmg = p.stats.hull - p.hull;
      const repair = Math.ceil(dmg * 1.6 * discount);
      item('Hull repair', dmg > 0 ? `${Math.ceil(dmg)} points of damage` : 'Hull is intact', dmg > 0 ? `${repair} cr` : 'OK', dmg > 0 && s.credits >= repair, () => { s.credits -= repair; p.hull = p.stats.hull; s.hull = p.hull; });
      const cap = 6 + s.upgrades.rack * 3, need = cap - s.missiles, price = Math.ceil(need * 18 * discount);
      item('Rearm missiles', need > 0 ? `${need} missiles to full rack` : 'Rack is full', need > 0 ? `${price} cr` : 'OK', need > 0 && s.credits >= price, () => { s.credits -= price; s.missiles = cap; });
      const repNote = rep > 30 ? 'Your standing earns a 15% discount here.' : rep < -20 ? 'Your poor standing adds a 30% surcharge.' : 'Standard prices.';
      const info = document.createElement('p');
      info.className = 'note';
      info.textContent = `${repNote} Shields are recharged for free while docked.`;
      body.append(info);
    } else if (this.stationTab === 'outfit') {
      for (const key of Object.keys(UPGRADES) as (keyof typeof UPGRADES)[]) {
        const u = UPGRADES[key], lvl = s.upgrades[key];
        const cost = u.costs[lvl] ? Math.ceil(u.costs[lvl] * discount) : 0;
        item(`${u.name} Mk ${lvl + 1}${lvl >= 3 ? ' (max)' : ` → Mk ${lvl + 2}`}`, u.desc, lvl >= 3 ? 'Max' : `${cost} cr`, lvl < 3 && s.credits >= cost, () => {
          s.credits -= cost; s.upgrades[key]++; g.applyUpgrades(); log('trade', `Installed ${u.name} Mk ${s.upgrades[key] + 1}.`, true);
        });
      }
    } else {
      const active = s.contracts;
      const h = document.createElement('h3'); h.textContent = `Active (${active.length}/4)`; body.append(h);
      if (!active.length) { const n = document.createElement('p'); n.className = 'note'; n.textContent = 'No active contracts.'; body.append(n); }
      for (const c of active) item(c.title, `${c.progress}/${c.target} · reward ${c.reward} cr${c.system >= 0 ? ` · ${GALAXY[c.system].name}` : ''}`, 'Abandon', true, () => g.director.abandon(c.id));
      const h2 = document.createElement('h3'); h2.textContent = 'Board'; body.append(h2);
      for (const c of g.director.offers(g.systemId)) item(c.title, `Reward ${c.reward} cr · ${FACTIONS[c.faction].name}`, 'Accept', active.length < 4, () => g.director.accept(c));
    }
  }

  /* ---------------- codex ---------------- */
  codex() { this.codexTab = 'chronicle'; this.show('codexPanel'); this.renderCodex(); }

  private renderCodex() {
    const s = this.g.save, body = $('codexBody');
    document.querySelectorAll<HTMLButtonElement>('[data-ctab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.ctab === this.codexTab)));
    body.innerHTML = '';
    const row = (t: string, d: string) => { const el = document.createElement('div'); el.className = 'item'; el.innerHTML = `<span class="t">${esc(t)}</span><span class="d">${esc(d)}</span>`; body.append(el); };
    const empty = (t: string) => { const p = document.createElement('p'); p.className = 'note'; p.textContent = t; body.append(p); };
    if (this.codexTab === 'chronicle') {
      if (!s.codex.length) empty('Your story has not started yet. The Codex writes itself as you play.');
      for (const e of [...s.codex].reverse().slice(0, 80)) row(e.text, `${new Date(e.t).toLocaleString()} · ${e.tag.toUpperCase()}`);
    } else if (this.codexTab === 'worlds') {
      const ids = Object.keys(s.scanned);
      if (!ids.length) empty('No worlds surveyed yet. Fly close to a planet and press C.');
      for (const id of ids) {
        const [sysId, idx] = id.split(':').map(Number);
        const p = planetsFor(GALAXY[sysId])[idx];
        if (p) row(`${p.name} · ${BIOME_LABEL[p.biome]}`, p.lore);
      }
    } else if (this.codexTab === 'bestiary') {
      const e = Object.entries(s.bestiary);
      if (!e.length) empty('No species catalogued. Land on a world (L) and scan its wildlife (C).');
      for (const [key, b] of e) {
        const gene = s.species[key.split('/')[0]]?.find(x => x.name === b.name);
        row(`${b.name}${b.tamed ? ' · tamed' : ''}`, `${b.planet} · generation ${gene?.gen ?? b.gen}${gene ? ` · ${gene.diet} · size ${gene.size.toFixed(1)} · speed ${gene.speed.toFixed(1)}` : ''}`);
      }
    } else {
      const minutes = Math.round(s.playtime / 60);
      row(s.pilot, `${Object.keys(s.visited).length} systems visited · ${Object.keys(s.scanned).length} worlds surveyed · ${Object.keys(s.bestiary).length} species · ${s.kills} kills · ${minutes} min played`);
      FACTIONS.forEach((f, i) => row(f.name, `Standing ${s.factionRep[i]} · ${f.vibe}`));
      const friends = Object.entries(s.npc).filter(([, m]) => m.visits > 0);
      for (const [id, m] of friends.slice(0, 20)) {
        const [, sysId, idx] = id.split('-').map(Number);
        const p = planetsFor(GALAXY[sysId])[idx];
        if (p) row(`${p.alien.name} (${p.name})`, `Visits ${m.visits} · standing ${m.rep}${m.facts.length ? ` · remembers: ${m.facts.slice(-2).join(' ')}` : ''}`);
      }
    }
  }

  /* ---------------- landing report ---------------- */
  report(planet: PlanetDef, notes: EvolutionNote[], species: { name: string; diet: string; gen: number }[]) {
    $('reportTitle').textContent = `${planet.name} · ${BIOME_LABEL[planet.biome]}`;
    const body = $('reportBody');
    body.innerHTML = '';
    const add = (t: string, d: string) => { const el = document.createElement('div'); el.className = 'item'; el.innerHTML = `<span class="t">${esc(t)}</span><span class="d">${esc(d)}</span>`; body.append(el); };
    if (notes.length) for (const n of notes) add(`Evolution · ${n.species}`, n.text);
    else add('First landing', 'No previous records. These populations will adapt to what happens during your visit; come back to see how they change.');
    for (const s of species) add(s.name, `${s.diet === 'hunter' ? 'Predator' : 'Grazer herd'} · generation ${s.gen}`);
    this.show('report');
  }

  dead(text: string) { $('deadText').textContent = text; this.show('dead'); }
}
