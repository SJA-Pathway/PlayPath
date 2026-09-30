/** Tiny event bus + the in-game Codex chronicle. */
type Handler<T> = (v: T) => void;

export class Emitter<Events extends Record<string, unknown>> {
  private map = new Map<keyof Events, Set<Handler<never>>>();
  on<K extends keyof Events>(k: K, fn: Handler<Events[K]>) {
    if (!this.map.has(k)) this.map.set(k, new Set());
    this.map.get(k)!.add(fn as Handler<never>);
    return () => this.map.get(k)!.delete(fn as Handler<never>);
  }
  emit<K extends keyof Events>(k: K, v: Events[K]) {
    this.map.get(k)?.forEach(fn => (fn as Handler<Events[K]>)(v));
  }
}

export type LogTag = 'nav' | 'scan' | 'combat' | 'gm' | 'trade' | 'comms' | 'fauna' | 'net' | 'sys' | 'contract';

export interface GameEvents extends Record<string, unknown> {
  log: { tag: LogTag; text: string; codex?: boolean };
  toast: { text: string; kind?: 'good' | 'bad' | 'info' };
  kill: { faction: string; system: number; by: 'player' | 'ai' };
  scan: { planetId: string; system: number };
  creature: { species: string; system: number };
  dock: { system: number };
}

export const bus = new Emitter<GameEvents>();
export const log = (tag: LogTag, text: string, codex = false) => bus.emit('log', { tag, text, codex });
export const toast = (text: string, kind: 'good' | 'bad' | 'info' = 'info') => bus.emit('toast', { text, kind });
