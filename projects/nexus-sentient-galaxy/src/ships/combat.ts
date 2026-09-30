import * as THREE from 'three';
import { glowTexture } from '../render/shaders';
import type { Ship, Team } from './ship';

export interface Obstacle { p: THREE.Vector3; r: number }
export interface CombatHooks {
  ships: () => Ship[];
  obstacles: (p: THREE.Vector3, r: number) => Obstacle[];
  hostile: (a: Ship, b: Ship) => boolean;
  onHit: (victim: Ship, attacker: Ship | null, dmg: number) => void;
  onKill: (victim: Ship, attacker: Ship | null) => void;
  onSound: (kind: 'laser' | 'missile' | 'boom' | 'hit' | 'bigboom', at: THREE.Vector3, owner: Ship | null) => void;
}

const LASER_COLOR: Record<Team, number> = { player: 0x8ff3ff, remote: 0x8fffc8, pirate: 0xff3a4a, concord: 0x6fa8ff, convoy: 0xffc27a };

interface Bolt { mesh: THREE.Mesh; vel: THREE.Vector3; prev: THREE.Vector3; life: number; owner: Ship; dmg: number }
interface Missile { mesh: THREE.Group; vel: THREE.Vector3; target: Ship | null; owner: Ship; life: number; trailT: number }
interface Burst { pts: THREE.Points; v: Float32Array; life: number; max: number }
interface Flash { s: THREE.Sprite; life: number; max: number; size: number }

const seg = new THREE.Line3(), closest = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

export class Combat {
  readonly group = new THREE.Group();
  private bolts: Bolt[] = [];
  private pool: THREE.Mesh[] = [];
  private missiles: Missile[] = [];
  private bursts: Burst[] = [];
  private flashes: Flash[] = [];
  private boltGeo = new THREE.CylinderGeometry(0.22, 0.22, 7, 5).rotateX(Math.PI / 2);
  private boltMats = new Map<number, THREE.MeshBasicMaterial>();
  private glow = glowTexture('rgba(255,255,255,1)', 'rgba(255,200,140,0.45)');

  constructor(private hooks: CombatHooks) {}

