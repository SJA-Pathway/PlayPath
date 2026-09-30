import { rng, pick, range, genName, type Rng } from '../core/rng';
import type { Biome, PlanetLook } from '../render/shaders';

export interface Faction { id: number; name: string; short: string; color: number; css: string; vibe: string }
export const FACTIONS: Faction[] = [
  { id: 0, name: 'Veyl Concord', short: 'Concord', color: 0x6fb8ff, css: '#6fb8ff', vibe: 'orderly traders who keep the jump lanes open and pay bounties on pirates' },
  { id: 1, name: 'Ashen Syndicate', short: 'Syndicate', color: 0xff4d5e, css: '#ff4d5e', vibe: 'smugglers and raiders who run the pirate drone fleets' },
  { id: 2, name: 'Drift Choir', short: 'Choir', color: 0xc9a0ff, css: '#c9a0ff', vibe: 'nomad mystics who read the stars like sheet music and trade in secrets' },
];

export interface StarDef { cls: string; color: number; light: number; size: number }
const STARS: StarDef[] = [
  { cls: 'G', color: 0xffe2a8, light: 0xfff1d6, size: 1 },
  { cls: 'K', color: 0xffb070, light: 0xffd2a0, size: 0.85 },
  { cls: 'M', color: 0xff7a4a, light: 0xffb48c, size: 0.65 },
  { cls: 'F', color: 0xfff6e0, light: 0xffffff, size: 1.15 },
  { cls: 'A', color: 0xcfe0ff, light: 0xe6efff, size: 1.35 },
  { cls: 'B', color: 0x9fbcff, light: 0xc8d8ff, size: 1.6 },
];

export interface SystemDef {
  id: number; name: string; x: number; y: number; seed: number;
  danger: 0 | 1 | 2 | 3; faction: number; star: StarDef; station: boolean; links: number[];
}

export const DANGER = ['Secure', 'Patrolled', 'Contested', 'Pirate-held'] as const;

export const GALAXY: SystemDef[] = (() => {
  const r = rng(90210);
  const out: SystemDef[] = [];
  const names = new Set<string>();
  while (out.length < 48) {
    const arm = out.length % 3;
    const t = Math.pow(r(), 0.8);
    const ang = arm * (Math.PI * 2 / 3) + t * 4.2 + range(r, -0.28, 0.28);
    const x = 0.5 + Math.cos(ang) * t * 0.46;
    const y = 0.5 + Math.sin(ang) * t * 0.46 * 0.62;
    if (out.some(o => Math.hypot(o.x - x, (o.y - y) / 0.62) < 0.045)) continue;
    let name = genName(r, 2);
    while (names.has(name)) name = genName(r, 2);
    names.add(name);
    const danger = (t < 0.25 ? Math.floor(r() * 2) : Math.floor(r() * 4)) as 0 | 1 | 2 | 3;
    out.push({
      id: out.length, name: `${name}-${1 + Math.floor(r() * 9)}`, x, y, seed: Math.floor(r() * 1e9),
      danger, faction: danger === 3 ? 1 : r() < 0.62 ? 0 : 2, star: pick(r, STARS), station: danger < 3 || r() < 0.3, links: [],
    });
  }
  // Jump lanes: each system links to its 3 nearest neighbours (symmetric).
  for (const s of out) {
    const near = out.filter(o => o !== s).sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y)).slice(0, 3);
    for (const n of near) { if (!s.links.includes(n.id)) s.links.push(n.id); if (!n.links.includes(s.id)) n.links.push(s.id); }
  }
  out[0].danger = 1; out[0].faction = 0; out[0].station = true;
  return out;
})();

export const lightYears = (a: SystemDef, b: SystemDef) => Math.hypot(a.x - b.x, a.y - b.y) * 120;

/* ---------------- planets ---------------- */

export interface AlienDef { id: string; name: string; species: string; temper: string; faction: number }
export interface PlanetDef {
  id: string; index: number; name: string; biome: Biome; radius: number; orbit: number; phase: number; speed: number; incline: number;
  look: PlanetLook; clouds: number; ring: boolean; atmo: number; inhabited: boolean; hazard: string; alien: AlienDef; lore: string; landable: boolean;
}

