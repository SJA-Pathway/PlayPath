import * as THREE from 'three';
import { rng, range, pick, genName, makeNoise2, clamp, damp, hashString } from '../core/rng';
import type { SpeciesGene } from '../core/save';
import type { PlanetDef } from '../world/galaxy';

/**
 * Planet surface: a streamed-free 4 km heightfield with biome colouring, fog and a live ecosystem.
 * Grazers flock (boids) and flee; hunters stalk and eat them. What happened on your last visit drives
 * how each species mutates on the next one, so populations visibly adapt over generations.
 */

const SIZE = 4200, SEG = 220;

export interface Creature {
  id: number; gene: SpeciesGene; obj: THREE.Group; legs: THREE.Object3D[]; vel: THREE.Vector3; heading: number;
  state: 'wander' | 'flee' | 'chase' | 'rest' | 'follow'; stateT: number; alive: boolean; tamed: boolean; gait: number; herd: number; hunger: number;
}

export interface EvolutionNote { species: string; text: string }

export class Surface {
  readonly scene = new THREE.Scene();
  readonly creatures: Creature[] = [];
  readonly sea: number;
  readonly notes: EvolutionNote[] = [];
  private height: (x: number, z: number) => number;
  private amp: number;
  private nextId = 1;
  private spawnT = 0;
  private sunDir: THREE.Vector3;
  private water?: THREE.Mesh;
  private time = 0;
  readonly genes: SpeciesGene[];

