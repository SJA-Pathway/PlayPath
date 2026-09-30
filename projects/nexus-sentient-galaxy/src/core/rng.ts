/** Deterministic PRNG (mulberry32) so every star system is the same for every player. */
export type Rng = () => number;

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const SYL = ['ka', 've', 'thra', 'lo', 'zu', 'mir', 'ex', 'ob', 'sar', 'qel', 'ny', 'dra', 'os', 'yl', 'tor', 'vi', 'ash', 'en', 'ur', 'khe', 'ri', 'pho', 'an', 'ix'];
export function genName(r: Rng, syllables: number): string {
  let s = '';
  for (let i = 0; i < syllables; i++) s += pick(r, SYL);
  return s[0].toUpperCase() + s.slice(1);
}

/** 2D value noise for CPU-side terrain. */
export function makeNoise2(r: Rng) {
  const p = new Uint8Array(512);
  const v = new Float32Array(256);
  for (let i = 0; i < 256; i++) { p[i] = i; v[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  const h = (x: number, y: number) => v[p[p[x & 255] + (y & 255)]];
  const n = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
  return (x: number, y: number, octaves = 5) => {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < octaves; o++) { s += amp * n(x * f, y * f); norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
  };
}
