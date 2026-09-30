import * as THREE from 'three';
import { rng, range } from '../core/rng';
import { planetMaterial, cloudMaterial, atmosphereMaterial, starMaterial, skyMaterial, glowTexture } from '../render/shaders';
import { planetsFor, type PlanetDef, type SystemDef } from './galaxy';

export interface PlanetBody {
  def: PlanetDef;
  root: THREE.Group;
  surface: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  clouds?: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  atmo: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  pos: THREE.Vector3;
}

export interface Station { root: THREE.Group; ring: THREE.Object3D; pos: THREE.Vector3; host: PlanetBody; offset: THREE.Vector3; name: string }

export interface Belt { mesh: THREE.InstancedMesh; radius: number; width: number; rocks: { p: THREE.Vector3; r: number }[] }

let sharedGlow: THREE.CanvasTexture | null = null;
const glow = () => (sharedGlow ??= glowTexture());

/** Everything visible in one star system. Pure view + simple orbital motion; gameplay lives elsewhere. */
export class SystemView {
  readonly group = new THREE.Group();
  readonly sky = new THREE.Group();
  readonly planets: PlanetBody[] = [];
  readonly starRadius: number;
  station: Station | null = null;
  belt: Belt | null = null;
  private starMat: THREE.ShaderMaterial;
  private corona: THREE.Sprite;
  private time = 0;
  readonly light: THREE.PointLight;

  constructor(readonly def: SystemDef) {
    const r = rng(def.seed);
    // Sky: procedural nebula shell + point stars. Follows the camera so it's "infinitely" far.
    const skyShell = new THREE.Mesh(new THREE.SphereGeometry(30000, 48, 24), skyMaterial(def.seed, r(), r()));
    skyShell.renderOrder = -10;
    this.sky.add(skyShell);
    this.sky.add(makeStarfield(def.seed));

    // Star
    this.starRadius = 150 * def.star.size;
    this.starMat = starMaterial(def.star.color);
    const star = new THREE.Mesh(new THREE.SphereGeometry(this.starRadius, 64, 32), this.starMat);
    this.group.add(star);
    this.corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: def.star.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
    this.corona.scale.setScalar(this.starRadius * 7);
    this.group.add(this.corona);
    this.light = new THREE.PointLight(def.star.light, 3.2, 0, 0);
    this.group.add(this.light);
    this.group.add(new THREE.AmbientLight(0x6a7a99, 0.22));

    // Planets
    for (const p of planetsFor(def)) {
      const root = new THREE.Group();
      const surface = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 96, 48), planetMaterial(p.look));
      root.add(surface);
      let clouds: PlanetBody['clouds'];
      if (p.clouds > 0.05) {
        clouds = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.015, 64, 32), cloudMaterial(p.look.seed, p.clouds, p.biome === 'toxic' ? 0xd8ff9a : 0xffffff));
        root.add(clouds);
      }
      const atmo = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.07, 64, 32), atmosphereMaterial(p.atmo, p.biome === 'gas' ? 0.7 : 1));
      root.add(atmo);
      if (p.ring) {
        const ringGeo = new THREE.RingGeometry(p.radius * 1.45, p.radius * 2.3, 128, 1);
        const ring = new THREE.Mesh(ringGeo, ringMaterial(p.look.seed));
        ring.rotation.x = Math.PI / 2 + range(r, -0.3, 0.3);
        root.add(ring);
      }
      surface.rotation.z = range(r, -0.3, 0.3);
      // faint orbit line
      const pts = Array.from({ length: 257 }, (_, k) => new THREE.Vector3(Math.cos((k / 256) * Math.PI * 2) * p.orbit, 0, Math.sin((k / 256) * Math.PI * 2) * p.orbit));
      const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7fe7ff, transparent: true, opacity: 0.06 }));
      orbit.rotation.z = p.incline;
      this.group.add(orbit, root);
      this.planets.push({ def: p, root, surface, clouds, atmo, pos: root.position });
    }

    // Asteroid belt between two inner planets
    if (this.planets.length >= 3 && r() < 0.8) {
      const a = this.planets[1].def.orbit, b = this.planets[2].def.orbit;
      this.belt = makeBelt(def.seed, (a + b) / 2, Math.min(160, (b - a) * 0.35));
      this.group.add(this.belt.mesh);
    }

    // Trading station orbiting an inhabited (or the second) planet
    if (def.station) {
      const host = this.planets.find(p => p.def.inhabited) ?? this.planets[Math.min(1, this.planets.length - 1)];
      const root = makeStation(def.id);
      const offset = new THREE.Vector3(host.def.radius * 2.6, host.def.radius * 0.4, 0);
      this.station = { root: root.group, ring: root.ring, pos: root.group.position, host, offset, name: `${host.def.name} Highport` };
      this.group.add(root.group);
    }
    this.update(0);
  }

  update(dt: number) {
    this.time += dt;
    const t = this.time;
    this.starMat.uniforms.uTime.value = t;
    this.corona.material.rotation = t * 0.01;
    for (const b of this.planets) {
      const p = b.def, a = p.phase + t * p.speed;
      b.root.position.set(Math.cos(a) * p.orbit, Math.sin(a) * p.orbit * p.incline, Math.sin(a) * p.orbit);
      b.surface.rotation.y = t * 0.02;
      b.surface.material.uniforms.uTime.value = t;
      b.atmo.material.uniforms.uSun.value.set(0, 0, 0);
      if (b.clouds) { b.clouds.material.uniforms.uTime.value = t; b.clouds.rotation.y = t * 0.026; }
    }
    if (this.belt) this.belt.mesh.rotation.y = t * 0.004;
    if (this.station) {
      const s = this.station;
      s.pos.copy(s.host.pos).add(s.offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), t * 0.05));
      s.ring.rotation.z = t * 0.2;
      s.root.lookAt(s.host.pos);
    }
  }

  /** World-space positions of belt rocks near a point (for collisions). */
  beltRocksNear(p: THREE.Vector3, radius: number, out: { p: THREE.Vector3; r: number }[]) {
    out.length = 0;
    if (!this.belt) return out;
    const d = Math.hypot(p.x, p.z);
    if (Math.abs(d - this.belt.radius) > this.belt.width + radius + 30) return out;
    const rot = this.belt.mesh.rotation.y, c = Math.cos(rot), s = Math.sin(rot);
    for (const rock of this.belt.rocks) {
      const x = rock.p.x * c + rock.p.z * s, z = -rock.p.x * s + rock.p.z * c;
      const dx = x - p.x, dy = rock.p.y - p.y, dz = z - p.z, rr = rock.r + radius;
      if (dx * dx + dy * dy + dz * dz < rr * rr) out.push({ p: new THREE.Vector3(x, rock.p.y, z), r: rock.r });
    }
    return out;
  }

  dispose() {
    const kill = (o: THREE.Object3D) => o.traverse(n => {
      const m = n as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach(x => x.dispose());
    });
    kill(this.group);
    kill(this.sky);
  }
}

