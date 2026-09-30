/** Per-browser persistence. Everything the galaxy "remembers" about the player lives here. */
export interface NpcMemory { playerName: string | null; visits: number; rep: number; facts: string[]; soldScan: boolean; gifted: boolean; history: { role: 'user' | 'assistant'; content: string }[]; said?: number[] }
export interface SpeciesGene { name: string; diet: 'grazer' | 'hunter'; size: number; speed: number; hue: number; legs: number; boldness: number; gen: number; lastEaten: number; lastLost: number }
export interface Contract { id: string; kind: 'bounty' | 'survey' | 'courier' | 'fauna'; title: string; system: number; target: number; progress: number; reward: number; faction: number; expires: number }

export interface SaveData {
  version: 2;
  pilot: string;
  color: number;
  credits: number;
  system: number;
  hull: number;
  missiles: number;
  upgrades: { laser: number; shield: number; engine: number; rack: number };
  factionRep: [number, number, number];
  visited: Record<number, 1>;
  scanned: Record<string, 1>;
  bestiary: Record<string, { name: string; planet: string; gen: number; tamed?: boolean }>;
  species: Record<string, SpeciesGene[]>;
  npc: Record<string, NpcMemory>;
  contracts: Contract[];
  codex: { t: number; tag: string; text: string }[];
  kills: number;
  playtime: number;
}

const KEY = 'nexus-save-v2';

export function freshSave(): SaveData {
  return {
    version: 2, pilot: '', color: 0x7fe7ff, credits: 150, system: 0, hull: 100, missiles: 6,
    upgrades: { laser: 0, shield: 0, engine: 0, rack: 0 },
    factionRep: [0, -20, 0], visited: {}, scanned: {}, bestiary: {}, species: {}, npc: {},
    contracts: [], codex: [], kills: 0, playtime: 0,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.version === 2) return Object.assign(freshSave(), s);
    }
  } catch { /* storage blocked or corrupt */ }
  return freshSave();
}

let pending = 0;
export function persist(s: SaveData, immediate = false) {
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };
  if (immediate) { write(); return; }
  clearTimeout(pending);
  pending = window.setTimeout(write, 400);
}

export function wipeSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
