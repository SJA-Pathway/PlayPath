import { rng } from '../core/rng';

/**
 * Procedural adaptive soundtrack + synthesized SFX, all Web Audio (no audio files to download).
 * Layers: a detuned pad (always), a pentatonic arpeggio (density follows tension),
 * and a pulse/percussion layer that fades in during combat. Each star system retunes the key.
 */
export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private padFilter!: BiquadFilterNode;
  private pads: OscillatorNode[] = [];
  private engine!: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode };
  private noise!: AudioBuffer;
  private root = 55;
  private scale = [0, 3, 5, 7, 10];
  private arpT = 0;
  private beatT = 0;
  private step = 0;
  muted = false;
  intensity = 0;

  init() {
    if (this.ctx) { void this.ctx.resume(); return; }
    try { this.ctx = new AudioContext(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = 0.55; this.music.connect(comp);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.7; this.sfx.connect(comp);
    // reverb-ish feedback delay for space
    const delay = c.createDelay(1); delay.delayTime.value = 0.38;
    const fb = c.createGain(); fb.gain.value = 0.35;
    const wet = c.createGain(); wet.gain.value = 0.3;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.music);
    this.music.connect(delay);

    this.padFilter = c.createBiquadFilter(); this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 500; this.padFilter.Q.value = 2;
    this.padFilter.connect(this.music);
    for (let i = 0; i < 4; i++) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = i < 2 ? 'sawtooth' : 'triangle';
      g.gain.value = i < 2 ? 0.05 : 0.04;
      o.connect(g); g.connect(this.padFilter); o.start();
      this.pads.push(o);
    }
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const eo = c.createOscillator(), eg = c.createGain(), ef = c.createBiquadFilter();
    eo.type = 'sawtooth'; eo.frequency.value = 40; ef.type = 'lowpass'; ef.frequency.value = 200; eg.gain.value = 0;
    eo.connect(ef); ef.connect(eg); eg.connect(this.sfx); eo.start();
    this.engine = { osc: eo, gain: eg, filter: ef };
    this.retune();
  }

  setSystem(seed: number, danger: number) {
    const r = rng(seed + 7);
    this.root = 41.2 * Math.pow(2, Math.floor(r() * 12) / 12);
    this.scale = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 3, 7, 8], [0, 1, 5, 7, 8]][danger] ?? this.scale;
    this.retune();
  }

  setSurface(on: boolean) {
    if (!this.ctx) return;
    this.padFilter.frequency.setTargetAtTime(on ? 1200 : 500, this.ctx.currentTime, 1);
  }

  private retune() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, f = this.root;
    const notes = [f, f * 1.004, f * Math.pow(2, this.scale[2] / 12) * 2, f * Math.pow(2, this.scale[3] / 12) * 2];
    this.pads.forEach((o, i) => o.frequency.setTargetAtTime(notes[i], t, 2));
  }

  toggleMute() {
    if (!this.ctx) return;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.1);
    return this.muted;
  }

  update(dt: number, intensity: number, engine: number, boost: boolean) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    this.intensity += (intensity - this.intensity) * Math.min(1, dt * 0.8);
    const k = this.intensity;
    this.padFilter.frequency.setTargetAtTime(420 + k * 1600 + Math.sin(t * 0.2) * 150, t, 0.4);
    this.engine.osc.frequency.setTargetAtTime(32 + engine * 60 + (boost ? 25 : 0), t, 0.2);
    this.engine.filter.frequency.setTargetAtTime(120 + engine * 500 + (boost ? 600 : 0), t, 0.2);
    this.engine.gain.gain.setTargetAtTime(0.02 + engine * 0.07 + (boost ? 0.05 : 0), t, 0.2);

    // arpeggio: sparse when calm, a driving 16th pattern in combat
    this.arpT -= dt;
    if (this.arpT <= 0) {
      this.arpT = k > 0.45 ? 0.14 : 0.55 + Math.random() * 1.2;
      const n = this.scale[(this.step * 3 + (k > 0.45 ? this.step : Math.floor(Math.random() * 5))) % this.scale.length] + 12 * (1 + (this.step % 2));
      this.pluck(this.root * 2 * Math.pow(2, n / 12), k > 0.45 ? 0.045 : 0.06, k > 0.45 ? 0.25 : 1.8);
      this.step++;
    }
    if (k > 0.35) {
      this.beatT -= dt;
      if (this.beatT <= 0) {
        this.beatT = 0.28;
        this.kick(0.25 * Math.min(1, (k - 0.35) * 3));
      }
    }
  }

  private pluck(freq: number, vol: number, dur: number) {
    const c = this.ctx!, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.05);
  }

  private kick(vol: number) {
    const c = this.ctx!, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.3);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number) {
    if (!this.ctx || vol < 0.003) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
  }

  private noiseHit(dur: number, vol: number, freq: number) {
    if (!this.ctx || vol < 0.003) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(60, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t); s.stop(t + dur);
  }

  /** Distance-attenuated SFX; `dist` in world units from the camera. */
  play(kind: string, dist = 0, own = false) {
    if (!this.ctx) return;
    const att = own ? 1 : Math.max(0, 1 - dist / 2200) ** 2;
    switch (kind) {
      case 'laser': this.tone('square', own ? 1500 : 1100, 180, 0.11, 0.05 * att); break;
      case 'missile': this.noiseHit(0.8, 0.12 * att, 2400); this.tone('sawtooth', 300, 900, 0.5, 0.04 * att); break;
      case 'hit': this.noiseHit(0.12, 0.1 * att, 1800); break;
      case 'boom': this.noiseHit(0.9, 0.35 * att, 1400); this.tone('sine', 90, 30, 0.6, 0.25 * att); break;
      case 'bigboom': this.noiseHit(2.2, 0.5 * att, 900); this.tone('sine', 60, 20, 1.6, 0.35 * att); break;
      case 'shieldhit': this.tone('sine', 900, 400, 0.15, 0.08); break;
      case 'hullhit': this.noiseHit(0.25, 0.25, 700); this.tone('square', 140, 60, 0.2, 0.06); break;
      case 'chime': this.tone('sine', 660, 1320, 0.35, 0.08); setTimeout(() => this.tone('sine', 990, 1980, 0.4, 0.06), 90); break;
      case 'warp': this.tone('sawtooth', 50, 1200, 2.2, 0.1); this.noiseHit(2.4, 0.15, 3000); break;
      case 'dock': this.tone('triangle', 330, 440, 0.25, 0.08); setTimeout(() => this.tone('triangle', 440, 660, 0.3, 0.08), 150); break;
      case 'lock': this.tone('square', 1800, 1800, 0.06, 0.04); break;
      case 'locked': this.tone('square', 2400, 2400, 0.25, 0.05); break;
      case 'alarm': this.tone('square', 700, 500, 0.3, 0.06); break;
      case 'ui': this.tone('sine', 880, 1100, 0.06, 0.04); break;
      case 'overheat': this.tone('sawtooth', 400, 120, 0.5, 0.08); break;
    }
  }
}
