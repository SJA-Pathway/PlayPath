import * as THREE from 'three';
import { glowTexture } from '../render/shaders';
import { clamp, damp } from '../core/rng';

export type ShipKind = 'interceptor' | 'drone' | 'gunship' | 'patrol' | 'freighter';
export type Team = 'player' | 'pirate' | 'concord' | 'convoy' | 'remote';

export interface ShipStats {
  maxSpeed: number; accel: number; turn: number; hull: number; shield: number; shieldRegen: number;
  laserDmg: number; fireRate: number; radius: number; boost: number;
}

export const BASE_STATS: Record<ShipKind, ShipStats> = {
  interceptor: { maxSpeed: 190, accel: 140, turn: 1.9, hull: 100, shield: 100, shieldRegen: 11, laserDmg: 9, fireRate: 7, radius: 5, boost: 2.6 },
  drone: { maxSpeed: 175, accel: 150, turn: 2.1, hull: 34, shield: 20, shieldRegen: 4, laserDmg: 5, fireRate: 2.2, radius: 5, boost: 1.8 },
  gunship: { maxSpeed: 115, accel: 70, turn: 1.1, hull: 140, shield: 90, shieldRegen: 6, laserDmg: 8, fireRate: 3, radius: 11, boost: 1.5 },
  patrol: { maxSpeed: 180, accel: 130, turn: 1.8, hull: 80, shield: 70, shieldRegen: 8, laserDmg: 7, fireRate: 3, radius: 6, boost: 2 },
  freighter: { maxSpeed: 60, accel: 25, turn: 0.35, hull: 420, shield: 150, shieldRegen: 5, laserDmg: 0, fireRate: 0, radius: 28, boost: 1 },
};

export interface Controls { pitch: number; yaw: number; roll: number; throttle: number; strafeX: number; strafeY: number; boost: boolean; fire: boolean; assist: boolean }

let engineTex: THREE.CanvasTexture | null = null;

let nextId = 1;
export class Ship {
  readonly id = nextId++;
  readonly obj = new THREE.Group();
  readonly body = new THREE.Group();
  readonly vel = new THREE.Vector3();
  stats: ShipStats;
  hull: number;
  shield: number;
  heat = 0;
  overheated = false;
  alive = true;
  gunCd = 0;
  gunSide = 0;
  hitFlash = 0;
  lastHit = 99;
  lastAttacker: Ship | null = null;
  name: string;
  ctl: Controls = { pitch: 0, yaw: 0, roll: 0, throttle: 0, strafeX: 0, strafeY: 0, boost: false, fire: false, assist: true };
  private rates = new THREE.Vector3();
  readonly guns: THREE.Vector3[] = [];
  private engines: THREE.Sprite[] = [];
  /** Arbitrary per-ship data for AI / missions. */
  data: Record<string, unknown> = {};

  constructor(readonly kind: ShipKind, public team: Team, public color: number, name = '') {
    this.stats = { ...BASE_STATS[kind] };
    this.hull = this.stats.hull;
    this.shield = this.stats.shield;
    this.name = name || kind;
    buildModel(this, kind, color);
    this.obj.add(this.body);
  }

  get pos() { return this.obj.position; }
  get quat() { return this.obj.quaternion; }
  forward(out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(this.obj.quaternion); }
  right(out = new THREE.Vector3()) { return out.set(1, 0, 0).applyQuaternion(this.obj.quaternion); }
  up(out = new THREE.Vector3()) { return out.set(0, 1, 0).applyQuaternion(this.obj.quaternion); }
  get speed() { return this.vel.length(); }
  get hullFrac() { return this.hull / this.stats.hull; }

