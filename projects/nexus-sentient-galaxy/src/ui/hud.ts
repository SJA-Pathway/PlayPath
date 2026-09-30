import * as THREE from 'three';
import { bus, type LogTag } from '../core/log';
import { FACTIONS, GALAXY, DANGER } from '../world/galaxy';
import type { Game } from '../game';
import type { Ship } from '../ships/ship';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

interface Marker { pos: THREE.Vector3; cls: string; label: string; size: number; ship?: Ship }

/** Everything drawn over the 3D view. Reads game state; never mutates it. */
export class Hud {
  private pool: HTMLDivElement[] = [];
  private radar = $<HTMLCanvasElement>('radar');
  private rctx = this.radar.getContext('2d')!;
  private v = new THREE.Vector3();
  private inv = new THREE.Quaternion();
  private cache = new Map<string, string>();

  constructor(private game: Game) {
    bus.on('log', e => this.log(e.tag, e.text));
    bus.on('toast', e => this.toast(e.text, e.kind));
  }

  private set(id: string, text: string) {
    if (this.cache.get(id) === text) return;
    this.cache.set(id, text);
    $(id).textContent = text;
  }
  private width(id: string, frac: number) {
    const w = `${Math.max(0, Math.min(100, frac * 100)).toFixed(1)}%`;
    if (this.cache.get(id) === w) return;
    this.cache.set(id, w);
    $(id).style.width = w;
  }

  log(tag: LogTag, text: string) {
    const d = document.createElement('div');
    const t = document.createElement('span');
    t.className = `tag ${tag}`;
    t.textContent = tag === 'gm' ? 'GM' : tag.toUpperCase();
    d.append(t, text);
    const box = $('codexLog');
    box.prepend(d);
    while (box.children.length > 8) box.lastChild!.remove();
  }

  toast(text: string, kind: 'good' | 'bad' | 'info' = 'info') {
    const d = document.createElement('div');
    d.className = `toast ${kind}`;
    d.textContent = text;
    $('toasts').append(d);
    setTimeout(() => d.remove(), 2700);
    while ($('toasts').children.length > 3) $('toasts').firstChild!.remove();
  }

  setSystem() {
    const g = this.game, s = GALAXY[g.systemId];
    this.set('sysName', s.name);
    this.set('sysSub', `${s.star.cls}-class · ${FACTIONS[s.faction].name} · ${DANGER[s.danger]}`);
  }

  update() {
    const g = this.game, p = g.player, save = g.save;
    const surface = g.mode === 'surface';
    this.set('modeTag', surface ? `On surface · ${g.surface?.planet.name}` : g.mode === 'warp' ? 'FTL jump in progress' : g.massLocked ? 'Mass-locked: hostiles nearby' : '');
    // vitals
    this.width('hullFill', p.hull / p.stats.hull); this.set('hullNum', String(Math.ceil(p.hull)));
    $('hullBar').classList.toggle('low', p.hullFrac < 0.3);
    this.width('shieldFill', p.shield / p.stats.shield); this.set('shieldNum', String(Math.floor(p.shield)));
    this.width('heatFill', p.heat / 100); this.set('heatNum', String(Math.floor(p.heat)));
    $('heatBar').classList.toggle('over', p.overheated);
    this.set('missileNum', `${save.missiles} / ${6 + save.upgrades.rack * 3}`);
    this.set('creditNum', `${save.credits.toLocaleString()} cr`);
    const reps = FACTIONS.map((f, i) => `<span style="color:${f.css}">${f.short} <b>${save.factionRep[i] > 0 ? '+' : ''}${save.factionRep[i]}</b></span>`).join('');
    if (this.cache.get('reps') !== reps) { this.cache.set('reps', reps); $('reps').innerHTML = reps; }

    // speed
    const fwd = p.vel.dot(p.forward(this.v));
    this.set('speedNum', String(Math.round(Math.abs(fwd) * 4)));
    this.width('throttleFill', Math.max(0, g.throttle));
    this.set('faTag', p.ctl.assist ? 'Flight assist' : 'Assist off');
    $('faTag').classList.toggle('off', !p.ctl.assist);
    this.set('boostTag', p.ctl.boost ? 'Boost' : fwd < -1 ? 'Reverse' : '');

    // net
    const net = g.net;
    $('net').classList.toggle('online', net.status === 'online');
    this.set('netText', net.status === 'online' ? `Online · ${net.count} other pilot${net.count === 1 ? '' : 's'}` : net.status === 'connecting' ? 'Connecting…' : 'Offline (solo)');

    // contracts tracker
    const cs = save.contracts.map(c => `<div class="c panel"><span class="t">${esc(c.title)}</span><span class="label">${c.system >= 0 ? GALAXY[c.system].name + ' · ' : ''}${c.progress}/${c.target} · ${c.reward} cr</span><span class="p"><i style="width:${(c.progress / c.target) * 100}%"></i></span></div>`).join('');
    if (this.cache.get('contracts') !== cs) { this.cache.set('contracts', cs); $('contracts').innerHTML = cs; }

    // stick indicator (mouse flight)
    const stick = $('stick');
    stick.hidden = !g.input.locked;
    if (g.input.locked) stick.style.transform = `translate(${g.input.stick.x * 90}px, ${g.input.stick.y * 90}px)`;

    this.markers();
    this.targetPanel();
    this.prompt();
    this.drawRadar();
  }

