// Procedural Web Audio — no asset files needed.
let audioCtx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function resumeAudio() {
  if (audioCtx?.state === "suspended") audioCtx.resume();
}

// Short metallic "clang"
export function playHit(dmg: number) {
  const c = ctx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(800 + Math.random() * 400, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
  gain.gain.setValueAtTime(Math.min(0.3, dmg / 100), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

// Whoosh — tip moving fast
export function playWhoosh(speed: number) {
  const c = ctx();
  const now = c.currentTime;
  const noise = c.createBufferSource();
  const buf = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buf;
  const bandpass = c.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 1200 + speed * 200;
  bandpass.Q.value = 1.5;
  const gain = c.createGain();
  gain.gain.setValueAtTime(Math.min(0.15, speed / 20), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  noise.connect(bandpass).connect(gain).connect(c.destination);
  noise.start(now);
}

// Blade clash
export function playClash() {
  const c = ctx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1500 + Math.random() * 1000, now);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

// Death rumble
export function playDeath() {
  const c = ctx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.linearRampToValueAtTime(30, now + 0.4);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.5);
}

// Hurt grunt
export function playHurt() {
  const c = ctx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.linearRampToValueAtTime(90, now + 0.2);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

// Wall clash
export function playWallClash() {
  const c = ctx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.06);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}