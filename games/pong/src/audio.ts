import type { SoundKind } from "./game.js";

/**
 * Minimal WebAudio sound synth — no asset files. The AudioContext is created
 * lazily so it starts after a user gesture (autoplay policy).
 */
export class PongAudio {
  private ctx: AudioContext | null = null;

  private ensure(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Call from a user gesture (e.g. first Start press) to satisfy autoplay rules. */
  unlock(): void {
    this.ensure();
  }

  play(kind: SoundKind): void {
    switch (kind) {
      case "wall":
        this.beep(220, 40, "square", 0.08);
        break;
      case "paddle":
        this.beep(440, 55, "square", 0.1);
        break;
      case "score":
        this.beep(330, 90, "triangle", 0.12);
        this.beep(220, 140, "triangle", 0.12, 90);
        break;
      case "win":
        this.beep(440, 110, "square", 0.12, 0);
        this.beep(554, 110, "square", 0.12, 110);
        this.beep(660, 200, "square", 0.12, 220);
        break;
    }
  }

  playAll(events: SoundKind[]): void {
    for (const e of events) this.play(e);
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
}
