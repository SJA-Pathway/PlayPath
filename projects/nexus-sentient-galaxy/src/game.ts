import * as THREE from 'three';
import { Renderer } from './render/renderer';
import { Input } from './core/input';
import { loadSave, persist, type SaveData } from './core/save';
import { bus, log, toast } from './core/log';
import { clamp, damp, pick } from './core/rng';
import { Audio } from './audio/audio';
import { GALAXY, BIOME_LABEL, type SystemDef } from './world/galaxy';
import { SystemView, type PlanetBody } from './world/system';
import { Ship, BASE_STATS, type ShipKind } from './ships/ship';
import { Combat, type Obstacle } from './ships/combat';
import { makeBrain, thinkAndAct, type Brain } from './ships/ai';
import { Surface } from './surface/surface';
import { Director } from './gm/director';
import { Multiplayer } from './net/multiplayer';
import { Hud } from './ui/hud';
import { Panels } from './ui/panels';
import { glowTexture } from './render/shaders';

export type Mode = 'menu' | 'space' | 'surface' | 'warp' | 'dead' | 'docked';

const $ = (id: string) => document.getElementById(id)!;
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();

interface Crate { mesh: THREE.Mesh; value: number }
interface Convoy { freighter: Ship; goal: THREE.Vector3; done: boolean }

export class Game {
  readonly save: SaveData = loadSave();
  readonly renderer: Renderer;
  readonly input: Input;
  readonly audio = new Audio();
  readonly space = new THREE.Scene();
  readonly combat: Combat;
  readonly director: Director;
  readonly net: Multiplayer;
  readonly hud: Hud;
  readonly panels: Panels;
  system!: SystemView;
  systemId = 0;
  player: Ship;
  ships: Ship[] = [];
  brains = new Map<Ship, Brain>();
  crates: Crate[] = [];
  convoy: Convoy | null = null;
  surface: Surface | null = null;
  landedOn: PlanetBody | null = null;
  mode: Mode = 'menu';
  throttle = 0;
  target: Ship | null = null;
  lockT = 0;
  locked = false;
  tameProgress = 0;
  massLocked = false;
  private camQ = new THREE.Quaternion();
  private shake = 0;
  private warpT = 0;
  private saveT = 0;
  private rocks: Obstacle[] = [];
  private altWas = false;
  private crateGeo = new THREE.BoxGeometry(4, 4, 4);
  private crateMat = new THREE.MeshStandardMaterial({ color: 0x3a2a10, emissive: new THREE.Color(0xffb547), emissiveIntensity: 1.2 });
  private crateGlow = glowTexture('rgba(255,200,120,1)', 'rgba(255,181,71,0.4)');
  private last = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.player = new Ship('interceptor', 'player', this.save.color, 'You');
    this.applyUpgrades();
    this.player.hull = clamp(this.save.hull, 10, this.player.stats.hull);
    this.space.add(this.player.obj);

    this.combat = new Combat({
      ships: () => this.mode === 'space' ? [this.player, ...this.ships] : [],
      obstacles: (p, r) => this.obstacles(p, r),
      hostile: (a, b) => this.hostile(a, b),
      onHit: (victim, attacker, dmg) => this.onHit(victim, attacker, dmg),
      onKill: (victim, attacker) => this.onKill(victim, attacker),
      onSound: (kind, at, owner) => this.audio.play(kind, at.distanceTo(this.renderer.camera.position), owner === this.player),
    });
    this.space.add(this.combat.group);

    this.director = new Director(this.save, {
      state: () => ({ hull: this.player.hull, shield: this.player.shield, hostiles: this.hostileCount(), allies: this.ships.filter(s => s.team === 'concord').length, docked: this.mode === 'docked', landed: this.mode === 'surface', danger: this.systemDef.danger, system: this.systemId }),
      raid: (n, heavy) => this.spawnRaid(n, heavy),
      convoy: () => this.spawnConvoy(),
      derelict: () => this.spawnCrate(this.player.pos.clone().addScaledVector(this.player.forward(v1), 700).add(v2.randomDirection().multiplyScalar(120)), 80 + Math.floor(Math.random() * 120)),
      flare: () => { this.player.shield = 0; this.ships.forEach(s => (s.shield *= 0.2)); this.shake = 0.6; this.audio.play('alarm'); },
      patrol: () => this.spawnPatrol(),
    });

    this.net = new Multiplayer(() => this.space, { name: this.save.pilot || 'Pilot', color: this.save.color });
    this.net.onChat = (name, text) => log('net', `${name}: ${text}`);
    this.net.onShot = (p, q) => this.combat.ghostBolt(p, q, 'remote');

    this.hud = new Hud(this);
    this.panels = new Panels(this);
    bus.on('log', e => {
      if (!e.codex) return;
      this.save.codex.push({ t: Date.now(), tag: e.tag, text: e.text });
      if (this.save.codex.length > 200) this.save.codex.splice(0, this.save.codex.length - 200);
      persist(this.save);
    });

