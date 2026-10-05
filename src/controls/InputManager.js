// Entrada unificada: teclado e controle (Gamepad API).
// As ações são virtuais para facilitar remapeamento e futuros controles.
const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  Space: 'action',
  KeyK: 'action',
  KeyE: 'pass',
  KeyJ: 'pass',
  KeyC: 'jump',
  KeyX: 'crossover',
  KeyU: 'crossover',
  KeyQ: 'switch',
  KeyI: 'switch',
  Escape: 'pause',
  KeyP: 'pause',
  KeyR: 'reset',
  KeyT: 'defender',
  KeyF: 'freethrow',
  KeyH: 'hints',
};

const PAD_BUTTONS = {
  0: 'action',
  2: 'pass',
  1: 'crossover',
  3: 'switch',
  4: 'jump',
  5: 'sprint',
  7: 'sprint',
  6: 'jump',
  9: 'pause',
  8: 'reset',
};

export class InputManager {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.padDown = new Set();
    this.padAxes = { x: 0, y: 0 };
    this.enabled = true;
    this.onPausePressed = null;

    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.down.has(a)) this.pressed.add(a);
      this.down.add(a);
      if (a === 'pause' && this.onPausePressed) this.onPausePressed();
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.down.delete(a);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.padDown.clear();
    });
  }

  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && [...pads].find((p) => p && p.connected);
    if (!pad) {
      this.padAxes.x = 0;
      this.padAxes.y = 0;
      return;
    }
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    this.padAxes.x = dz(pad.axes[0] || 0);
    this.padAxes.y = dz(pad.axes[1] || 0);
    const now = new Set();
    pad.buttons.forEach((b, i) => {
      const a = PAD_BUTTONS[i];
      if (a && (b.pressed || b.value > 0.5)) now.add(a);
    });
    // direcional digital
    if (pad.buttons[12] && pad.buttons[12].pressed) this.padAxes.y = -1;
    if (pad.buttons[13] && pad.buttons[13].pressed) this.padAxes.y = 1;
    if (pad.buttons[14] && pad.buttons[14].pressed) this.padAxes.x = -1;
    if (pad.buttons[15] && pad.buttons[15].pressed) this.padAxes.x = 1;
    for (const a of now) {
      if (!this.padDown.has(a)) {
        this.pressed.add(a);
        if (a === 'pause' && this.onPausePressed) this.onPausePressed();
      }
    }
    this.padDown = now;
  }

  isDown(a) {
    return this.enabled && (this.down.has(a) || this.padDown.has(a));
  }

  wasPressed(a) {
    return this.enabled && this.pressed.has(a);
  }

  // Vetor de movimento em espaço de tela: x = direita, y = frente
  getMove() {
    let x = 0;
    let y = 0;
    if (this.isDown('left')) x -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('up')) y += 1;
    if (this.isDown('down')) y -= 1;
    if (this.enabled) {
      x += this.padAxes.x;
      y -= this.padAxes.y;
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  endFrame() {
    this.pressed.clear();
  }
}