  addGun(x: number, y: number, z: number) { this.guns.push(new THREE.Vector3(x, y, z)); }
  addEngine(x: number, y: number, z: number, size: number, color = 0x7fe7ff) {
    engineTex ??= glowTexture();
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: engineTex, color: new THREE.Color(color).multiplyScalar(1.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.set(x, y, z);
    s.scale.setScalar(size);
    s.userData.base = size;
    this.body.add(s);
    this.engines.push(s);
  }

  /** Integrate controls → motion. Shared by the player, AI and (for extrapolation) remote pilots. */
  update(dt: number) {
    if (!this.alive) return;
    const st = this.stats, c = this.ctl;
    const turn = st.turn * (c.boost ? 0.7 : 1);
    this.rates.x += (c.pitch * turn - this.rates.x) * damp(7, dt);
    this.rates.y += (c.yaw * turn - this.rates.y) * damp(7, dt);
    this.rates.z += (c.roll * turn * 1.4 - this.rates.z) * damp(7, dt);
    this.obj.rotateX(this.rates.x * dt);
    this.obj.rotateY(this.rates.y * dt);
    this.obj.rotateZ(this.rates.z * dt);
    // visual bank into turns
    this.body.rotation.z += (this.rates.y * 0.35 - this.body.rotation.z) * damp(5, dt);

    const fwd = this.forward(tmpA), right = this.right(tmpB), up = this.up(tmpC);
    const boost = c.boost ? st.boost : 1;
    if (c.assist) {
      const want = tmpD.copy(fwd).multiplyScalar(c.throttle * st.maxSpeed * boost)
        .addScaledVector(right, c.strafeX * st.maxSpeed * 0.45)
        .addScaledVector(up, c.strafeY * st.maxSpeed * 0.45);
      const diff = want.sub(this.vel);
      const maxDv = st.accel * (c.boost ? 1.8 : 1) * dt;
      if (diff.length() > maxDv) diff.setLength(maxDv);
      this.vel.add(diff);
    } else {
      // Newtonian: throttle axis is raw thrust; no damping at all
      this.vel.addScaledVector(fwd, c.throttle * st.accel * boost * dt)
        .addScaledVector(right, c.strafeX * st.accel * 0.6 * dt)
        .addScaledVector(up, c.strafeY * st.accel * 0.6 * dt);
      const cap = st.maxSpeed * st.boost * 1.2;
      if (this.vel.length() > cap) this.vel.setLength(cap);
    }
    this.obj.position.addScaledVector(this.vel, dt);

    // shields, heat, cooldowns
    this.lastHit += dt;
    if (this.lastHit > 3) this.shield = Math.min(st.shield, this.shield + st.shieldRegen * dt);
    this.heat = Math.max(0, this.heat - dt * (this.overheated ? 30 : 22));
    if (this.overheated && this.heat < 35) this.overheated = false;
    this.gunCd -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);

    const fwdSpeed = this.vel.dot(fwd);
    const glowK = 0.35 + clamp(fwdSpeed / st.maxSpeed, 0, 2.5) * 0.7 + (c.boost ? 0.6 : 0);
    for (const e of this.engines) {
      e.scale.setScalar(e.userData.base * glowK * (0.92 + Math.random() * 0.16));
    }
  }

  damage(amount: number, from: Ship | null) {
    if (!this.alive) return false;
    this.lastHit = 0;
    this.hitFlash = 1;
    if (from) this.lastAttacker = from;
    const s = Math.min(this.shield, amount);
    this.shield -= s;
    this.hull -= amount - s;
    if (this.hull <= 0) { this.hull = 0; this.alive = false; return true; }
    return false;
  }

  dispose() {
    this.obj.traverse(n => {
      const m = n as THREE.Mesh;
      m.geometry?.dispose();
    });
  }
}

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();

/* ---------------- procedural hull models ---------------- */

const matCache = new Map<string, THREE.Material>();
function mat(key: string, make: () => THREE.Material) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key)!;
}
const std = (color: number, metal = 0.6, rough = 0.38) => mat(`s${color}${metal}${rough}`, () => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough }));
const emissive = (color: number, k = 3) => mat(`e${color}${k}`, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) }));