  private boltMat(color: number) {
    if (!this.boltMats.has(color)) this.boltMats.set(color, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(5) }));
    return this.boltMats.get(color)!;
  }

  /** Fire one volley from a ship's guns (alternating), respecting fire rate and heat. Returns true if fired. */
  fireLasers(ship: Ship, heatPerShot = 0): boolean {
    if (ship.gunCd > 0 || ship.overheated || !ship.guns.length || ship.stats.fireRate <= 0) return false;
    ship.gunCd = 1 / ship.stats.fireRate;
    const gun = ship.guns[ship.gunSide++ % ship.guns.length];
    const fwd = ship.forward(tmp);
    const mesh = this.pool.pop() ?? new THREE.Mesh(this.boltGeo);
    mesh.material = this.boltMat(LASER_COLOR[ship.team]);
    mesh.position.copy(gun).applyQuaternion(ship.quat).add(ship.pos);
    mesh.quaternion.copy(ship.quat);
    mesh.visible = true;
    this.group.add(mesh);
    const speed = 1100;
    this.bolts.push({ mesh, vel: fwd.clone().multiplyScalar(speed).add(ship.vel), prev: mesh.position.clone(), life: 1.3, owner: ship, dmg: ship.stats.laserDmg });
    if (heatPerShot) { ship.heat += heatPerShot; if (ship.heat >= 100) { ship.heat = 100; ship.overheated = true; } }
    this.hooks.onSound('laser', mesh.position, ship);
    return true;
  }

  /** Visual-only bolt (remote players' shots). */
  ghostBolt(from: THREE.Vector3, q: THREE.Quaternion, team: Team) {
    const mesh = this.pool.pop() ?? new THREE.Mesh(this.boltGeo);
    mesh.material = this.boltMat(LASER_COLOR[team]);
    mesh.position.copy(from);
    mesh.quaternion.copy(q);
    mesh.visible = true;
    this.group.add(mesh);
    const vel = new THREE.Vector3(0, 0, -1).applyQuaternion(q).multiplyScalar(1100);
    this.bolts.push({ mesh, vel, prev: from.clone(), life: 1, owner: null as unknown as Ship, dmg: 0 });
  }

  fireMissile(ship: Ship, target: Ship | null) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.5, roughness: 0.4 }));
    const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: new THREE.Color(0xffa040).multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    flare.position.z = 1.8;
    flare.scale.setScalar(4);
    g.add(body, flare);
    g.position.copy(ship.pos).addScaledVector(ship.up(tmp), -2);
    g.quaternion.copy(ship.quat);
    this.group.add(g);
    this.missiles.push({ mesh: g, vel: ship.vel.clone().addScaledVector(ship.forward(tmp), 60), target, owner: ship, life: 7, trailT: 0 });
    this.hooks.onSound('missile', g.position, ship);
  }

  explode(at: THREE.Vector3, size: number, color = 0xffa050) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: new THREE.Color(color).multiplyScalar(4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.copy(at);
    this.group.add(s);
    this.flashes.push({ s, life: 0, max: 0.35 + size * 0.02, size: size * 5 });
    this.burst(at, Math.min(160, 30 + size * 6), size * 4, color);
  }

  burst(at: THREE.Vector3, n: number, speed: number, color: number) {
    const pos = new Float32Array(n * 3), v = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([at.x, at.y, at.z], i * 3);
      tmp2.randomDirection().multiplyScalar(speed * (0.3 + Math.random()));
      v.set([tmp2.x, tmp2.y, tmp2.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: this.glow, color: new THREE.Color(color).multiplyScalar(3), size: 7, sizeAttenuation: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.group.add(pts);
    this.bursts.push({ pts, v, life: 0, max: 1.1 });
  }

  update(dt: number) {
    const ships = this.hooks.ships();
    // lasers: swept-sphere hit test so fast bolts never tunnel
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.prev.copy(b.mesh.position);
      b.mesh.position.addScaledVector(b.vel, dt);
      b.life -= dt;
      let hit = false;
      if (b.dmg > 0) {
        seg.set(b.prev, b.mesh.position);
        for (const s of ships) {
          if (!s.alive || s === b.owner || s.team === b.owner.team) continue;
          seg.closestPointToPoint(s.pos, true, closest);
          if (closest.distanceToSquared(s.pos) < (s.stats.radius + 1.2) ** 2) {
            this.hit(s, b.owner, b.dmg, closest);
            hit = true;
            break;
          }
        }
        if (!hit) for (const o of this.hooks.obstacles(b.mesh.position, 4)) {
          if (o.p.distanceToSquared(b.mesh.position) < o.r * o.r) { hit = true; this.burst(b.mesh.position, 8, 20, 0xffc890); break; }
        }
      }
      if (hit || b.life <= 0) this.recycle(i);
    }

    // missiles: proportional-ish homing with limited turn rate
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.life -= dt;
      const speed = Math.min(420, m.vel.length() + 260 * dt);
      const fwd = tmp.set(0, 0, -1).applyQuaternion(m.mesh.quaternion);
      if (m.target?.alive && m.life < 6.7) {
        const dist = m.target.pos.distanceTo(m.mesh.position);
        const lead = tmp2.copy(m.target.pos).addScaledVector(m.target.vel, Math.min(1.5, dist / speed));
        const desired = lead.sub(m.mesh.position).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(fwd, desired);
        const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
        const maxTurn = 2.6 * dt;
        m.mesh.quaternion.premultiply(angle > maxTurn ? new THREE.Quaternion().slerp(q, maxTurn / angle) : q);
      }
      fwd.set(0, 0, -1).applyQuaternion(m.mesh.quaternion);
      m.vel.copy(fwd).multiplyScalar(speed);
      m.mesh.position.addScaledVector(m.vel, dt);
      m.trailT -= dt;
      if (m.trailT <= 0) { m.trailT = 0.03; this.burst(m.mesh.position, 2, 6, 0xffa040); }
      let boom = m.life <= 0;
      for (const s of ships) {
        if (!s.alive || s === m.owner || s.team === m.owner.team) continue;
        if (s.pos.distanceTo(m.mesh.position) < s.stats.radius + 9) { boom = true; break; }
      }
      if (!boom) for (const o of this.hooks.obstacles(m.mesh.position, 2)) if (o.p.distanceTo(m.mesh.position) < o.r) { boom = true; break; }
      if (boom) {
        const at = m.mesh.position.clone();
        this.explode(at, 7, 0xffa040);
        this.hooks.onSound('boom', at, m.owner);
        for (const s of ships) {
          if (!s.alive || s === m.owner || s.team === m.owner.team) continue;
          const d = s.pos.distanceTo(at);
          if (d < 40 + s.stats.radius) this.hit(s, m.owner, 70 * (1 - d / (50 + s.stats.radius)), at);
        }
        this.group.remove(m.mesh);
        this.missiles.splice(i, 1);
      }
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life += dt;
      const k = f.life / f.max;
      f.s.scale.setScalar(f.size * (0.4 + k));
      f.s.material.opacity = Math.max(0, 1 - k);
      if (k >= 1) { this.group.remove(f.s); f.s.material.dispose(); this.flashes.splice(i, 1); }
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life += dt;
      const arr = b.pts.geometry.attributes.position.array as Float32Array;
      const drag = Math.exp(-dt * 1.5);
      for (let k = 0; k < arr.length; k++) { arr[k] += b.v[k] * dt; b.v[k] *= drag; }
      b.pts.geometry.attributes.position.needsUpdate = true;
      (b.pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - b.life / b.max);
      if (b.life >= b.max) { this.group.remove(b.pts); b.pts.geometry.dispose(); (b.pts.material as THREE.Material).dispose(); this.bursts.splice(i, 1); }
    }
  }

  private hit(victim: Ship, attacker: Ship | null, dmg: number, at: THREE.Vector3) {
    const shielded = victim.shield > 0;
    this.burst(at, 10, 30, shielded ? 0x7fd8ff : 0xffb070);
    this.hooks.onSound('hit', at, attacker);
    const killed = victim.damage(dmg, attacker);
    this.hooks.onHit(victim, attacker, dmg);
    if (killed) {
      const big = victim.stats.radius > 10;
      this.explode(victim.pos.clone(), victim.stats.radius * (big ? 2.2 : 1.6), big ? 0xffc27a : 0xff8040);
      this.hooks.onSound(big ? 'bigboom' : 'boom', victim.pos, attacker);
      this.hooks.onKill(victim, attacker);
    }
  }

  private recycle(i: number) {
    const b = this.bolts[i];
    b.mesh.visible = false;
    this.group.remove(b.mesh);
    this.pool.push(b.mesh);
    this.bolts.splice(i, 1);
  }

  clear() {
    for (let i = this.bolts.length - 1; i >= 0; i--) this.recycle(i);
    for (const m of this.missiles) this.group.remove(m.mesh);
    for (const f of this.flashes) this.group.remove(f.s);
    for (const b of this.bursts) this.group.remove(b.pts);
    this.missiles = []; this.flashes = []; this.bursts = [];
  }

  get missileCount() { return this.missiles.length; }
}
