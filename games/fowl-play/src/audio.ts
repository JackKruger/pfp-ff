import type { SoundEvent } from "./types.js";

/**
 * Tiny WebAudio synth. Maps each SoundEvent to a short tone with an envelope.
 * No samples — every effect is generated from oscillators so the game ships
 * without any audio assets.
 *
 * Browsers block AudioContext until the user interacts, so the first call to
 * play() is preceded by an unlock() that resumes the context on demand.
 */
export class FowlAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  unlock(): void {
    this.ensure();
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  /** Drain a queue of events emitted by the game FSM. */
  playAll(events: SoundEvent[]): void {
    if (!events.length) return;
    this.unlock();
    for (const e of events) this.play(e);
  }

  play(event: SoundEvent): void {
    this.ensure();
    if (!this.ctx || !this.master) return;
    switch (event) {
      case "jump":
        this.beep({ freq: 440, sweepTo: 880, ms: 120, type: "square", gain: 0.18 });
        break;
      case "place":
        // Soft wooden "click" for committing a piece.
        this.beep({ freq: 520, sweepTo: 390, ms: 70, type: "triangle", gain: 0.16 });
        break;
      case "coin":
        this.beep({ freq: 880, sweepTo: 1320, ms: 80, type: "triangle", gain: 0.22 });
        this.beep({ freq: 1320, sweepTo: 1760, ms: 90, type: "triangle", gain: 0.18, delay: 60 });
        break;
      case "diamond":
        // A sparkly major triad arpeggio.
        this.beep({ freq: 880, sweepTo: 880, ms: 110, type: "triangle", gain: 0.22 });
        this.beep({ freq: 1108, sweepTo: 1108, ms: 110, type: "triangle", gain: 0.22, delay: 80 });
        this.beep({ freq: 1320, sweepTo: 1760, ms: 200, type: "triangle", gain: 0.22, delay: 160 });
        break;
      case "death":
        this.beep({ freq: 320, sweepTo: 80, ms: 360, type: "sawtooth", gain: 0.22 });
        break;
      case "kill":
        // Low confirmation thump.
        this.beep({ freq: 220, sweepTo: 110, ms: 180, type: "square", gain: 0.2 });
        break;
      case "finish":
        this.beep({ freq: 660, sweepTo: 660, ms: 90, type: "triangle", gain: 0.22 });
        this.beep({ freq: 990, sweepTo: 990, ms: 220, type: "triangle", gain: 0.22, delay: 80 });
        break;
      case "loneSurvivor":
        this.beep({ freq: 523, sweepTo: 523, ms: 100, type: "triangle", gain: 0.22 });
        this.beep({ freq: 659, sweepTo: 659, ms: 100, type: "triangle", gain: 0.22, delay: 100 });
        this.beep({ freq: 784, sweepTo: 784, ms: 100, type: "triangle", gain: 0.22, delay: 200 });
        this.beep({ freq: 1046, sweepTo: 1568, ms: 320, type: "triangle", gain: 0.24, delay: 300 });
        break;
      case "countdownTick":
        this.beep({ freq: 660, sweepTo: 660, ms: 90, type: "square", gain: 0.18 });
        break;
      case "go":
        this.beep({ freq: 990, sweepTo: 1320, ms: 320, type: "square", gain: 0.24 });
        break;
      case "reveal":
        this.beep({ freq: 392, sweepTo: 784, ms: 120, type: "triangle", gain: 0.18 });
        this.beep({ freq: 784, sweepTo: 1175, ms: 180, type: "triangle", gain: 0.18, delay: 80 });
        break;
      case "impact":
        this.beep({ freq: 90, sweepTo: 45, ms: 160, type: "sawtooth", gain: 0.22 });
        break;
      case "win":
        // Fanfare.
        this.beep({ freq: 523, sweepTo: 523, ms: 140, type: "triangle", gain: 0.25 });
        this.beep({ freq: 659, sweepTo: 659, ms: 140, type: "triangle", gain: 0.25, delay: 140 });
        this.beep({ freq: 784, sweepTo: 784, ms: 140, type: "triangle", gain: 0.25, delay: 280 });
        this.beep({ freq: 1046, sweepTo: 1568, ms: 480, type: "triangle", gain: 0.28, delay: 420 });
        break;
    }
  }

  dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
    }
  }

  private ensure(): void {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
  }

  private beep(opts: {
    freq: number;
    sweepTo: number;
    ms: number;
    type: OscillatorType;
    gain: number;
    delay?: number;
  }): void {
    if (!this.ctx || !this.master) return;
    const start = this.ctx.currentTime + (opts.delay ?? 0) / 1000;
    const stop = start + opts.ms / 1000;

    const osc = this.ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.sweepTo), stop);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(opts.gain, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);

    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(stop);
  }
}
