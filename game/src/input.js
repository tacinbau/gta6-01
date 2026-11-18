// Keyboard input: a live key set plus edge-triggered "just pressed"
// events so E, Space, Esc and P fire once per tap, not once per frame.

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.anyKey = false;
    this.onKeyDown = (event) => {
      const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
      if (gameKeys.includes(event.code)) event.preventDefault();
      if (!event.repeat) {
        this.pressed.add(event.code);
        this.anyKey = true;
      }
      this.down.add(event.code);
    };
    this.onKeyUp = (event) => {
      this.down.delete(event.code);
    };
    this.onBlur = () => {
      this.down.clear();
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Movement axes, normalised: WASD and arrows both work.
  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  get sprint() {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }

  endFrame() {
    this.pressed.clear();
    this.anyKey = false;
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