  constructor(readonly planet: PlanetDef, stored: SpeciesGene[] | undefined, tamedIds: Set<string>) {
    const r = rng(planet.look.seed + 991);
    const noise = makeNoise2(r);
    const ridged = makeNoise2(r);
    this.amp = planet.biome === 'ice' ? 260 : planet.biome === 'desert' ? 160 : planet.biome === 'ocean' ? 140 : 220;
    const seaFrac = planet.biome === 'ocean' ? 0.5 : planet.biome === 'desert' || planet.biome === 'lava' ? 0.22 : 0.33;
    this.sea = this.amp * seaFrac;
    const amp = this.amp;
    this.height = (x, z) => {
      const nx = x / 900, nz = z / 900;
      let h = noise(nx, nz, 5);
      const rr = 1 - Math.abs(ridged(nx * 0.7 + 20, nz * 0.7, 4) * 2 - 1);
      h = h * 0.65 + rr * rr * 0.45;
      // flatten a landing meadow at the origin
      const d = Math.hypot(x, z) / 320;
      if (d < 1) h = h * d + (0.5) * (1 - d);
      return h * amp;
    };

    // --- sky, light, fog
    const atmo = new THREE.Color(planet.atmo);
    const skyCol = atmo.clone().multiplyScalar(planet.biome === 'lava' ? 0.25 : 0.55);
    this.scene.background = skyCol;
    this.scene.fog = new THREE.FogExp2(skyCol.getHex(), planet.biome === 'toxic' || planet.biome === 'lava' ? 0.00065 : 0.00038);
    this.sunDir = new THREE.Vector3(range(r, -0.6, 0.6), range(r, 0.45, 0.85), range(r, -0.6, 0.6)).normalize();
    const sun = new THREE.DirectionalLight(0xfff0dd, 2.4);
    sun.position.copy(this.sunDir).multiplyScalar(1000);
    this.scene.add(sun, new THREE.HemisphereLight(atmo.getHex(), 0x1a1410, 0.8));
    this.scene.add(this.makeSky(atmo));

    // --- terrain
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const [c0, c1, c2, c3] = planet.look.colors.map(c => new THREE.Color(c));
    const shore = new THREE.Color(planet.biome === 'ice' ? 0xcfe0ea : planet.biome === 'lava' ? 0x1a0c08 : 0xc9b47a);
    const snow = new THREE.Color(0xeef4fa);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = this.height(x, z);
      pos.setY(i, h);
      const t = (h - this.sea) / (amp - this.sea);
      if (h < this.sea) tmp.copy(c1).lerp(c0, clamp((this.sea - h) / 60, 0, 1));
      else if (t < 0.06) tmp.copy(shore);
      else tmp.copy(c2).lerp(c3, clamp(t * 1.3, 0, 1));
      if (planet.biome !== 'lava' && planet.biome !== 'desert' && t > 0.72) tmp.lerp(snow, clamp((t - 0.72) * 4, 0, 1));
      const n = noise(x / 60, z / 60, 2) * 0.25 + 0.88;
      tmp.multiplyScalar(n);
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02, flatShading: planet.biome === 'ice' || planet.biome === 'lava' }));
    this.scene.add(terrain);

    // --- liquid
    const liquid = planet.biome === 'lava' ? new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a14).multiplyScalar(2.2) })
      : planet.biome === 'toxic' ? new THREE.MeshStandardMaterial({ color: 0x6a9a20, emissive: 0x2a4a08, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 })
      : new THREE.MeshStandardMaterial({ color: planet.biome === 'ice' ? 0x8ab8d8 : c1.getHex(), roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.82 });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 1.5, SIZE * 1.5).rotateX(-Math.PI / 2), liquid);
    this.water.position.y = this.sea;
    this.scene.add(this.water);

    // --- scattered flora / rocks (instanced)
    this.scene.add(this.makeFlora(r));

    // --- ecosystem
    this.genes = stored?.length ? stored.map(g => ({ ...g })) : makeGenes(planet, r);
    if (stored?.length) this.evolve();
    for (const g of this.genes) {
      const herds = g.diet === 'grazer' ? 3 : 2;
      const per = g.diet === 'grazer' ? 7 : 2;
      for (let h = 0; h < herds; h++) {
        const center = this.randomLand(r);
        for (let k = 0; k < per; k++) this.spawn(g, center.clone().add(new THREE.Vector3(range(r, -40, 40), 0, range(r, -40, 40))), h, tamedIds.has(`${planet.id}/${g.name}`) && h === 0 && k === 0);
      }
      g.lastEaten = 0;
      g.lastLost = 0;
    }
  }

  heightAt(x: number, z: number) { return Math.max(this.height(x, z), this.sea); }
  groundAt(x: number, z: number) { return this.height(x, z); }

  private randomLand(r: () => number) {
    for (let i = 0; i < 60; i++) {
      const x = range(r, -1500, 1500), z = range(r, -1500, 1500);
      if (this.height(x, z) > this.sea + 8) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(0, 0, 0);
  }

  /** Natural selection between visits: predation pressure drives speed, luck drives drift. */
  private evolve() {
    const r = rng(hashString(this.planet.id) + this.genes[0].gen * 7919);
    for (const g of this.genes) {
      const before = { speed: g.speed, size: g.size };
      g.gen++;
      if (g.diet === 'grazer') {
        g.speed *= g.lastLost >= 3 ? 1.08 : g.lastLost === 0 ? 0.98 : 1.02;
        g.boldness = clamp(g.boldness + (g.lastLost >= 3 ? -0.06 : 0.03), 0.05, 0.95);
      } else {
        g.speed *= g.lastEaten >= 2 ? 1.01 : 1.06;
        g.size *= g.lastEaten >= 2 ? 1.04 : 0.98;
      }
      g.size *= range(r, 0.95, 1.06);
      g.hue = (g.hue + range(r, -0.025, 0.025) + 1) % 1;
      g.speed = clamp(g.speed, 8, 60);
      g.size = clamp(g.size, 1.2, 9);
      const ds = Math.round((g.speed / before.speed - 1) * 100), dz = Math.round((g.size / before.size - 1) * 100);
      const why = g.diet === 'grazer'
        ? (g.lastLost >= 3 ? `after heavy predation (${g.lastLost} lost)` : g.lastLost === 0 ? 'with no predators pressing them' : 'after light predation')
        : (g.lastEaten >= 2 ? `after a good hunting season (${g.lastEaten} kills)` : 'after going hungry');
      this.notes.push({ species: g.name, text: `Generation ${g.gen}: ${g.name} ${ds >= 0 ? '+' : ''}${ds}% speed, ${dz >= 0 ? '+' : ''}${dz}% size ${why}.` });
    }
  }

  private spawn(g: SpeciesGene, at: THREE.Vector3, herd: number, tamed = false) {
    const { obj, legs } = buildCreature(g);
    at.y = this.groundAt(at.x, at.z);
    obj.position.copy(at);
    this.scene.add(obj);
    const c: Creature = {
      id: this.nextId++, gene: g, obj, legs, vel: new THREE.Vector3(), heading: Math.random() * Math.PI * 2, state: tamed ? 'follow' : 'wander',
      stateT: 0, alive: true, tamed, gait: Math.random() * 6, herd, hunger: Math.random(),
    };
    this.creatures.push(c);
    return c;
  }

  update(dt: number, player: THREE.Vector3, playerSpeed: number) {
    this.time += dt;
    const grazers = this.creatures.filter(c => c.alive && c.gene.diet === 'grazer');
    const hunters = this.creatures.filter(c => c.alive && c.gene.diet === 'hunter');
    const sep = new THREE.Vector3(), ali = new THREE.Vector3(), coh = new THREE.Vector3(), steer = new THREE.Vector3(), d = new THREE.Vector3();

    for (const c of this.creatures) {
      if (!c.alive) continue;
      c.stateT += dt;
      const g = c.gene;
      let speed = g.speed * 0.35;
      steer.set(0, 0, 0);
      const p = c.obj.position;
      const toPlayer = d.copy(p).sub(player);
      const pDist = Math.hypot(toPlayer.x, toPlayer.z);

      if (c.tamed) {
        c.state = 'follow';
        const target = new THREE.Vector3(player.x, 0, player.z);
        const off = target.sub(p).setY(0);
        const L = off.length();
        if (L > 30) { steer.copy(off).normalize(); speed = Math.min(g.speed * 1.4, L * 0.8); } else speed = 0;
      } else if (g.diet === 'grazer') {
        // boids within herd
        sep.set(0, 0, 0); ali.set(0, 0, 0); coh.set(0, 0, 0);
        let n = 0;
        for (const o of grazers) {
          if (o === c || o.gene !== g || o.herd !== c.herd) continue;
          const dd = o.obj.position.distanceTo(p);
          if (dd > 70) continue;
          n++;
          coh.add(o.obj.position);
          ali.add(o.vel);
          if (dd < 9 + g.size * 2) sep.add(d.copy(p).sub(o.obj.position).divideScalar(Math.max(dd, 0.5)));
        }
        if (n) { coh.divideScalar(n).sub(p).setY(0).normalize().multiplyScalar(0.6); ali.setY(0).normalize().multiplyScalar(0.5); }
        steer.add(sep.multiplyScalar(2.2)).add(coh).add(ali);
        // threats
        let threat: THREE.Vector3 | null = null;
        for (const h of hunters) if (h.obj.position.distanceTo(p) < 110 + (1 - g.boldness) * 60) { threat = h.obj.position; break; }
        const spooked = pDist < 40 + (1 - g.boldness) * 70 && playerSpeed > 25;
        if (threat || spooked) {
          c.state = 'flee'; c.stateT = 0;
          steer.add(d.copy(p).sub(threat ?? player).setY(0).normalize().multiplyScalar(3));
        } else if (c.state === 'flee' && c.stateT > 3) c.state = 'wander';
        if (c.state === 'flee') speed = g.speed;
        else {
          c.heading += (Math.random() - 0.5) * dt * 1.5;
          steer.add(d.set(Math.cos(c.heading), 0, Math.sin(c.heading)).multiplyScalar(0.4));
          speed = g.speed * (0.18 + 0.2 * (Math.sin(this.time * 0.3 + c.id) * 0.5 + 0.5));
        }
      } else {
        // hunter: rest → prowl → chase → eat
        c.hunger += dt * 0.03;
        if (c.state === 'rest') { speed = 0; if (c.stateT > 9) { c.state = 'wander'; c.stateT = 0; } }
        else {
          let prey: Creature | null = null, best = 240 + g.boldness * 80;
          if (c.hunger > 0.4) for (const o of grazers) { const dd = o.obj.position.distanceTo(p); if (dd < best && !o.tamed) { best = dd; prey = o; } }
          if (prey) {
            c.state = 'chase';
            steer.copy(prey.obj.position).sub(p).setY(0).normalize().multiplyScalar(2);
            speed = g.speed * 1.05;
            if (best < 3 + g.size + prey.gene.size) {
              prey.alive = false;
              this.scene.remove(prey.obj);
              g.lastEaten++; prey.gene.lastLost++;
              c.hunger = 0; c.state = 'rest'; c.stateT = 0;
            }
          } else {
            c.state = 'wander';
            c.heading += (Math.random() - 0.5) * dt;
            steer.set(Math.cos(c.heading), 0, Math.sin(c.heading));
            speed = g.speed * 0.3;
          }
          // bold hunters investigate a slow, low ship
          if (g.boldness > 0.8 && pDist < 90 && playerSpeed < 15) { steer.add(d.copy(player).sub(p).setY(0).normalize()); }
        }
      }

      // avoid water & world edge
      const ahead = d.copy(p).addScaledVector(c.vel.lengthSq() > 0.01 ? c.vel.clone().normalize() : steer, 14);
      if (this.height(ahead.x, ahead.z) < this.sea + 2 || Math.abs(ahead.x) > SIZE * 0.45 || Math.abs(ahead.z) > SIZE * 0.45) {
        steer.add(d.set(-p.x, 0, -p.z).normalize().multiplyScalar(2.5));
      }
      if (steer.lengthSq() > 0.0001) {
        const want = Math.atan2(steer.z, steer.x);
        let diff = want - c.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        c.heading += clamp(diff, -3 * dt, 3 * dt);
      }
      const v = speed;
      c.vel.set(Math.cos(c.heading) * v, 0, Math.sin(c.heading) * v);
      p.addScaledVector(c.vel, dt);
      const ground = this.groundAt(p.x, p.z);
      p.y += (Math.max(ground, this.sea - g.size * 0.6) - p.y) * damp(10, dt);
      c.obj.rotation.y = -c.heading - Math.PI / 2;
      // gait
      c.gait += dt * v * 0.5;
      const swing = Math.min(0.9, v * 0.06);
      c.legs.forEach((l, i) => { l.rotation.x = Math.sin(c.gait + (i % 2) * Math.PI + (i >> 1) * 0.6) * swing; });
      c.obj.children[0].position.y = g.size * 1.1 + Math.abs(Math.sin(c.gait)) * swing * 0.3;
    }

    // repopulate slowly so the ecosystem never collapses completely
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 12;
      for (const g of this.genes.filter(x => x.diet === 'grazer')) {
        const alive = grazers.filter(c => c.gene === g);
        if (alive.length < 14) {
          const parent = alive[Math.floor(Math.random() * alive.length)];
          if (parent) this.spawn(g, parent.obj.position.clone().add(new THREE.Vector3(range(Math.random, -10, 10), 0, range(Math.random, -10, 10))), parent.herd);
        }
      }
    }
    for (let i = this.creatures.length - 1; i >= 0; i--) if (!this.creatures[i].alive) this.creatures.splice(i, 1);
    if (this.water && this.planet.biome === 'lava') (this.water.material as THREE.MeshBasicMaterial).color.setRGB(2.2 + Math.sin(this.time) * 0.3, 0.55, 0.12);
  }

  nearestCreature(p: THREE.Vector3, maxDist: number, filter?: (c: Creature) => boolean) {
    let best: Creature | null = null, bd = maxDist;
    for (const c of this.creatures) {
      if (!c.alive || (filter && !filter(c))) continue;
      const d = c.obj.position.distanceTo(p);
      if (d < bd) { bd = d; best = c; }
    }
    return best ? { c: best, d: bd } : null;
  }

  private makeSky(atmo: THREE.Color) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: atmo.clone().multiplyScalar(0.18) }, uHorizon: { value: atmo.clone().multiplyScalar(0.9) }, uSun: { value: this.sunDir } },
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform vec3 uTop, uHorizon, uSun; varying vec3 vD;
        void main(){ float h = clamp(vD.y, 0., 1.); vec3 c = mix(uHorizon, uTop, pow(h, .45));
          float s = max(dot(normalize(vD), uSun), 0.); c += vec3(1., .9, .75) * (pow(s, 900.) * 12. + pow(s, 8.) * .25);
          gl_FragColor = vec4(c, 1.); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), mat);
    m.userData.followCamera = true;
    return m;
  }

  private makeFlora(r: () => number) {
    const b = this.planet.biome;
    const group = new THREE.Group();
    const count = b === 'jungle' ? 1400 : b === 'ocean' ? 700 : b === 'toxic' ? 900 : 500;
    let geo: THREE.BufferGeometry, color: number;
    if (b === 'jungle' || b === 'ocean') { geo = new THREE.ConeGeometry(3, 16, 6).translate(0, 8, 0); color = 0x2f6a2a; }
    else if (b === 'toxic') { geo = new THREE.CylinderGeometry(0.8, 2.6, 14, 6).translate(0, 7, 0); color = 0x9ab040; }
    else if (b === 'ice') { geo = new THREE.OctahedronGeometry(4, 0).translate(0, 3, 0); color = 0xcfe8ff; }
    else if (b === 'lava') { geo = new THREE.DodecahedronGeometry(4, 0).translate(0, 2, 0); color = 0x2a1810; }
    else { geo = new THREE.DodecahedronGeometry(3.5, 0).translate(0, 2, 0); color = 0x8a5a3a; }
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, emissive: b === 'toxic' ? 0x1a2a04 : 0 }), count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < count * 3 && n < count; i++) {
      const x = range(r, -SIZE / 2, SIZE / 2), z = range(r, -SIZE / 2, SIZE / 2), h = this.height(x, z);
      if (h < this.sea + 4 || h > this.amp * 0.8) continue;
      const k = range(r, 0.6, 1.8);
      s.set(k, k * range(r, 0.8, 1.4), k);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      m.compose(new THREE.Vector3(x, h - 0.5, z), q, s);
      mesh.setMatrixAt(n++, m);
    }
    mesh.count = n;
    group.add(mesh);
    return group;
  }

  dispose() {
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat && !Array.isArray(mat)) mat.dispose();
    });
  }
}

