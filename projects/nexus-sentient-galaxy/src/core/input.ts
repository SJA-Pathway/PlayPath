/**
 * Unified input: keyboard, mouse (pointer-lock virtual stick), and touch (virtual joystick + buttons).
 * Game code reads axes/buttons; nothing else touches DOM events.
 */
export class Input {
  private down = new Set<string>();
  private edges = new Set<string>();
  /** Virtual flight stick, -1..1 each axis (x = yaw, y = pitch). */
  stick = { x: 0, y: 0 };
  mouseFire = false;
  mouseAlt = false;
  locked = false;
  typing = false;
  touch = false;
  private touchKeys = new Set<string>();
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    addEventListener('keydown', e => {
      if (this.typing) return;
      if (!this.down.has(e.code)) this.edges.add(e.code);
      this.down.add(e.code);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); this.mouseFire = this.mouseAlt = false; });

    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) this.mouseFire = true;
      if (e.button === 2) this.mouseAlt = true;
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) this.mouseFire = false;
      if (e.button === 2) this.mouseAlt = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.stick.x = this.stick.y = 0; this.mouseFire = this.mouseAlt = false; }
    });
    addEventListener('mousemove', e => {
      if (!this.locked) return;
      const k = 0.0028;
      this.stick.x = Math.max(-1, Math.min(1, this.stick.x + e.movementX * k));
      this.stick.y = Math.max(-1, Math.min(1, this.stick.y + e.movementY * k));
    });
    this.touch = matchMedia('(pointer: coarse)').matches;
  }

  requestLock() {
    if (this.touch || this.locked) return;
    try { (this.canvas.requestPointerLock() as unknown as Promise<void> | undefined)?.catch?.(() => {}); } catch { /* unsupported */ }
  }
  releaseLock() { if (this.locked) document.exitPointerLock(); }

  held(code: string) { return !this.typing && (this.down.has(code) || this.touchKeys.has(code)); }
  pressed(code: string) { return !this.typing && this.edges.has(code); }
  tap(code: string) { this.edges.add(code); }
  setTouchKey(code: string, on: boolean) { if (on) { this.touchKeys.add(code); this.edges.add(code); } else this.touchKeys.delete(code); }
  clearAll() { this.down.clear(); this.touchKeys.clear(); this.edges.clear(); this.mouseFire = this.mouseAlt = false; }

  /** Mouse stick slowly re-centres so the ship doesn't spin forever. */
  endFrame(dt: number) {
    this.edges.clear();
    if (this.locked) {
      const k = Math.exp(-dt * 1.6);
      this.stick.x *= k; this.stick.y *= k;
    }
  }

  /** Bind an on-screen joystick element (touch devices). */
  bindJoystick(el: HTMLElement, knob: HTMLElement) {
    let id: number | null = null;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2 - 1, y = ((e.clientY - r.top) / r.height) * 2 - 1;
      const L = Math.hypot(x, y), s = L > 1 ? 1 / L : 1;
      this.stick.x = x * s; this.stick.y = y * s;
      knob.style.transform = `translate(${this.stick.x * 34}px, ${this.stick.y * 34}px)`;
    };
    el.addEventListener('pointerdown', e => { id = e.pointerId; el.setPointerCapture(e.pointerId); move(e); });
    el.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const end = (e: PointerEvent) => { if (e.pointerId !== id) return; id = null; this.stick.x = this.stick.y = 0; knob.style.transform = ''; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}