export const BIOME_LABEL: Record<Biome, string> = { lava: 'Volcanic', ice: 'Glacial', ocean: 'Oceanic', jungle: 'Jungle', desert: 'Arid', gas: 'Gas giant', toxic: 'Toxic' };

const PALETTES: Record<Biome, { colors: [number, number, number, number][]; sea: [number, number]; ice: number; atmo: number[]; glow: number; clouds: [number, number] }> = {
  lava: { colors: [[0x100503, 0x1c0906, 0x2a120c, 0x4a2418], [0x0d0d10, 0x1a1414, 0x2b1d18, 0x3e2a22]], sea: [0.0, 0.0], ice: 2, atmo: [0xff6a2a, 0xff9340], glow: 0xff5a14, clouds: [0, 0.15] },
  ice: { colors: [[0x2a4a6a, 0x5f8fb0, 0xa9c7da, 0xf2f8ff], [0x3a5068, 0x7aa0bc, 0xc8dbe8, 0xffffff]], sea: [0.3, 0.42], ice: 0.35, atmo: [0xbfe6ff, 0xd8f0ff], glow: 0, clouds: [0.2, 0.4] },
  ocean: { colors: [[0x031a38, 0x0f5a8a, 0xc9b47a, 0x2f6b34], [0x04203a, 0x1880a0, 0xd8c890, 0x507a3a]], sea: [0.55, 0.64], ice: 0.84, atmo: [0x5fb0ff, 0x7ac8ff], glow: 0, clouds: [0.4, 0.62] },
  jungle: { colors: [[0x0a2a30, 0x1a5a50, 0x1f4f24, 0x7a9a3e], [0x10242a, 0x245e5a, 0x2a5a1e, 0x9aa850]], sea: [0.3, 0.42], ice: 0.9, atmo: [0x8dffb0, 0xb0ffd0], glow: 0, clouds: [0.45, 0.65] },
  desert: { colors: [[0x3a2010, 0x5a3418, 0x9a6a3a, 0xe8c690], [0x40180c, 0x6a2a14, 0xb05a30, 0xf0a870]], sea: [0.1, 0.2], ice: 0.9, atmo: [0xffd49a, 0xffb080], glow: 0, clouds: [0.05, 0.2] },
  gas: { colors: [[0xd8b48a, 0x8a5a3a, 0xf0e0c8, 0xc04a2a], [0x8ab0d8, 0x3a5a8a, 0xe0f0ff, 0x2a4ac0], [0xc8d890, 0x6a7a3a, 0xf0f8d0, 0x9a5a2a]], sea: [0, 0], ice: 2, atmo: [0xffe0c0, 0xc0d8ff], glow: 0, clouds: [0, 0] },
  toxic: { colors: [[0x1a2a08, 0x3a5a10, 0x5a6a20, 0xb0c040], [0x201a30, 0x40306a, 0x5a4a30, 0xa0b050]], sea: [0.4, 0.5], ice: 2, atmo: [0xc8ff60, 0xa0ff80], glow: 0x9aff40, clouds: [0.5, 0.75] },
};

const SPECIES = ['Vhorn', 'Quellari', 'Oszithe', 'Brannock', 'Myrr', 'Tal-Esh', 'Kiyuu', 'Serrat', 'Oombi', 'Lissan'];
const TEMPERS = ['wary', 'jovial', 'cryptic', 'mercantile', 'proud', 'melancholy'];
const FEATURES: Record<Biome, string[]> = {
  lava: ['rivers of glass that cool into singing spires', 'a mantle that breathes every forty hours', 'forges built inside living volcanoes'],
  ice: ['cities carved under a kilometre of ice', 'auroras that repeat the same pattern every night', 'frozen leviathans older than the Concord'],
  ocean: ['floating reef-cities that migrate with the tides', 'a planet-wide current nobody has mapped end to end', 'bioluminescent storms'],
  jungle: ['trees that trade nutrients by lightning', 'ruins swallowed by ninety-metre ferns', 'predators that hunt in harmonised packs'],
  desert: ['dunes that hide buried starships', 'glass flats left by an orbital war', 'caravans that only travel during eclipses'],
  gas: ['drifting harvester platforms in the upper cloud deck', 'a storm the size of three moons', 'sky-whales feeding on ammonia plankton'],
  toxic: ['acid fens that glow at night', 'spore towers that broadcast on radio frequencies', 'a quarantine beacon nobody remembers setting'],
};

