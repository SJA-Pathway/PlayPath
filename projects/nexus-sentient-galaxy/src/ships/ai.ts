import * as THREE from 'three';
import { clamp } from '../core/rng';
import type { Ship } from './ship';

/**
 * Utility AI. Every ~0.3 s each ship scores its options (attack / flee / regroup / escort / patrol)
 * and commits to the best one. Attack is an "attack run": approach, fire, overshoot, extend, turn back —
 * which reads like real dogfighting instead of ships orbiting the player.
 */
export type Mode = 'patrol' | 'attack' | 'flee' | 'regroup' | 'escort' | 'travel';

export interface Brain {
  mode: Mode;
  target: Ship | null;
  leader: Ship | null;
  escort: Ship | null;
  home: THREE.Vector3;
  goal: THREE.Vector3 | null;
  phase: 'approach' | 'extend';
  phaseT: number;
  think: number;
  aggression: number;
  courage: number;
  skill: number;
  jink: THREE.Vector3;
  jinkT: number;
  sensor: number;
}

export function makeBrain(home: THREE.Vector3, opts: Partial<Brain> = {}): Brain {
  return {
    mode: 'patrol', target: null, leader: null, escort: null, home: home.clone(), goal: null, phase: 'approach', phaseT: 0, think: Math.random() * 0.3,
    aggression: 0.8, courage: 0.5, skill: 0.6, jink: new THREE.Vector3(), jinkT: 0, sensor: 1500, ...opts,
  };
}

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), inv = new THREE.Quaternion();

export interface AIWorld {
  ships: Ship[];
  hostile: (a: Ship, b: Ship) => boolean;
  fire: (s: Ship) => void;
  avoid: (p: THREE.Vector3, out: THREE.Vector3) => boolean;
}

export function thinkAndAct(s: Ship, b: Brain, w: AIWorld, dt: number) {
  if (!s.alive) return;
  b.think -= dt;
  b.phaseT += dt;
  if (b.think <= 0) {
    b.think = 0.25 + Math.random() * 0.15;
    decide(s, b, w);
  }
  const c = s.ctl;
  c.fire = false; c.boost = false; c.assist = true; c.strafeX = 0; c.strafeY = 0; c.roll = 0;

  let dest: THREE.Vector3 | null = null;
  let throttle = 0.6;
  switch (b.mode) {
    case 'attack': {
      const t = b.target!;
      const dist = t.pos.distanceTo(s.pos);
      const boltSpeed = 1100;
      const lead = v2.copy(t.pos).addScaledVector(t.vel, (dist / boltSpeed) * (0.5 + b.skill * 0.6));
      if (b.phase === 'approach') {
        dest = lead;
        throttle = dist > 500 ? 1 : 0.55 + b.skill * 0.25;
        c.boost = dist > 900;
        const fwd = s.forward(v1);
        const aim = lead.clone().sub(s.pos).normalize();
        const dot = fwd.dot(aim);
        if (dist < 950 && dot > 0.985 - (1 - b.skill) * 0.02) c.fire = true;
        if (dist < 70 + s.stats.radius * 4 || (b.phaseT > 9 && dist < 300)) { b.phase = 'extend'; b.phaseT = 0; b.goal = s.pos.clone().addScaledVector(fwd, 600).add(v1.randomDirection().multiplyScalar(250)); }
      } else {
        dest = b.goal;
        throttle = 1;
        c.boost = b.phaseT < 1.2;
        if (b.phaseT > 1.6 + Math.random() * 1.2) { b.phase = 'approach'; b.phaseT = 0; }
      }
      // jink when under fire
      if (s.lastHit < 1.5) {
        b.jinkT -= dt;
        if (b.jinkT <= 0) { b.jinkT = 0.4 + Math.random() * 0.5; b.jink.set(Math.random() * 2 - 1, Math.random() * 2 - 1, 0); }
        c.strafeX = b.jink.x; c.strafeY = b.jink.y;
      }
      break;
    }
    case 'flee': {
      const threat = b.target ?? s.lastAttacker;
      dest = threat ? v2.copy(s.pos).multiplyScalar(2).sub(threat.pos) : b.home;
      throttle = 1; c.boost = true;
      break;
    }
    case 'regroup':
      dest = b.leader ? v2.copy(b.leader.pos).addScaledVector(b.leader.right(v1), s.id % 2 ? 40 : -40) : b.home;
      throttle = b.leader ? clamp(b.leader.pos.distanceTo(s.pos) / 200, 0.3, 1) : 0.6;
      break;
    case 'escort':
      dest = b.escort ? v2.copy(b.escort.pos).add(v1.set(Math.cos(s.id + b.phaseT * 0.3) * 90, 30, Math.sin(s.id + b.phaseT * 0.3) * 90)) : b.home;
      throttle = b.escort ? clamp(dest.distanceTo(s.pos) / 150, 0.25, 1) : 0.5;
      break;
    case 'travel':
      dest = b.goal ?? b.home;
      throttle = 0.9;
      break;
    default: {
      if (!b.goal || b.goal.distanceTo(s.pos) < 80 || b.phaseT > 20) {
        b.goal = b.home.clone().add(v1.randomDirection().multiplyScalar(250 + Math.random() * 250));
        b.phaseT = 0;
      }
      dest = b.goal;
      throttle = 0.4;
    }
  }

  // obstacle avoidance overrides steering
  const away = v1.set(0, 0, 0);
  if (w.avoid(s.pos, away)) { dest = away.multiplyScalar(300).add(s.pos); throttle = Math.max(throttle, 0.7); }
  steerTo(s, dest, b.skill);
  c.throttle = throttle;
  if (c.fire) w.fire(s);
}

