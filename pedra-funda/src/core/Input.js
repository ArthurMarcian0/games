// Teclado + mouse (com pointer lock) e mapeamento de ações.
export const BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE', 'Enter'],
  struggle: ['KeyE', 'Space'],
  inventory: ['Tab', 'KeyI'],
  map: ['KeyM'],
  reload: ['KeyR'],
  flashlight: ['KeyF'],
  quickturn: ['KeyQ'],
  pause: ['Escape', 'KeyP'],
  heal: ['KeyH'],
  aim: ['KeyC'],
  fire: ['KeyK'],
  w1: ['Digit1'],
  w2: ['Digit2'],
  w3: ['Digit3'],
};

const PREVENT = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  constructor(el) {
    this.el = el;
    this.down = new Set();
    this.hits = new Set();
    this.mdx = 0;
    this.mdy = 0;
    this.mb = [false, false, false];
    this.mbHit = [false, false, false];
    this.locked = false;
    this.onLockChange = null;
    this.onKey = null;

    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.hits.add(e.code);
      this.down.add(e.code);
      if (this.onKey) this.onKey(e);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mb.fill(false);
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        // ignora saltos absurdos que alguns navegadores geram ao travar o ponteiro
        if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
        this.mdx += e.movementX;
        this.mdy += e.movementY;
      }
    });
    el.addEventListener('mousedown', (e) => {
      if (e.button < 3) {
        this.mb[e.button] = true;
        this.mbHit[e.button] = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button < 3) this.mb[e.button] = false;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      if (!this.locked) this.mb.fill(false);
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  requestLock() {
    try {
      const p = this.el.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* navegador sem suporte */
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  is(action) {
    const codes = BINDINGS[action];
    for (let i = 0; i < codes.length; i++) if (this.down.has(codes[i])) return true;
    return false;
  }

  hit(action) {
    const codes = BINDINGS[action];
    for (let i = 0; i < codes.length; i++) if (this.hits.has(codes[i])) return true;
    return false;
  }

  clearAll() {
    this.down.clear();
    this.hits.clear();
    this.mb.fill(false);
    this.mbHit.fill(false);
    this.mdx = this.mdy = 0;
  }

  endFrame() {
    this.hits.clear();
    this.mbHit.fill(false);
    this.mdx = 0;
    this.mdy = 0;
  }
}