function buildModel(s: Ship, kind: ShipKind, color: number) {
  const b = s.body;
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); b.add(mesh); return mesh; };
  if (kind === 'interceptor') {
    const nose = new THREE.ConeGeometry(1.1, 6, 6); nose.rotateX(-Math.PI / 2);
    add(nose, std(0x9aa6b4, 0.7, 0.35), 0, 0, -1.2);
    add(new THREE.BoxGeometry(2.4, 1.2, 4.6), std(0x2a3446), 0, 0, 2);
    const wing = new THREE.BoxGeometry(8.4, 0.18, 2.4);
    add(wing, std(color, 0.5, 0.4), 0, -0.2, 2.2);
    for (const x of [-4.1, 4.1]) { add(new THREE.BoxGeometry(0.5, 0.5, 3.4), std(0x9aa6b4, 0.7, 0.35), x, -0.2, 1.4); s.addGun(x, -0.2, -0.6); }
    add(new THREE.BoxGeometry(0.18, 1.6, 2), std(color, 0.5, 0.4), 0, 0.9, 3.4);
    const canopy = add(new THREE.SphereGeometry(0.6, 12, 8), emissive(0x7fe7ff, 0.9), 0, 0.55, -0.4);
    canopy.scale.set(1, 0.6, 2.2);
    s.addEngine(-0.7, 0, 4.5, 1.7); s.addEngine(0.7, 0, 4.5, 1.7);
  } else if (kind === 'drone') {
    add(new THREE.OctahedronGeometry(2.4, 0), std(0x2a1216, 0.7, 0.3));
    const spike = new THREE.ConeGeometry(0.35, 3.4, 4);
    for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const m = add(spike, std(0x5a2a2e), x * 2.4, y * 2.4, 0);
      m.rotation.z = Math.atan2(y, x) - Math.PI / 2;
    }
    add(new THREE.SphereGeometry(0.8, 10, 8), emissive(0xff2d44, 4), 0, 0, -1.8);
    s.addGun(0, 0, -2.6);
    s.addEngine(0, 0, 2.4, 2.6, 0xff5a3a);
  } else if (kind === 'gunship') {
    add(new THREE.BoxGeometry(6, 3.4, 16), std(0x3a2226, 0.6, 0.45));
    add(new THREE.BoxGeometry(16, 1, 5), std(0x2a1a1c), 0, 0, 3);
    for (const x of [-7, 7]) { add(new THREE.CylinderGeometry(1.4, 1.4, 6, 8).rotateX(Math.PI / 2), std(0x5a3a3a), x, 0, 1); s.addGun(x, 0, -2.5); }
    add(new THREE.BoxGeometry(2.4, 1, 3), emissive(0xff4d5e, 3), 0, 1.8, -5);
    s.addEngine(-2, 0, 8.4, 5, 0xff5a3a); s.addEngine(2, 0, 8.4, 5, 0xff5a3a);
  } else if (kind === 'patrol') {
    const nose = new THREE.ConeGeometry(1.4, 7, 4); nose.rotateX(-Math.PI / 2); nose.rotateZ(Math.PI / 4);
    add(nose, std(0xe8eef6, 0.5, 0.3), 0, 0, -1);
    const wing = new THREE.BoxGeometry(2, 0.2, 5);
    for (const x of [-1, 1]) { const w = add(wing, std(0x3a6aa8, 0.5, 0.35), x * 2.4, 0, 2); w.rotation.z = x * 0.5; s.addGun(x * 3.4, -0.4, 0); }
    add(new THREE.BoxGeometry(1.2, 0.3, 1.2), emissive(0x6fb8ff, 3), 0, 0.9, 0);
    s.addEngine(0, 0, 3.4, 3, 0x6fb8ff);
  } else {
    add(new THREE.BoxGeometry(14, 10, 48), std(0x8a8f98, 0.4, 0.6));
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(18, 12, 8), std(i % 2 ? 0xa06a3a : 0x3a6aa8, 0.3, 0.7), 0, 0, -14 + i * 10);
    add(new THREE.BoxGeometry(8, 6, 8), std(0xd8dde4), 0, 7, -22);
    add(new THREE.BoxGeometry(6, 1, 1), emissive(0xffb547, 3), 0, 10.4, -22);
    for (const x of [-5, 5]) s.addEngine(x, 0, 25, 10, 0xffc27a);
  }
}
