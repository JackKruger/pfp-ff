import type { SoundKind } from "./game.js";

/**
 * Minimal WebAudio synth — no asset files. The AudioContext is created lazily so
 * it starts after a user gesture (autoplay policy). Mirrors games/pong/src/audio.ts.
 */
export class PartyAudio {
  private ctx: AudioContext | null = null;

  private ensure(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  unlock(): void {
    this.ensure();
  }

  play(kind: SoundKind): void {
    switch (kind) {
      case "roll":
        this.beep(180, 60, "square", 0.06);
        break;
      case "step":
        this.beep(420, 35, "triangle", 0.05);
        break;
      case "coin":
        this.beep(660, 70, "square", 0.1);
        this.beep(880, 90, "square", 0.1, 60);
        break;
      case "bad":
        this.beep(200, 140, "sawtooth", 0.1);
        break;
      case "advance":
        this.beep(500, 80, "triangle", 0.1);
        break;
      case "star":
        this.beep(659, 90, "square", 0.12, 0);
        this.beep(880, 90, "square", 0.12, 90);
        this.beep(1175, 200, "square", 0.12, 180);
        break;
      case "win":
        this.beep(523, 120, "square", 0.12, 0);
        this.beep(659, 120, "square", 0.12, 120);
        this.beep(784, 220, "square", 0.12, 240);
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