function makeGenes(_planet: PlanetDef, r: () => number): SpeciesGene[] {
  const kinds = ['strider', 'grazer', 'hopper', 'wader', 'lumbermaw'];
  const hunters = ['stalker', 'ripjaw', 'shade', 'lancer'];
  const baseHue = r();
  return [
    { name: `${genName(r, 2)} ${pick(r, kinds)}`, diet: 'grazer', size: range(r, 2, 4.5), speed: range(r, 16, 24), hue: baseHue, legs: pick(r, [2, 4, 4, 6]), boldness: range(r, 0.2, 0.6), gen: 1, lastEaten: 0, lastLost: 0 },
    { name: `${genName(r, 2)} ${pick(r, kinds)}`, diet: 'grazer', size: range(r, 1.4, 2.6), speed: range(r, 20, 28), hue: (baseHue + 0.3) % 1, legs: pick(r, [2, 4]), boldness: range(r, 0.1, 0.4), gen: 1, lastEaten: 0, lastLost: 0 },
    { name: `${genName(r, 2)} ${pick(r, hunters)}`, diet: 'hunter', size: range(r, 3, 5.5), speed: range(r, 22, 30), hue: (baseHue + 0.55) % 1, legs: pick(r, [4, 6]), boldness: range(r, 0.6, 1), gen: 1, lastEaten: 0, lastLost: 0 },
  ].map(g => ({ ...g, name: g.name[0].toUpperCase() + g.name.slice(1) })) as SpeciesGene[];
}