    this.loadSystem(GALAXY[this.save.system] ? this.save.system : 0, 'spawn');
    this.setupTouch();
    $('chatline').addEventListener('submit', e => {
      e.preventDefault();
      const inp = $('chatlineInput') as HTMLInputElement;
      const text = inp.value.trim();
      if (text) { this.net.chat(text); if (this.net.status !== 'online') log('net', 'No other pilots connected.'); }
      inp.value = '';
      $('chatline').hidden = true;
      inp.blur();
    });
    canvas.addEventListener('click', () => { if (!this.panels.isOpen && (this.mode === 'space' || this.mode === 'surface')) this.input.requestLock(); });
    requestAnimationFrame(t => this.frame(t));
  }

  get systemDef(): SystemDef { return GALAXY[this.systemId]; }

  launch() {
    this.audio.init();
    this.audio.setSystem(this.systemDef.seed, this.systemDef.danger);
    this.net.me = { name: this.save.pilot, color: this.save.color };
    this.player.dispose();
    this.space.remove(this.player.obj);
    const old = this.player;
    this.player = new Ship('interceptor', 'player', this.save.color, this.save.pilot);
    this.player.obj.position.copy(old.pos);
    this.player.obj.quaternion.copy(old.quat);
    this.applyUpgrades();
    this.player.hull = clamp(this.save.hull, 10, this.player.stats.hull);
    this.space.add(this.player.obj);
    this.mode = 'space';
    this.net.join(`sys-${this.systemId}`);
    log('gm', `Welcome, ${this.save.pilot}. The Game Master is watching. Scan a world (C), hail its people (T), or pick a fight.`, true);
    if (!this.save.contracts.length && this.systemDef.station) toast('Tip: dock at the station (E) for contracts and upgrades');
    this.input.requestLock();
  }

  applyUpgrades() {
    const u = this.save.upgrades, st = this.player.stats, base = BASE_STATS.interceptor;
    st.laserDmg = base.laserDmg + u.laser * 3;
    st.shield = base.shield + u.shield * 40;
    st.shieldRegen = base.shieldRegen + u.shield * 3;
    st.maxSpeed = base.maxSpeed * (1 + u.engine * 0.12);
    st.accel = base.accel * (1 + u.engine * 0.12);
    this.player.shield = Math.min(this.player.shield, st.shield);
  }

  /* ---------------- systems ---------------- */

  loadSystem(id: number, how: 'spawn' | 'jump' | 'respawn') {
    if (this.system) { this.space.remove(this.system.group, this.system.sky); this.system.dispose(); }
    for (const s of this.ships) { this.space.remove(s.obj); s.dispose(); }
    this.ships = []; this.brains.clear();
    for (const c of this.crates) this.space.remove(c.mesh);
    this.crates = []; this.convoy = null; this.target = null; this.locked = false;
    this.combat.clear();
    this.systemId = id;
    this.save.system = id;
    this.system = new SystemView(GALAXY[id]);
    this.space.add(this.system.sky, this.system.group);

    // Arrival point: near the station if there is one, otherwise near the first world.
    const host = this.system.station?.host ?? this.system.planets[0];
    const toStar = v1.copy(host.pos).normalize();
    const arrive = host.pos.clone().addScaledVector(toStar, -(host.def.radius * 4 + 260)).add(new THREE.Vector3(0, 40, 0));
    this.player.pos.copy(arrive);
    this.player.obj.lookAt(this.system.station?.pos ?? host.pos);
    this.player.obj.rotateY(Math.PI);
    this.player.vel.set(0, 0, 0);
    this.throttle = how === 'jump' ? 0.5 : 0;
    this.player.vel.copy(this.player.forward(v1)).multiplyScalar(how === 'jump' ? 120 : 0);
    this.camQ.copy(this.player.quat);

    // Local pirates by danger level; Concord patrols in secure space.
    const d = this.systemDef.danger;
    const planets = this.system.planets;
    for (let i = 0; i < d; i++) {
      const p = pick(Math.random, planets);
      this.spawnRaid(1 + Math.floor(Math.random() * 2), d >= 3 && i === 0, p.pos.clone().add(v1.randomDirection().multiplyScalar(p.def.radius * 3 + 200)), false);
    }
    if (this.systemDef.faction === 0 && d <= 1) this.spawnPatrol(false);

    const first = !this.save.visited[id];
    this.save.visited[id] = 1;
    log('nav', first ? `First arrival in ${this.systemDef.name}: ${planets.length} worlds charted${this.systemDef.station ? ', one station' : ''}.` : `Arrived in ${this.systemDef.name}.`, first);
    this.audio.setSystem(this.systemDef.seed, d);
    this.hud.setSystem();
    if (this.mode !== 'menu') this.net.join(`sys-${id}`);
    persist(this.save, true);
  }

  /* ---------------- spawning ---------------- */

  private addAI(kind: ShipKind, team: Ship['team'], at: THREE.Vector3, brain: Partial<Brain> = {}, name = '') {
    const color = team === 'pirate' ? 0x7a2a30 : team === 'concord' ? 0x3a6aa8 : 0xa06a3a;
    const s = new Ship(kind, team, color, name || (team === 'pirate' ? (kind === 'gunship' ? 'Syndicate gunship' : 'Syndicate drone') : team === 'concord' ? 'Concord patrol' : 'Freighter'));
    s.pos.copy(at);
    s.obj.lookAt(this.player.pos);
    s.obj.rotateY(Math.PI);
    this.space.add(s.obj);
    this.ships.push(s);
    this.brains.set(s, makeBrain(at, brain));
    return s;
  }

  spawnRaid(n: number, heavy: boolean, at?: THREE.Vector3, announce = true) {
    const center = at ?? this.player.pos.clone().addScaledVector(this.player.forward(v1), 1100).add(v2.randomDirection().multiplyScalar(300));
    const skill = 0.35 + this.systemDef.danger * 0.15;
    const leader = heavy ? this.addAI('gunship', 'pirate', center, { aggression: 0.9, courage: 0.8, skill }) : null;
    for (let i = 0; i < n; i++) {
      const s = this.addAI('drone', 'pirate', center.clone().add(v1.randomDirection().multiplyScalar(60)), { leader, aggression: 0.7 + Math.random() * 0.3, courage: Math.random() * 0.6, skill: skill + Math.random() * 0.2 });
      if (!at) this.brains.get(s)!.target = this.player;
    }
    if (announce) { this.audio.play('alarm'); this.shake = 0.2; }
  }

  spawnPatrol(announce = true) {
    const at = this.player.pos.clone().addScaledVector(this.player.right(v1), 400).add(v2.set(0, 60, 0));
    const lead = this.addAI('patrol', 'concord', at, { aggression: 0.9, courage: 0.7, skill: 0.7 }, 'Concord leader');
    for (let i = 0; i < 2; i++) this.addAI('patrol', 'concord', at.clone().add(v1.randomDirection().multiplyScalar(50)), { leader: lead, aggression: 0.85, skill: 0.65 });
    if (announce) this.audio.play('dock');
  }

  spawnConvoy() {
    const side = this.player.right(v1).multiplyScalar(900);
    const start = this.player.pos.clone().add(side).addScaledVector(this.player.forward(v2), 600);
    const goal = (this.system.station?.pos ?? this.system.planets[this.system.planets.length - 1].pos).clone();
    const f = this.addAI('freighter', 'convoy', start, { mode: 'travel', goal, aggression: 0 }, 'Concord freighter');
    f.obj.lookAt(goal); f.obj.rotateY(Math.PI);
    for (let i = 0; i < 2; i++) this.addAI('patrol', 'concord', start.clone().add(v1.randomDirection().multiplyScalar(70)), { escort: f, aggression: 0.8, skill: 0.6 }, 'Convoy escort');
    const pirates = start.clone().addScaledVector(this.player.forward(v2), -900);
    for (let i = 0; i < 3 + this.systemDef.danger; i++) { const s = this.addAI('drone', 'pirate', pirates.clone().add(v1.randomDirection().multiplyScalar(80)), { aggression: 1, skill: 0.5 }); this.brains.get(s)!.target = f; }
    this.convoy = { freighter: f, goal, done: false };
  }

  spawnCrate(at: THREE.Vector3, value: number) {
    const mesh = new THREE.Mesh(this.crateGeo, this.crateMat);
    mesh.position.copy(at);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.crateGlow, color: new THREE.Color(0xffb547).multiplyScalar(2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(26);
    mesh.add(halo);
    this.space.add(mesh);
    this.crates.push({ mesh, value });
  }

  /* ---------------- relations & world queries ---------------- */

  hostile(a: Ship, b: Ship): boolean {
    if (a === b || !a.alive || !b.alive) return false;
    const pair = (x: Ship, y: Ship) => {
      if (x.team === 'pirate') return y.team !== 'pirate' && !(y.team === 'player' && this.save.factionRep[1] > 40 && !x.data.provoked);
      if (x.team === 'concord') return y.team === 'pirate' || (y.team === 'player' && (this.save.factionRep[0] < -40 || Boolean(x.data.provoked)));
      if (x.team === 'player') return y.team === 'pirate' || (y.team === 'concord' && (this.save.factionRep[0] < -40 || Boolean(y.data.provoked)));
      return false;
    };
    return pair(a, b) || pair(b, a);
  }

  hostileCount() { return this.ships.filter(s => s.alive && this.hostile(s, this.player)).length; }

  obstacles(p: THREE.Vector3, r: number): Obstacle[] {
    const out: Obstacle[] = [];
    if (p.length() < this.system.starRadius + r + 20) out.push({ p: new THREE.Vector3(), r: this.system.starRadius });
    for (const pl of this.system.planets) if (pl.pos.distanceTo(p) < pl.def.radius + r + 20) out.push({ p: pl.pos, r: pl.def.radius });
    if (this.system.station && this.system.station.pos.distanceTo(p) < 60 + r) out.push({ p: this.system.station.pos, r: 38 });
    return out.concat(this.system.beltRocksNear(p, r, this.rocks));
  }

  private avoid(p: THREE.Vector3, out: THREE.Vector3) {
    for (const pl of this.system.planets) {
      const d = pl.pos.distanceTo(p);
      if (d < pl.def.radius + 140) { out.copy(p).sub(pl.pos).normalize(); return true; }
    }
    if (p.length() < this.system.starRadius + 300) { out.copy(p).normalize(); return true; }
    return false;
  }

  /* ---------------- combat callbacks ---------------- */

  private onHit(victim: Ship, attacker: Ship | null, dmg: number) {
    if (victim === this.player) {
      this.shake = Math.min(1, this.shake + dmg * 0.02);
      this.director.hurt(dmg);
      this.audio.play(this.player.shield > 0 ? 'shieldhit' : 'hullhit');
      const el = $('dmg');
      el.style.opacity = this.player.shield > 0 ? '0.35' : '1';
      setTimeout(() => (el.style.opacity = '0'), 140);
    }
    if (attacker === this.player && victim.team === 'concord' && !victim.data.provoked) {
      victim.data.provoked = true;
      this.save.factionRep[0] = clamp(this.save.factionRep[0] - 8, -100, 100);
      log('combat', 'You fired on a Concord ship. They are returning fire.', true);
    }
  }

  private onKill(victim: Ship, attacker: Ship | null) {
    const byPlayer = attacker === this.player;
    if (victim === this.player) { this.die(attacker); return; }
    victim.obj.visible = false;
    if (this.target === victim) { this.target = null; this.locked = false; }
    bus.emit('kill', { faction: victim.team, system: this.systemId, by: byPlayer ? 'player' : 'ai' });
    if (victim.team === 'pirate') {
      if (byPlayer) {
        const bounty = (victim.kind === 'gunship' ? 140 : 40) + this.systemDef.danger * 15;
        this.save.credits += bounty;
        this.save.kills++;
        this.save.factionRep[0] = clamp(this.save.factionRep[0] + 2, -100, 100);
        this.save.factionRep[1] = clamp(this.save.factionRep[1] - 3, -100, 100);
        log('combat', `${victim.name} destroyed. Bounty +${bounty} cr.`, victim.kind === 'gunship');
        toast(`+${bounty} cr bounty`, 'good');
      }
      if (Math.random() < 0.35) this.spawnCrate(victim.pos.clone(), 30 + Math.floor(Math.random() * 60));
    } else if (victim.team === 'concord' && byPlayer) {
      this.save.factionRep[0] = clamp(this.save.factionRep[0] - 20, -100, 100);
      this.save.factionRep[1] = clamp(this.save.factionRep[1] + 5, -100, 100);
      log('combat', 'You destroyed a Concord ship. The Concord will remember this.', true);
    } else if (victim.team === 'convoy') {
      log('gm', 'The freighter is lost. The Syndicate takes the cargo.', true);
      if (this.convoy) this.convoy.done = true;
    }
    persist(this.save);
  }

  private die(attacker: Ship | null) {
    this.player.obj.visible = false;
    this.mode = 'dead';
    this.input.releaseLock();
    const loss = Math.floor(this.save.credits * 0.1);
    this.save.credits -= loss;
    log('combat', `Your ship was destroyed${attacker ? ` by a ${attacker.name}` : ''}. Insurance cost ${loss} cr.`, true);
    setTimeout(() => this.panels.dead(`Destroyed${attacker ? ` by a ${attacker.name}` : ''}. Salvage drones tow what is left of you to safety. The insurance covered the hull minus ${loss} cr. It does not cover your pride.`), 1400);
  }

  respawn() {
    this.player = this.rebuildPlayer();
    this.save.hull = this.player.stats.hull;
    this.save.missiles = Math.max(this.save.missiles, 3);
    this.mode = 'space';
    this.loadSystem(this.systemId, 'respawn');
  }

  private rebuildPlayer() {
    this.space.remove(this.player.obj);
    this.player.dispose();
    const p = new Ship('interceptor', 'player', this.save.color, this.save.pilot);
    this.player = p;
    this.applyUpgrades();
    p.hull = p.stats.hull;
    p.shield = p.stats.shield;
    this.space.add(p.obj);
    return p;
  }

  /* ---------------- player actions ---------------- */

  private nearestPlanet() {
    let best: PlanetBody | null = null, bd = Infinity;
    for (const p of this.system.planets) { const d = p.pos.distanceTo(this.player.pos) - p.def.radius; if (d < bd) { bd = d; best = p; } }
    return { p: best!, d: bd };
  }

  private scanPlanet() {
    const { p, d } = this.nearestPlanet();
    if (d > p.def.radius * 2 + 260) { toast('No planet in scanner range. Fly closer.'); return; }
    const first = !this.save.scanned[p.def.id];
    if (first) {
      this.save.scanned[p.def.id] = 1;
      this.save.credits += 60;
      log('scan', `Surveyed ${p.def.name}: ${BIOME_LABEL[p.def.biome].toLowerCase()} world, ${p.def.inhabited ? 'inhabited' : 'sparsely settled'}.`, true);
      bus.emit('scan', { planetId: p.def.id, system: this.systemId });
      this.audio.play('chime');
      persist(this.save);
    }
    this.panels.scan(p.def, first);
  }

  private hail() {
    const { p, d } = this.nearestPlanet();
    if (d > p.def.radius * 2 + 400) { toast('Nobody in comms range. Fly closer to a world.'); return; }
    this.panels.comms(p.def);
  }

  private cycleTarget() {
    const cands = this.ships.filter(s => s.alive).map(s => {
      const to = v1.copy(s.pos).sub(this.player.pos);
      const dist = to.length();
      const ang = Math.acos(clamp(to.normalize().dot(this.player.forward(v2)), -1, 1));
      return { s, score: dist * (0.4 + ang) - (this.hostile(s, this.player) ? 5000 : 0) };
    }).sort((a, b) => a.score - b.score).map(x => x.s);
    if (!cands.length) { this.target = null; return; }
    const i = this.target ? cands.indexOf(this.target) : -1;
    this.target = cands[(i + 1) % cands.length];
    this.lockT = 0; this.locked = false;
    this.audio.play('ui');
  }

  dock() {
    const st = this.system.station;
    if (!st) return;
    this.mode = 'docked';
    this.player.vel.set(0, 0, 0);
    this.throttle = 0;
    this.player.shield = this.player.stats.shield;
    this.target = null;
    bus.emit('dock', { system: this.systemId });
    this.audio.play('dock');
    log('nav', `Docked at ${st.name}.`);
    this.panels.station();
  }

  undock() {
    if (this.mode !== 'docked') return;
    const st = this.system.station!;
    this.mode = 'space';
    this.player.pos.copy(st.pos).add(v1.copy(st.pos).sub(st.host.pos).normalize().multiplyScalar(110));
    this.player.obj.lookAt(v2.copy(st.pos).multiplyScalar(2).sub(st.host.pos));
    this.player.obj.rotateY(Math.PI);
    this.player.vel.copy(this.player.forward(v1)).multiplyScalar(60);
    this.throttle = 0.4;
    this.save.hull = this.player.hull;
    persist(this.save, true);
    this.input.requestLock();
  }

  jump(to: number) {
    if (this.massLocked) { toast('Mass-locked: hostiles nearby', 'bad'); return; }
    this.mode = 'warp';
    this.warpT = 0;
    this.throttle = 1;
    this.audio.play('warp');
    log('nav', `FTL drive spooling. Jumping to ${GALAXY[to].name}.`);
    setTimeout(() => $('warp').classList.add('on'), 1500);
    setTimeout(() => {
      this.loadSystem(to, 'jump');
      this.mode = 'space';
      $('warp').classList.remove('on');
      this.input.requestLock();
    }, 2100);
  }

  land() {
    const { p, d } = this.nearestPlanet();
    if (!p.def.landable) { toast(`${p.def.name} is a gas giant. There is nothing to land on.`, 'bad'); return; }
    if (d > p.def.radius * 0.8 + 80) { toast('Get closer to the atmosphere to land.'); return; }
    if (this.hostileCount() && this.ships.some(s => this.hostile(s, this.player) && s.pos.distanceTo(this.player.pos) < 700)) { toast('Hostiles in pursuit. Lose them before landing.', 'bad'); return; }
    this.fadeTo(() => {
      const tamed = new Set(Object.entries(this.save.bestiary).filter(([, b]) => b.tamed).map(([k]) => k));
      this.surface = new Surface(p.def, this.save.species[p.def.id], tamed);
      this.landedOn = p;
      this.space.remove(this.player.obj);
      this.surface.scene.add(this.player.obj);
      const h = this.surface.heightAt(0, 0);
      this.player.pos.set(0, h + 90, 260);
      this.player.quat.identity();
      this.player.vel.set(0, -10, -30);
      this.throttle = 0.25;
      this.camQ.copy(this.player.quat);
      this.mode = 'surface';
      this.renderer.camera.far = 12000;
      this.renderer.camera.updateProjectionMatrix();
      this.audio.setSurface(true);
      log('nav', `Landed on ${p.def.name}.`, !this.save.visited[-1]);
      this.panels.report(p.def, this.surface.notes, this.surface.genes.map(g => ({ name: g.name, diet: g.diet, gen: g.gen })));
    });
  }

  takeOff() {
    const s = this.surface, p = this.landedOn;
    if (!s || !p) return;
    this.fadeTo(() => {
      this.save.species[p.def.id] = s.genes.map(g => ({ ...g }));
      persist(this.save, true);
      s.scene.remove(this.player.obj);
      s.dispose();
      this.surface = null;
      this.landedOn = null;
      this.space.add(this.player.obj);
      const up = v1.copy(p.pos).normalize().multiplyScalar(-1).add(v2.set(0, 0.4, 0)).normalize();
      this.player.pos.copy(p.pos).addScaledVector(up, p.def.radius * 1.3 + 60);
      this.player.obj.lookAt(v2.copy(p.pos).addScaledVector(up, p.def.radius * 5));
      this.player.obj.rotateY(Math.PI);
      this.player.vel.copy(this.player.forward(v1)).multiplyScalar(80);
      this.throttle = 0.5;
      this.camQ.copy(this.player.quat);
      this.renderer.camera.far = 60000;
      this.renderer.camera.updateProjectionMatrix();
      this.mode = 'space';
      this.audio.setSurface(false);
      log('nav', `Left ${p.def.name}'s atmosphere.`);
    });
  }

  private fadeTo(fn: () => void) {
    $('fade').classList.add('on');
    this.input.clearAll();
    setTimeout(() => { fn(); setTimeout(() => $('fade').classList.remove('on'), 80); }, 620);
  }

  contextPrompt(): string {
    if (this.panels.isOpen) return '';
    if (this.mode === 'surface' && this.surface) {
      const near = this.surface.nearestCreature(this.player.pos, 120);
      if (!near) return `<span class="pn">${this.surface.planet.name}</span>Hover near wildlife to scan it · <b>L</b> take off`;
      const key = `${this.surface.planet.id}/${near.c.gene.name}`;
      const known = this.save.bestiary[key];
      const tameable = near.c.gene.diet === 'grazer' && !known?.tamed && near.d < 45;
      return `<span class="pn">${near.c.gene.name}</span>${known ? 'Catalogued' : '<b>C</b> catalogue'}${tameable ? ' · hold <b>E</b> slowly to tame' : ''} · <b>L</b> take off`;
    }
    if (this.mode !== 'space') return '';
    const st = this.system.station;
    if (st && st.pos.distanceTo(this.player.pos) < 220) return `<span class="pn">${st.name}</span>${this.player.speed < 70 ? '<b>E</b> request docking' : 'Slow down to dock'}`;
    const { p, d } = this.nearestPlanet();
    if (d < p.def.radius * 2 + 400) {
      const parts = [];
      if (d < p.def.radius * 2 + 260) parts.push(`<b>C</b> scan${this.save.scanned[p.def.id] ? ' (done)' : ''}`);
      parts.push(`<b>T</b> hail ${p.def.alien.name}`);
      if (p.def.landable && d < p.def.radius * 0.8 + 80) parts.push('<b>L</b> land');
      else if (p.def.landable) parts.push('closer to land');
      return `<span class="pn">${p.def.name} · ${BIOME_LABEL[p.def.biome]}</span>${parts.join(' · ')}`;
    }
    for (const c of this.crates) if (c.mesh.position.distanceTo(this.player.pos) < 300) return '<span class="pn">Cargo pod</span>Fly through it to salvage';
    return '';
  }

  /* ---------------- per-frame ---------------- */

  private frame(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    try { this.step(dt); } catch (err) { console.error(err); }
    const scene = this.mode === 'surface' && this.surface ? this.surface.scene : this.space;
    this.renderer.render(scene, dt);
    this.input.endFrame(dt);
    requestAnimationFrame(t => this.frame(t));
  }

  private step(dt: number) {
    const inp = this.input, p = this.player;
    const open = this.panels.isOpen;
    if (!open && this.mode !== 'menu') this.save.playtime += dt;

    // global keys
    if (!open && this.mode !== 'menu') {
      if (inp.pressed('KeyN')) toast(this.audio.toggleMute() ? 'Audio muted' : 'Audio on');
      if (inp.pressed('KeyK')) this.panels.codex();
      if (inp.pressed('Enter') && this.net.status === 'online') { $('chatline').hidden = false; inp.typing = true; ($('chatlineInput') as HTMLInputElement).focus(); ($('chatlineInput') as HTMLInputElement).onblur = () => { inp.typing = false; $('chatline').hidden = true; }; }
    }

    if (this.mode === 'surface' && this.surface) this.stepSurface(dt, open);
    else this.stepSpace(dt, open);

    // camera
    const cam = this.renderer.camera;
    const q = this.mode === 'dead' ? this.camQ : p.quat;
    this.camQ.slerp(q, damp(this.mode === 'surface' ? 6 : 9, dt));
    const speedK = clamp(p.speed / p.stats.maxSpeed, 0, 3);
    const offset = v1.set(0, 6 + speedK * 0.5, 23 + speedK * 4).applyQuaternion(this.camQ);
    const want = v2.copy(p.pos).add(offset);
    if (this.mode === 'menu') {
      const t = performance.now() / 9000;
      want.copy(p.pos).add(v3.set(Math.cos(t) * 26, 8, Math.sin(t) * 26));
      cam.position.copy(want);
      cam.lookAt(p.pos);
    } else if (this.mode === 'dead') {
      cam.position.lerp(want.add(v3.set(0, 30, 40)), damp(1, dt));
      cam.lookAt(p.pos);
    } else {
      cam.position.copy(want);
      cam.quaternion.copy(this.camQ);
      cam.rotateX(-0.1);
    }
    if (this.shake > 0) {
      cam.position.add(v3.randomDirection().multiplyScalar(this.shake * 1.4));
      this.shake = Math.max(0, this.shake - dt * 1.8);
    }
    const fov = this.mode === 'warp' ? 128 : 68 + (p.ctl.boost ? 14 : 0) + speedK * 3;
    cam.fov += (fov - cam.fov) * damp(this.mode === 'warp' ? 2 : 4, dt);
    cam.updateProjectionMatrix();
    if (this.mode !== 'surface') this.system.sky.position.copy(cam.position);
    else this.surface?.scene.children.forEach(o => { if (o.userData.followCamera) o.position.copy(cam.position); });

    // audio mix
    const threat = this.ships.filter(s => s.alive && this.hostile(s, p) && s.pos.distanceTo(p.pos) < 1200).length;
    this.audio.update(dt, open ? 0 : clamp(threat / 3 + this.director.tension * 0.4, 0, 1), clamp(p.speed / (p.stats.maxSpeed * 2), 0, 1), p.ctl.boost);

    this.hud.update();
    this.saveT -= dt;
    if (this.saveT <= 0 && this.mode !== 'menu') { this.saveT = 10; this.save.hull = p.hull; persist(this.save); }
  }

  private flightInput(dt: number, surface: boolean) {
    const inp = this.input, p = this.player, c = p.ctl;
    const key = (a: string, b: string) => (inp.held(a) ? 1 : 0) - (inp.held(b) ? 1 : 0);
    c.yaw = clamp(-inp.stick.x * 1.4 + key('ArrowLeft', 'ArrowRight'), -1, 1);
    c.pitch = clamp(-inp.stick.y * 1.4 + key('ArrowUp', 'ArrowDown'), -1, 1);
    c.roll = key('KeyQ', 'KeyE') * (surface ? 0.5 : 1);
    if (surface) c.roll = inp.held('KeyQ') ? 1 : 0;
    c.strafeX = key('KeyD', 'KeyA');
    c.strafeY = key('KeyR', 'KeyV');
    c.boost = inp.held('ShiftLeft') || inp.held('ShiftRight');
    if (inp.pressed('KeyZ')) { c.assist = !c.assist; toast(c.assist ? 'Flight assist on' : 'Flight assist off: Newtonian drift', 'info'); }
    if (c.assist) {
      this.throttle = clamp(this.throttle + key('KeyW', 'KeyS') * dt * 0.7, -0.25, 1);
      if (inp.pressed('KeyX')) this.throttle = 0;
      c.throttle = this.throttle;
    } else {
      c.throttle = key('KeyW', 'KeyS');
      this.throttle = Math.max(0, c.throttle);
    }
  }

  private stepSpace(dt: number, open: boolean) {
    const p = this.player, inp = this.input;
    this.system.update(dt);
    const active = this.mode === 'space' && !open;

    if (active) {
      this.flightInput(dt, false);
      if (inp.held('Space') || inp.mouseFire) {
        const fired = this.combat.fireLasers(p, 7 - this.save.upgrades.laser);
        if (fired) this.net.shot();
        if (p.overheated && p.heat >= 99) this.audio.play('overheat');
      }
      if (inp.pressed('KeyF') || (inp.mouseAlt && !this.altWas)) {
        if (this.save.missiles > 0) {
          this.combat.fireMissile(p, this.locked ? this.target : null);
          this.save.missiles--;
          if (!this.locked) toast('Missile fired without lock: dumbfire');
        } else toast('Missile rack empty. Rearm at a station.', 'bad');
      }
      this.altWas = inp.mouseAlt;
      if (inp.pressed('Tab')) this.cycleTarget();
      if (inp.pressed('KeyC')) this.scanPlanet();
      if (inp.pressed('KeyT')) this.hail();
      if (inp.pressed('KeyM')) this.panels.map();
      if (inp.pressed('KeyL')) this.land();
      if (inp.pressed('KeyE')) {
        const st = this.system.station;
        if (st && st.pos.distanceTo(p.pos) < 220) { if (p.speed < 70) this.dock(); else toast('Too fast to dock. Slow below 280 m/s.'); }
      }
    } else if (this.mode === 'warp') {
      p.ctl.throttle = 1; p.ctl.boost = true; p.ctl.pitch = p.ctl.yaw = p.ctl.roll = 0;
      this.warpT += dt;
      p.vel.addScaledVector(p.forward(v1), dt * 1400 * this.warpT);
    } else if (this.mode !== 'docked') {
      p.ctl.fire = false; p.ctl.pitch = p.ctl.yaw = p.ctl.roll = 0; p.ctl.boost = false; p.ctl.throttle = 0;
    }

    if (this.mode !== 'docked' && this.mode !== 'dead' && this.mode !== 'menu') p.update(dt);
    if (this.mode === 'menu') p.update(dt * 0.2);

    // target lock
    const t = this.target;
    if (t && !t.alive) this.target = null;
    if (this.target && active) {
      const to = v1.copy(this.target.pos).sub(p.pos);
      const dist = to.length();
      const ang = Math.acos(clamp(to.normalize().dot(p.forward(v2)), -1, 1));
      if (dist < 1500 && ang < 0.45) {
        const before = this.lockT;
        this.lockT += dt;
        if (!this.locked && Math.floor(this.lockT * 6) !== Math.floor(before * 6)) this.audio.play('lock');
        if (this.lockT > 1.2 && !this.locked) { this.locked = true; this.audio.play('locked'); }
      } else { this.lockT = Math.max(0, this.lockT - dt * 2); if (this.lockT === 0) this.locked = false; }
    }

    // AI
    if (!open || this.mode === 'warp') {
      const world = { ships: [p, ...this.ships], hostile: (a: Ship, b: Ship) => this.hostile(a, b), fire: (s: Ship) => this.combat.fireLasers(s), avoid: (pos: THREE.Vector3, out: THREE.Vector3) => this.avoid(pos, out) };
      for (const s of this.ships) {
        if (!s.alive) continue;
        thinkAndAct(s, this.brains.get(s)!, world, dt);
        s.update(dt);
      }
      this.combat.update(dt);
      this.director.update(dt);
    }
    for (let i = this.ships.length - 1; i >= 0; i--) {
      const s = this.ships[i];
      if (!s.alive) { this.space.remove(s.obj); s.dispose(); this.brains.delete(s); this.ships.splice(i, 1); }
      else if (s.pos.distanceTo(p.pos) > 9000) { this.space.remove(s.obj); this.brains.delete(s); this.ships.splice(i, 1); }
    }

    // convoy resolution
    if (this.convoy && !this.convoy.done) {
      const f = this.convoy.freighter;
      const piratesLeft = this.ships.some(s => s.team === 'pirate' && s.alive && s.pos.distanceTo(f.pos) < 2000);
      if (f.alive && (f.pos.distanceTo(this.convoy.goal) < 300 || !piratesLeft)) {
        this.convoy.done = true;
        if (f.pos.distanceTo(p.pos) < 2500) {
          this.save.credits += 250;
          this.save.factionRep[0] = clamp(this.save.factionRep[0] + 8, -100, 100);
          log('gm', 'The convoy made it through. The Concord transfers 250 cr and remembers who helped.', true);
          toast('Convoy saved: +250 cr', 'good');
        }
      }
    }

    // player collisions: star, planets, station, belt
    if (this.mode === 'space') {
      for (const o of this.obstacles(p.pos, p.stats.radius)) {
        const n = v1.copy(p.pos).sub(o.p);
        const d = n.length(), min = o.r + p.stats.radius;
        if (d >= min) continue;
        n.divideScalar(d || 1);
        p.pos.copy(o.p).addScaledVector(n, min + 0.5);
        const vn = p.vel.dot(n);
        if (vn < 0) {
          p.vel.addScaledVector(n, -vn * 1.6);
          const impact = -vn;
          if (o.r >= this.system.starRadius - 1) this.combatDamage(60);
          else if (impact > 25) this.combatDamage(impact * 0.25);
        }
      }
      // crates
      for (let i = this.crates.length - 1; i >= 0; i--) {
        const c = this.crates[i];
        c.mesh.rotation.x += dt; c.mesh.rotation.y += dt * 0.7;
        if (c.mesh.position.distanceTo(p.pos) < 14) {
          this.save.credits += c.value;
          log('trade', `Salvaged a cargo pod: +${c.value} cr.`);
          toast(`Salvage +${c.value} cr`, 'good');
          this.audio.play('chime');
          this.space.remove(c.mesh);
          this.crates.splice(i, 1);
        }
      }
    }
    this.massLocked = this.ships.some(s => s.alive && this.hostile(s, p) && s.pos.distanceTo(p.pos) < 1000);
    this.net.update(dt, p);
    for (const r of this.net.remotes.values()) r.ship.update(0);
  }

  private combatDamage(n: number) {
    const killed = this.player.damage(n, null);
    this.onHit(this.player, null, n);
    if (killed) { this.combat.explode(this.player.pos.clone(), 10); this.audio.play('bigboom'); this.die(null); }
  }

  private stepSurface(dt: number, open: boolean) {
    const s = this.surface!, p = this.player, inp = this.input;
    const active = !open;
    if (active) {
      this.flightInput(dt, true);
      if (inp.pressed('KeyL')) { this.takeOff(); return; }
      if (inp.pressed('KeyC')) {
        const near = s.nearestCreature(p.pos, 120);
        if (!near) toast('No creature close enough to scan.');
        else {
          const key = `${s.planet.id}/${near.c.gene.name}`;
          if (!this.save.bestiary[key]) {
            this.save.bestiary[key] = { name: near.c.gene.name, planet: s.planet.name, gen: near.c.gene.gen };
            this.save.credits += 45;
            log('fauna', `Catalogued ${near.c.gene.name} on ${s.planet.name} (${near.c.gene.diet}, generation ${near.c.gene.gen}). +45 cr.`, true);
            bus.emit('creature', { species: near.c.gene.name, system: this.systemId });
            this.audio.play('chime');
            persist(this.save);
          } else toast(`${near.c.gene.name}: already catalogued`);
        }
      }
      if (inp.pressed('KeyM') || inp.pressed('KeyT')) toast('Take off first (L).');
      if (inp.held('Space') || inp.mouseFire) { if (inp.pressed('Space')) toast('Weapons are locked inside the atmosphere.'); }
      // taming: hover slowly near an untamed grazer and hold E
      const near = s.nearestCreature(p.pos, 45, c => c.gene.diet === 'grazer' && !c.tamed);
      const key = near ? `${s.planet.id}/${near.c.gene.name}` : '';
      if (near && inp.held('KeyE') && p.speed < 25 && !this.save.bestiary[key]?.tamed) {
        this.tameProgress += dt / 3;
        near.c.state = 'wander';
        if (this.tameProgress >= 1) {
          this.tameProgress = 0;
          near.c.tamed = true;
          this.save.bestiary[key] = { ...(this.save.bestiary[key] ?? { name: near.c.gene.name, planet: s.planet.name, gen: near.c.gene.gen }), tamed: true };
          if (!this.save.bestiary[key].gen) this.save.bestiary[key].gen = near.c.gene.gen;
          log('fauna', `You tamed a ${near.c.gene.name}. It follows your ship now and will greet you on future landings.`, true);
          toast('Creature tamed', 'good');
          this.audio.play('chime');
          persist(this.save);
        }
      } else this.tameProgress = Math.max(0, this.tameProgress - dt);
    } else { p.ctl.throttle = 0; p.ctl.pitch = p.ctl.yaw = p.ctl.roll = 0; }

    // atmospheric flight envelope
    const st = p.stats, base = BASE_STATS.interceptor;
    const maxSpeed = st.maxSpeed, accel = st.accel;
    st.maxSpeed = base.maxSpeed * 0.45; st.accel = base.accel * 0.8;
    p.update(active ? dt : 0);
    st.maxSpeed = maxSpeed; st.accel = accel;
    // gravity + ground
    p.vel.y -= 6 * dt;
    const ground = s.heightAt(p.pos.x, p.pos.z);
    if (p.pos.y < ground + 3.5) {
      const impact = -p.vel.y;
      p.pos.y = ground + 3.5;
      if (p.vel.y < 0) p.vel.y = 0;
      if (impact > 40) this.combatDamage(impact * 0.3);
    }
    const lim = 1950;
    if (Math.abs(p.pos.x) > lim || Math.abs(p.pos.z) > lim) {
      p.pos.x = clamp(p.pos.x, -lim, lim); p.pos.z = clamp(p.pos.z, -lim, lim);
      p.vel.multiplyScalar(0.5);
      toast('Edge of the survey zone');
    }
    if (p.pos.y > ground + 900 && active) { this.takeOff(); return; }
    if (!open) s.update(dt, p.pos, p.speed);
  }

  private setupTouch() {
    if (!this.input.touch) return;
    $('touch').hidden = false;
    this.input.bindJoystick($('joy'), $('joyKnob'));
    document.querySelectorAll<HTMLButtonElement>('#touch [data-k]').forEach(b => {
      const k = b.dataset.k!;
      b.addEventListener('pointerdown', e => { e.preventDefault(); this.input.setTouchKey(k, true); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => this.input.setTouchKey(k, false));
    });
  }
}

