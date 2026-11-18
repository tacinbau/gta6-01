// Sound: everything is synthesized with WebAudio — no audio files.
// Engine hum follows the car's speed, a two-tone siren follows the
// wanted level, and short blips, thuds and jingles mark pickups,
// crashes and finished jobs. A quiet bass line loops underneath.
// Nothing starts until the player interacts (click or Enter), because
// browsers block audio before a gesture. M toggles mute.

const BASS_LINE = [
  55, 0, 55, 65.41, 49, 0, 55, 82.41,
  55, 0, 55, 65.41, 98, 0, 82.41, 73.42,
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenLfo = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);

      // Engine: a sawtooth through a lowpass, quiet at idle.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 42;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();

      // Siren: one square wave whose pitch wobbles between two tones
      // on a slow square LFO — the classic two-tone wail.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 780;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'square';
      this.sirenLfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 140;
      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
      return true;
    } catch (err) {
      this.ctx = null;
      return false;
    }
  }

  start() {
    if (!this.ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.musicTimer) {
      this.musicTimer = window.setInterval(() => this.musicTick(), 240);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  // Called every frame: engine pitch and loudness follow the car.
  setEngine(speed, inCar) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const s = Math.abs(speed);
    const freq = 42 + s * 0.22;
    const gain = inCar ? 0.03 + Math.min(0.06, s * 0.00012) : 0;
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
    this.engineGain.gain.setTargetAtTime(gain, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(280 + s * 1.1, t, 0.1);
  }

  // Siren volume follows the wanted level and how close the nearest
  // cruiser is; silent when the heat is off.
  setSiren(wanted, nearestDist) {
    if (!this.ctx || !this.sirenGain) return;
    const t = this.ctx.currentTime;
    let gain = 0;
    if (wanted >= 1) {
      const closeness = Math.max(0, Math.min(1, 1 - nearestDist / 900));
      gain = 0.012 + wanted * 0.006 + closeness * 0.03;
    }
    this.sirenGain.gain.setTargetAtTime(gain, t, 0.2);
  }

  blip() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(990, t + 0.09);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  thud(strength) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const vol = Math.min(0.5, 0.12 + strength * 0.001);
    // Noise burst through a lowpass: the impact.
    const len = Math.floor(this.ctx.sampleRate * 0.18);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(t);
    // Low sine drop underneath, for body.
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(vol * 0.8, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(og);
    og.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  note(freq, at, dur, type, vol) {
    const osc = this.ctx.createOscillator();
    osc.type = type || 'triangle';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(vol || 0.14, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  jingle() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.02;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.note(f, t + i * 0.11, 0.32, 'triangle', 0.16));
    this.note(1318.5, t + 0.48, 0.5, 'triangle', 0.14);
  }

  fail() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.02;
    [329.63, 261.63, 196].forEach((f, i) => this.note(f, t + i * 0.16, 0.3, 'sawtooth', 0.08));
  }

  musicTick() {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state !== 'running') return;
    const freq = BASS_LINE[this.musicStep % BASS_LINE.length];
    this.musicStep++;
    if (!freq) return;
    this.note(freq, this.ctx.currentTime + 0.02, 0.22, 'triangle', 0.07);
  }
}