function buildCreature(g: SpeciesGene) {
  const obj = new THREE.Group();
  const body = new THREE.Group();
  obj.add(body);
  const s = g.size;
  const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(g.hue, 0.45, g.diet === 'hunter' ? 0.28 : 0.5), roughness: 0.7, flatShading: true });
  const belly = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((g.hue + 0.08) % 1, 0.35, 0.72), roughness: 0.8, flatShading: true });
  const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color(g.diet === 'hunter' ? 0xff3a2a : 0xaaffee).multiplyScalar(3) });
  const torso = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), skin);
  torso.scale.set(0.8, 0.7, 1.4);
  body.add(torso);
  const under = new THREE.Mesh(new THREE.SphereGeometry(s * 0.8, 8, 6), belly);
  under.scale.set(0.7, 0.45, 1.2);
  under.position.y = -s * 0.25;
  body.add(under);
  const head = new THREE.Mesh(new THREE.SphereGeometry(s * 0.55, 8, 6), skin);
  head.position.set(0, s * 0.35, -s * 1.45);
  body.add(head);
  for (const x of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(s * 0.12, 6, 4), eye);
    e.position.set(x * s * 0.25, s * 0.5, -s * 1.85);
    body.add(e);
  }
  if (g.diet === 'hunter') {
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(s * 0.14, s * 0.8, 4), belly);
      spike.position.set(0, s * 0.7, -s * 0.6 + i * s * 0.45);
      body.add(spike);
    }
  } else {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(s * 0.2, s * 1.4, 5), skin);
    tail.rotation.x = Math.PI / 2 + 0.4;
    tail.position.set(0, s * 0.1, s * 1.6);
    body.add(tail);
  }
  body.position.y = s * 1.1;
  const legs: THREE.Object3D[] = [];
  const legGeo = new THREE.CylinderGeometry(s * 0.12, s * 0.08, s * 1.2, 5).translate(0, -s * 0.6, 0);
  const pairs = g.legs / 2;
  for (let i = 0; i < pairs; i++) for (const x of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(x * s * 0.5, s * 1.0, pairs === 1 ? 0 : -s * 0.8 + (i / (pairs - 1)) * s * 1.6);
    hip.add(new THREE.Mesh(legGeo, skin));
    obj.add(hip);
    legs.push(hip);
  }
  return { obj, legs };
}