function makeStarfield(seed: number) {
  const r = rng(seed + 11), n = 7000;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), d = 26000;
    pos.set([s * Math.cos(th) * d, u * d, s * Math.sin(th) * d], i * 3);
    const t = r(), b = 0.5 + r() * 0.9;
    const c = t < 0.15 ? [1, 0.75, 0.55] : t < 0.35 ? [0.7, 0.8, 1] : [1, 1, 1];
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, depthWrite: false, transparent: true }));
}

function ringMaterial(seed: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uSeed: { value: (seed % 97) / 97 } },
    vertexShader: `varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uSeed; varying vec3 vP;
      float h(float x){ return fract(sin(x * 91.7 + uSeed * 13.) * 43758.5); }
      void main(){
        float d = length(vP.xy); float t = fract(d * .045);
        float bands = .45 + .55 * h(floor(d * .7));
        float a = bands * smoothstep(0., .08, t) * .55;
        gl_FragColor = vec4(vec3(.85, .78, .66) * bands * .8, a);
      }`,
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
  });
}

function makeBelt(seed: number, radius: number, width: number): Belt {
  const r = rng(seed + 77), n = 1400;
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pa = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pa, i);
    v.multiplyScalar(0.75 + Math.sin(v.x * 3.1 + v.y * 1.7) * 0.15 + Math.cos(v.z * 2.3) * 0.12);
    pa.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a8078, roughness: 0.95, metalness: 0.05, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
  const rocks: Belt['rocks'] = [];
  const tint = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = radius + (r() - 0.5) * 2 * width * Math.sqrt(r());
    const p = new THREE.Vector3(Math.cos(a) * d, (r() - 0.5) * width * 0.25, Math.sin(a) * d);
    const size = r() < 0.04 ? range(r, 18, 34) : range(r, 2, 10);
    s.set(size * range(r, 0.7, 1.3), size * range(r, 0.6, 1.1), size * range(r, 0.7, 1.4));
    q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6));
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, tint.setHSL(0.07 + r() * 0.05, 0.12 + r() * 0.1, 0.25 + r() * 0.2));
    rocks.push({ p, r: size * 0.9 });
  }
  mesh.instanceMatrix.needsUpdate = true;
  return { mesh, radius, width, rocks };
}

function makeStation(id: number) {
  const group = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xb8c4d4, metalness: 0.7, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3446, metalness: 0.6, roughness: 0.5 });
  const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe7ff).multiplyScalar(3) });
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb547).multiplyScalar(3) });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 70, 16), hull);
  core.rotation.x = Math.PI / 2;
  group.add(core);
  const ring = new THREE.Group();
  const torus = new THREE.Mesh(new THREE.TorusGeometry(42, 5, 12, 48), dark);
  ring.add(torus);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(2.4, 40, 2.4), hull);
    spoke.rotation.z = (i / 6) * Math.PI * 2;
    spoke.position.set(Math.cos((i / 6) * Math.PI * 2 + Math.PI / 2) * 21, Math.sin((i / 6) * Math.PI * 2 + Math.PI / 2) * 21, 0);
    ring.add(spoke);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 4), i % 4 === 0 ? warm : lit);
    l.position.set(Math.cos(a) * 42, Math.sin(a) * 42, 5.2);
    ring.add(l);
  }
  group.add(ring);
  // docking bay light strip
  for (let i = 0; i < 8; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 3), lit);
    l.position.set(i % 2 ? 6 : -6, 0, -36 + i * 0.1 - (i >> 1) * 5);
    group.add(l);
  }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), hull);
  dish.position.z = 36;
  dish.rotation.x = -Math.PI / 2;
  group.add(dish);
  group.userData.stationId = id;
  return { group, ring };
}