function genLore(r: Rng, p: { name: string; biome: Biome; inhabited: boolean }, alien: AlienDef): string {
  const f = pick(r, FEATURES[p.biome]);
  const age = pick(r, ['a young world', 'an ancient world', 'a world scarred by old wars', 'a quiet backwater', 'a pilgrimage world']);
  const pop = p.biome === 'gas' ? `Only orbital habitats survive here, home to a few million ${alien.species}.`
    : p.inhabited ? `About ${(1 + Math.floor(r() * 90)) / 10} billion ${alien.species} live on the surface.`
    : `A small ${alien.species} outpost watches over the surface.`;
  const fac = FACTIONS[alien.faction];
  return `${p.name} is ${age}, known for ${f}. ${pop} The ${fac.name} holds the orbital rights; they are ${fac.vibe}.`;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const cache = new Map<number, PlanetDef[]>();

export function planetsFor(sys: SystemDef): PlanetDef[] {
  if (cache.has(sys.id)) return cache.get(sys.id)!;
  const r = rng(sys.seed ^ 0x5bd1e995);
  const count = 3 + Math.floor(r() * 4);
  const biomes: Biome[] = ['lava', 'ice', 'ocean', 'jungle', 'desert', 'toxic'];
  const out: PlanetDef[] = [];
  let orbit = 520 + r() * 120;
  for (let i = 0; i < count; i++) {
    const outer = i >= count - 2;
    let biome: Biome = outer && r() < 0.65 ? 'gas' : pick(r, i === 0 ? ['lava', 'desert', 'toxic'] as Biome[] : biomes);
    if (i > 2 && biome === 'lava') biome = 'ice';
    const pal = PALETTES[biome];
    const radius = biome === 'gas' ? range(r, 90, 150) : range(r, 34, 70);
    const inhabited = biome !== 'gas' && biome !== 'lava' && r() < 0.55;
    const alien: AlienDef = {
      id: `npc-${sys.id}-${i}`, name: genName(r, 2 + Math.floor(r() * 2)), species: pick(r, SPECIES), temper: pick(r, TEMPERS),
      faction: r() < 0.7 ? sys.faction : Math.floor(r() * 3),
    };
    const name = `${sys.name.split('-')[0]} ${ROMAN[i]}`;
    const p: PlanetDef = {
      id: `${sys.id}:${i}`, index: i, name, biome, radius, orbit, phase: r() * Math.PI * 2,
      speed: (0.012 + r() * 0.01) / (1 + i * 0.7), incline: range(r, -0.05, 0.05),
      look: {
        biome, seed: Math.floor(r() * 1e6), colors: pick(r, pal.colors), sea: range(r, pal.sea[0], pal.sea[1]), ice: pal.ice + range(r, -0.05, 0.05),
        city: inhabited ? 1 : 0, glow: pal.glow, freq: biome === 'gas' ? 1.2 : range(r, 1.4, 2.4),
      },
      clouds: range(r, pal.clouds[0], pal.clouds[1]), ring: biome === 'gas' && r() < 0.6, atmo: pick(r, pal.atmo), inhabited,
      hazard: pick(r, biome === 'lava' || biome === 'toxic' ? ['High', 'Extreme'] : ['Low', 'Moderate', 'High']), alien, lore: '',
      landable: biome !== 'gas',
    };
    p.lore = genLore(r, p, alien);
    out.push(p);
    orbit += range(r, 420, 640) + (biome === 'gas' ? radius * 2 : 0);
  }
  cache.set(sys.id, out);
  return out;
}