  private project(pos: THREE.Vector3) {
    const cam = this.game.renderer.camera;
    const v = this.v.copy(pos).project(cam);
    const behind = this.v.copy(pos).sub(cam.position).dot(cam.getWorldDirection(new THREE.Vector3())) < 0;
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, behind, ndc: new THREE.Vector2(v.x, v.y) };
  }

  private markers() {
    const g = this.game;
    const list: Marker[] = [];
    if (g.mode === 'space' || g.mode === 'warp') {
      for (const s of g.ships) {
        if (!s.alive) continue;
        const cls = g.hostile(s, g.player) ? 'hostile' : s.team === 'convoy' ? 'convoy' : 'ally';
        list.push({ pos: s.pos, cls, label: `${s.name} ${Math.round(s.pos.distanceTo(g.player.pos))}m`, size: s.stats.radius, ship: s });
      }
      for (const r of g.net.remotes.values()) list.push({ pos: r.ship.pos, cls: 'remote', label: r.ship.name, size: 6 });
      for (const pl of g.system.planets) list.push({ pos: pl.pos, cls: 'poi', label: pl.def.name, size: 0 });
      if (g.system.station) list.push({ pos: g.system.station.pos, cls: 'station', label: g.system.station.name, size: 0 });
      for (const c of g.crates) list.push({ pos: c.mesh.position, cls: 'convoy', label: 'Cargo pod', size: 3 });
    } else if (g.mode === 'surface' && g.surface) {
      for (const c of g.surface.creatures) {
        const d = c.obj.position.distanceTo(g.player.pos);
        if (d > 420) continue;
        const known = g.save.bestiary[`${g.surface.planet.id}/${c.gene.name}`];
        list.push({ pos: c.obj.position, cls: c.tamed ? 'remote' : c.gene.diet === 'hunter' ? 'hostile' : 'poi', label: known || d < 150 ? `${c.gene.name}${c.tamed ? ' (tamed)' : ''}` : '?', size: c.gene.size });
      }
    }
    let i = 0;
    const cam = g.renderer.camera;
    for (const m of list) {
      const pr = this.project(m.pos);
      if (pr.behind || pr.x < -40 || pr.x > innerWidth + 40 || pr.y < -40 || pr.y > innerHeight + 40) continue;
      const dist = m.pos.distanceTo(cam.position);
      const px = m.size ? Math.max(14, Math.min(90, (m.size * 2.4 * innerHeight) / (dist * Math.tan((cam.fov * Math.PI) / 360) * 2) + 8)) : 10;
      const el = this.pool[i] ?? (this.pool[i] = Object.assign(document.createElement('div'), { className: 'bk' }));
      if (!el.parentNode) $('brackets').append(el);
      const locked = m.ship && m.ship === g.target;
      const cls = `bk ${m.cls === 'hostile' ? '' : m.cls}${locked ? (g.locked ? ' locked' : ' locking') : ''}`;
      if (el.className !== cls) el.className = cls;
      const showLabel = locked || m.cls === 'poi' || m.cls === 'station' || m.cls === 'remote' || dist < 600;
      const lbl = showLabel ? m.label : '';
      if (el.dataset.l !== lbl) el.dataset.l = lbl;
      el.style.transform = `translate(${pr.x - px / 2}px, ${pr.y - px / 2}px)`;
      el.style.width = el.style.height = `${px}px`;
      el.hidden = false;
      i++;
    }
    for (; i < this.pool.length; i++) this.pool[i].hidden = true;

    // off-screen arrow + lead pip for the current target
    const arrow = $('arrow'), lead = $('lead');
    const t = g.target;
    if (t && t.alive && g.mode === 'space') {
      const pr = this.project(t.pos);
      const on = !pr.behind && pr.x > 0 && pr.x < innerWidth && pr.y > 0 && pr.y < innerHeight;
      arrow.hidden = on;
      if (!on) {
        let dx = pr.ndc.x, dy = -pr.ndc.y;
        if (pr.behind) { dx = -dx; dy = -dy; }
        const a = Math.atan2(dy, dx);
        const rx = innerWidth / 2 - 50, ry = innerHeight / 2 - 50;
        arrow.style.transform = `translate(${innerWidth / 2 + Math.cos(a) * rx}px, ${innerHeight / 2 + Math.sin(a) * ry}px) rotate(${a + Math.PI / 2}rad)`;
      }
      const dist = t.pos.distanceTo(g.player.pos);
      const lp = t.pos.clone().addScaledVector(t.vel.clone().sub(g.player.vel), dist / 1100);
      const lpr = this.project(lp);
      lead.hidden = lpr.behind || dist > 1600;
      lead.style.transform = `translate(${lpr.x}px, ${lpr.y}px) rotate(45deg)`;
    } else { arrow.hidden = true; lead.hidden = true; }
  }

  private targetPanel() {
    const g = this.game, t = g.target, el = $('target');
    if (!t || !t.alive || g.mode !== 'space') { el.hidden = true; return; }
    el.hidden = false;
    this.set('tgtLabel', g.locked ? 'Missile lock' : g.lockT > 0 ? 'Locking…' : g.hostile(t, g.player) ? 'Hostile' : 'Contact');
    this.set('tgtName', t.name);
    this.width('tgtHull', t.hull / t.stats.hull);
    this.width('tgtShield', t.stats.shield ? t.shield / t.stats.shield : 0);
    this.set('tgtDist', `${Math.round(t.pos.distanceTo(g.player.pos))}`);
  }

  private prompt() {
    const g = this.game, el = $('prompt');
    const html = g.contextPrompt();
    el.hidden = !html;
    if (html && this.cache.get('prompt') !== html) { this.cache.set('prompt', html); el.innerHTML = html; }
    const prog = $('progress');
    prog.hidden = g.tameProgress <= 0;
    if (g.tameProgress > 0) $('progressFill').style.width = `${Math.min(100, g.tameProgress * 100)}%`;
  }

  private drawRadar() {
    const g = this.game, c = this.rctx, W = this.radar.width, R = W / 2;
    const surface = g.mode === 'surface';
    const scale = R / (surface ? 450 : 2600);
    c.clearRect(0, 0, W, W);
    c.fillStyle = 'rgba(8,14,26,.78)';
    c.beginPath(); c.arc(R, R, R - 1, 0, 7); c.fill();
    c.strokeStyle = 'rgba(127,231,255,.25)'; c.lineWidth = 2; c.stroke();
    c.lineWidth = 1;
    for (const k of [0.33, 0.66]) { c.beginPath(); c.arc(R, R, R * k, 0, 7); c.stroke(); }
    this.inv.copy(g.player.quat).invert();
    const dot = (pos: THREE.Vector3, color: string, size: number, clampEdge = true) => {
      const v = this.v.copy(pos).sub(g.player.pos).applyQuaternion(this.inv);
      let x = v.x * scale, y = v.z * scale;
      const L = Math.hypot(x, y);
      if (L > R - 8) { if (!clampEdge) return; x *= (R - 8) / L; y *= (R - 8) / L; }
      c.fillStyle = color;
      c.beginPath(); c.arc(R + x, R + y, size, 0, 7); c.fill();
      // altitude tick
      if (Math.abs(v.y * scale) > 3 && L < R - 8) { c.strokeStyle = color; c.beginPath(); c.moveTo(R + x, R + y); c.lineTo(R + x, R + y + Math.max(-12, Math.min(12, -v.y * scale))); c.stroke(); }
    };
    if (surface && g.surface) {
      for (const cr of g.surface.creatures) dot(cr.obj.position, cr.tamed ? '#8fffc8' : cr.gene.diet === 'hunter' ? '#ff4d5e' : '#c9a0ff', 3, false);
    } else {
      dot(new THREE.Vector3(), '#ffd28a', 8);
      for (const pl of g.system.planets) dot(pl.pos, g.save.scanned[pl.def.id] ? '#7fe7ff' : '#9aa9bb', 5);
      if (g.system.station) dot(g.system.station.pos, '#ffb547', 4);
      for (const cr of g.crates) dot(cr.mesh.position, '#ffb547', 3, false);
      for (const r of g.net.remotes.values()) dot(r.ship.pos, '#8fffc8', 3);
      for (const s of g.ships) if (s.alive) dot(s.pos, g.hostile(s, g.player) ? '#ff4d5e' : s.team === 'convoy' ? '#ffb547' : '#6fb8ff', s === g.target ? 4.5 : 3, false);
    }
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(R, R - 9); c.lineTo(R - 6, R + 6); c.lineTo(R + 6, R + 6); c.fill();
  }
}

export const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