function steerTo(s: Ship, dest: THREE.Vector3 | null, skill: number) {
  if (!dest) { s.ctl.pitch = s.ctl.yaw = 0; return; }
  inv.copy(s.quat).invert();
  const local = v1.copy(dest).sub(s.pos).applyQuaternion(inv).normalize();
  const gain = 2.2 + skill * 1.6;
  // local -Z is forward. If target is behind, pick a hard turn.
  const behind = local.z > 0.2;
  s.ctl.yaw = clamp(-local.x * gain + (behind && Math.abs(local.x) < 0.2 ? 1 : 0), -1, 1);
  s.ctl.pitch = clamp(local.y * gain, -1, 1);
  s.ctl.roll = clamp(-local.x * 0.6, -1, 1);
}

function decide(s: Ship, b: Brain, w: AIWorld) {
  let best: Ship | null = null, bestScore = 0;
  for (const o of w.ships) {
    if (!o.alive || o === s || !w.hostile(s, o)) continue;
    const d = o.pos.distanceTo(s.pos);
    if (d > b.sensor) continue;
    let score = (1 - d / b.sensor) * b.aggression;
    if (o === s.lastAttacker) score += 0.35;
    if (o === b.target) score += 0.2; // stickiness
    if (o.kind === 'freighter') score += 0.15;
    if (score > bestScore) { bestScore = score; best = o; }
  }
  const hp = s.hullFrac;
  const flee = hp < 0.35 ? (1 - hp) ** 2 * (1 - b.courage) * 1.8 : 0;
  const attack = best ? 0.3 + bestScore * (0.4 + hp) : 0;
  const regroup = b.leader?.alive && b.leader.pos.distanceTo(s.pos) > 450 ? 0.45 : 0;
  const escort = b.escort?.alive ? 0.35 : 0;
  const travel = b.mode === 'travel' && b.goal ? 0.4 : 0;
  const opts: [Mode, number][] = [['attack', attack], ['flee', flee], ['regroup', regroup], ['escort', escort], ['travel', travel], ['patrol', 0.15]];
  opts.sort((a, c) => c[1] - a[1]);
  const mode = opts[0][0];
  if (mode === 'attack' && b.target !== best) { b.phase = 'approach'; b.phaseT = 0; }
  if (mode !== b.mode) b.phaseT = 0;
  b.mode = mode;
  b.target = mode === 'attack' || mode === 'flee' ? best ?? s.lastAttacker : null;
  if (b.leader && !b.leader.alive) b.leader = null;
  if (b.escort && !b.escort.alive) b.escort = null;
}
