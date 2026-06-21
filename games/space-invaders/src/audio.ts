import type { SoundKind } from "./game.js";

/**
 * Minimal WebAudio sound synth — no asset files. The AudioContext is created
 * lazily so it starts after a user gesture (autoplay policy).
 */
export class SIAudio {
  private ctx: AudioContext | null = null;
  private saucerOsc: OscillatorNode | null = null;
  private saucerLfo: OscillatorNode | null = null;

  private ensure(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Call from a user gesture (e.g. first Start press) to satisfy autoplay rules. */
  unlock(): void {
    this.ensure();
  }

  setSaucerActive(active: boolean): void {
    if (active) this.startSaucer();
    else this.stopSaucer();
  }

  dispose(): void {
    this.stopSaucer();
    void this.ctx?.close();
    this.ctx = null;
  }

  playAll(events: SoundKind[]): void {
    for (const e of events) {
      if (e === "saucerLoop") continue;
      this.play(e);
    }
  }

  private play(kind: SoundKind): void {
    switch (kind) {
      case "shoot":
        this.beep(680, 30, "square", 0.06);
        break;
      case "alienHit":
        this.noise(300, 80, 0.09);
        break;
      case "playerHit":
        this.beep(120, 150, "sawtooth", 0.14);
        this.beep(90, 200, "triangle", 0.1, 40);
        break;
      case "shieldHit":
        this.beep(800, 12, "square", 0.04);
        break;
      case "saucerHit":
        this.beep(440, 100, "square", 0.12);
        this.beep(554, 100, "square", 0.1, 80);
        this.beep(660, 160, "square", 0.08, 160);
        break;
      case "waveClear":
        this.beep(330, 110, "square", 0.1, 0);
        this.beep(440, 110, "square", 0.1, 100);
        this.beep(554, 110, "square", 0.1, 200);
        this.beep(660, 200, "square", 0.1, 300);
        break;
      case "gameOver":
        this.beep(440, 180, "square", 0.12, 0);
        this.beep(330, 180, "square", 0.1, 160);
        this.beep(220, 300, "square", 0.12, 320);
        break;
      case "victory":
        this.beep(440, 120, "square", 0.11, 0);
        this.beep(554, 120, "square", 0.11, 110);
        this.beep(660, 120, "square", 0.11, 220);
        this.beep(880, 120, "square", 0.11, 330);
        this.beep(660, 120, "square", 0.11, 440);
        this.beep(880, 300, "square", 0.12, 550);
        break;
      default:
        break;
    }
  }

  private startSaucer(): void {
    if (this.saucerOsc) return;
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(6, ctx.currentTime);
    lfoGain.gain.setValueAtTime(40, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    lfo.start();

    this.saucerOsc = osc;
    this.saucerLfo = lfo;
  }

  private stopSaucer(): void {
    for (const osc of [this.saucerOsc, this.saucerLfo]) {
      if (!osc) continue;
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.saucerOsc = null;
    this.saucerLfo = null;
  }

  private beep(freq: number, durMs: number, type: OscillatorType, gain: number, delayMs = 0): void {
    const ctx = this.ensure();
    const t0 = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(env).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.02);
  }

  private noise(durMs: number, _freq: number, gain: number): void {
    const ctx = this.ensure();
    const t0 = ctx.currentTime;
    // Create a noise-like sound using detuned square waves
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "square";
      const f = 200 + Math.random() * 200;
      osc.frequency.setValueAtTime(f, t0);
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(gain / 3, t0 + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
      osc.connect(env).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + durMs / 1000 + 0.02);
    }
  }
}
