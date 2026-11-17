// PATHBOUND audio: synthesised sound effects and a generative music score (no audio files, so nothing to download).
let ctx = null, master = null, sfxBus = null, musBus = null, reverb = null;
let meter = null, sfxOn = true, musicOn = true;
export function setMuted(m) { sfxOn = !m; }
export function setMusicOn(v) { musicOn = v; if (musBus) musBus.gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, 0.2); if (!v) stopLoop(); else if (wanted) startLoop(); }

/** Current output loudness 0..1 (used by the test tools). */
export function level() { if (!meter) return -1; const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d); let m = 0; for (const v of d) m += v * v; return Math.sqrt(m / d.length); }
export function state() { return { ctx: ctx && ctx.state, loop: !!loopTimer, wanted, musicOn, theme }; }
export function unlockAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp).connect(ctx.destination); meter = ctx.createAnalyser(); meter.fftSize = 1024; comp.connect(meter);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      musBus = ctx.createGain(); musBus.gain.value = musicOn ? 1 : 0; musBus.connect(master);
      // a short generated room reverb for the music and the bigger effects
      const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      reverb = ctx.createConvolver(); reverb.buffer = ir; const rg = ctx.createGain(); rg.gain.value = 0.35; reverb.connect(rg).connect(master);
    } catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  if (ctx && wanted && musicOn && !loopTimer) startLoop();
}

// ------------------------------------------------------------------ effects
const noiseBuf = () => { if (noiseBuf.b) return noiseBuf.b; const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (noiseBuf.b = b); };
function tone(freq, dur, type = 'sine', vol = 0.12, slide = 0, delay = 0, wet = 0, bus = null) {
  if (!ctx) return; const t = ctx.currentTime + delay; const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || sfxBus); if (wet && reverb) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(reverb); }
  o.start(t); o.stop(t + dur + 0.03);
}
function hiss(dur, vol = 0.1, f0 = 2000, f1 = 2000, q = 1, type = 'bandpass', delay = 0, wet = 0) {
  if (!ctx) return; const t = ctx.currentTime + delay; const s = ctx.createBufferSource(); s.buffer = noiseBuf(); s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(sfxBus); if (wet && reverb) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(reverb); }
  s.start(t, Math.random()); s.stop(t + dur + 0.03);
}
const chime = (f, d = 0, v = 0.09) => { tone(f, 0.5, 'sine', v, 0, d, 0.5); tone(f * 2, 0.3, 'sine', v * 0.4, 0, d, 0.5); };
const S = {
  step: () => { hiss(0.07, 0.09, 700, 300, 0.8, 'lowpass'); tone(95, 0.07, 'sine', 0.1, -30); },
  wait: () => { tone(520, 0.12, 'sine', 0.05, 0, 0, 0.3); tone(780, 0.12, 'sine', 0.03, 0, 0.05, 0.3); },
  undo: () => { tone(420, 0.1, 'triangle', 0.06, -200); hiss(0.1, 0.03, 3000, 800); },
  deny: () => { tone(150, 0.14, 'square', 0.05); tone(112, 0.16, 'square', 0.05, 0, 0.09); },
  coin: () => { tone(1319, 0.08, 'square', 0.04); tone(1760, 0.3, 'triangle', 0.07, 0, 0.07, 0.4); tone(2637, 0.2, 'sine', 0.03, 0, 0.07, 0.4); },
  key: () => [784, 988, 1319, 1568].forEach((f, i) => chime(f, i * 0.07, 0.07)),
  door: () => { hiss(0.5, 0.1, 300, 120, 1.2, 'lowpass'); tone(80, 0.45, 'sawtooth', 0.05, -25, 0, 0.2); tone(520, 0.25, 'triangle', 0.04, -200, 0.15); },
  smash: () => { hiss(0.5, 0.35, 3500, 200, 0.7, 'lowpass', 0, 0.3); tone(110, 0.3, 'sine', 0.3, -60); tone(60, 0.5, 'sine', 0.25, -20, 0.02); },
  push: () => { hiss(0.35, 0.12, 400, 200, 1, 'lowpass'); tone(70, 0.3, 'sawtooth', 0.05, 20); },
  lever: () => { tone(900, 0.04, 'square', 0.05); tone(300, 0.12, 'square', 0.06, -100, 0.06); hiss(0.1, 0.06, 2500, 1000, 3, 'bandpass', 0.05); },
  gate: () => { hiss(0.6, 0.09, 200, 700, 1.5, 'lowpass'); tone(90, 0.55, 'sawtooth', 0.05, 40, 0, 0.2); },
  crumble: () => { hiss(0.6, 0.2, 900, 150, 0.7, 'lowpass', 0, 0.2); for (let i = 0; i < 5; i++) tone(180 - i * 15, 0.1, 'triangle', 0.06, -50, i * 0.07); },
  teleport: () => { tone(300, 0.5, 'sine', 0.09, 1400, 0, 0.6); tone(450, 0.5, 'triangle', 0.04, 1800, 0.04, 0.6); hiss(0.5, 0.04, 1000, 6000, 2, 'bandpass', 0, 0.5); },
  leap: () => { tone(260, 0.25, 'sine', 0.08, 420); hiss(0.25, 0.08, 800, 3500, 1.5); },
  board: () => { tone(220, 0.12, 'triangle', 0.08); hiss(0.1, 0.05, 600, 300, 1, 'lowpass'); },
  alight: () => { tone(200, 0.12, 'triangle', 0.08); hiss(0.1, 0.05, 600, 300, 1, 'lowpass'); },
  ward: () => { tone(700, 0.4, 'sine', 0.08, 400, 0, 0.6); chime(1047, 0.1, 0.05); },
  draw: () => { hiss(0.35, 0.12, 600, 5000, 2, 'bandpass', 0, 0.3); tone(500, 0.3, 'sawtooth', 0.03, 1200); },
  trap: () => { hiss(0.12, 0.18, 4500, 1200, 2); tone(900, 0.1, 'square', 0.05, -500); },
  hit: () => { hiss(0.25, 0.25, 2500, 300, 0.8, 'lowpass'); tone(130, 0.25, 'sine', 0.25, -70); },
  fail: () => { tone(330, 0.25, 'sawtooth', 0.08, -120, 0, 0.3); tone(247, 0.3, 'sawtooth', 0.08, -90, 0.2, 0.3); tone(165, 0.7, 'sawtooth', 0.09, -60, 0.4, 0.4); duck(1.8); },
  win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => { chime(f, i * 0.1, 0.09); tone(f / 2, 0.4, 'triangle', 0.05, 0, i * 0.1, 0.3); }); chime(1568, 0.6, 0.07); duck(2.6); },
  star: () => chime(1568, 0, 0.08),
  click: () => { tone(760, 0.05, 'triangle', 0.06); tone(1140, 0.04, 'sine', 0.03, 0, 0.01); },
  open: () => { tone(300, 0.2, 'sine', 0.05, 300, 0, 0.4); },
  whoosh: () => { hiss(0.7, 0.22, 400, 6000, 1.2, 'bandpass', 0, 0.5); tone(300, 0.7, 'sine', 0.05, 900, 0, 0.5); },
  boomHit: () => { tone(60, 1.3, 'sine', 0.55, -28, 0, 0.5); hiss(0.9, 0.35, 3000, 100, 0.7, 'lowpass', 0, 0.6); tone(140, 0.4, 'triangle', 0.25, -80); [0.02, 0.05, 0.09].forEach((d) => hiss(0.25, 0.14, 2000, 300, 0.8, 'bandpass', d)); },
  shing: () => { hiss(0.5, 0.16, 7000, 3500, 4, 'bandpass', 0, 0.6); [2093, 3136, 4186, 5274].forEach((f, i) => tone(f, 0.9 - i * 0.12, 'sine', 0.05, 0, 0.02 + i * 0.015, 0.7)); },
  logo: () => { tone(98, 1.6, 'sine', 0.5, -20, 0, 0.5); tone(49, 1.8, 'sine', 0.45, -10, 0, 0.4); hiss(1.0, 0.3, 4000, 150, 0.7, 'lowpass', 0, 0.7); [392, 587, 784].forEach((f, i) => tone(f, 1.4, 'sawtooth', 0.05, 0, i * 0.03, 0.6)); },
  fanfare: () => { [[392, 0], [494, 0.14], [587, 0.28], [784, 0.46]].forEach(([f, d]) => { tone(f, 0.9, 'sawtooth', 0.06, 0, d, 0.5); tone(f * 2, 0.8, 'triangle', 0.04, 0, d, 0.5); }); chime(1568, 0.6, 0.06); chime(2093, 0.75, 0.05); },
  buy: () => [784, 988, 1175, 1568].forEach((f, i) => chime(f, i * 0.08, 0.08)),
};
export function sfx(name) { if (sfxOn && ctx && S[name]) S[name](); }

/** The studio sting: a rising swell, a deep boom, shimmering bells and a warm chord. About 5 s. Plays only when audio is already running. */
export function introSting() {
  if (!ctx || ctx.state !== 'running' || !sfxOn) return false;
  const t0 = ctx.currentTime;
  const v = (f, type, vol, a, hold, rel, wet = 0.5, lp = 0) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + a); g.gain.setValueAtTime(vol, t0 + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + hold + rel); let n = o; if (lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.setValueAtTime(200, t0); f2.frequency.exponentialRampToValueAtTime(lp, t0 + a); o.connect(f2); n = f2; } n.connect(g); g.connect(sfxBus); if (wet && reverb) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(reverb); } o.start(t0); o.stop(t0 + a + hold + rel + 0.1); };
  v(55, 'sawtooth', 0.07, 1.3, 0.2, 3, 0.4, 900); v(82.4, 'sawtooth', 0.05, 1.3, 0.2, 3, 0.4, 900); // rising drone
  hiss(1.35, 0.14, 300, 5000, 1.2, 'bandpass', 0, 0.4); // riser
  const b = 1.4; tone(62, 1.4, 'sine', 0.5, -30, b, 0.5); hiss(0.9, 0.3, 2500, 120, 0.7, 'lowpass', b, 0.6); tone(120, 0.5, 'triangle', 0.2, -60, b); // the boom as the emblem lands
  [[880, 1.5], [1318.5, 1.72], [1760, 1.95], [2217.5, 2.2], [2637, 2.5]].forEach(([f, d]) => chime(f, d, 0.07)); // bells
  [[110, 0], [164.8, 0.05], [220, 0.1], [277.2, 0.15], [329.6, 0.2]].forEach(([f, d]) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; const s = t0 + 1.4 + d; g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.06, s + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, s + 3.4); o.connect(g).connect(sfxBus); const w = ctx.createGain(); w.gain.value = 0.7; g.connect(w).connect(reverb); o.start(s); o.stop(s + 3.5); }); // warm chord
  // brass-like swell with a rising filter, held, then released
  [[110, 0], [165, 0.02], [220, 0.04], [330, 0.06]].forEach(([f, d]) => { const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.Q.value = 2; fl.frequency.setValueAtTime(250, t0); fl.frequency.exponentialRampToValueAtTime(2600, t0 + 1.4 + d); fl.frequency.exponentialRampToValueAtTime(700, t0 + 4.5); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.045, t0 + 1.4); g.gain.setValueAtTime(0.045, t0 + 3.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 5.2); o.connect(fl).connect(g).connect(sfxBus); const w = ctx.createGain(); w.gain.value = 0.5; g.connect(w).connect(reverb); o.start(t0 + d); o.stop(t0 + 5.3); });
  // timpani roll building into the boom
  for (let i = 0; i < 16; i++) { const tt = 0.45 + i * 0.058; tone(86 - i * 0.6, 0.16, 'sine', 0.05 + i * 0.012, -18, tt, 0.3); }
  // PRESENTS: a soft rising shimmer and a low pulse
  chime(1760, 3.3, 0.05); chime(2349, 3.45, 0.05); tone(73.4, 1.6, 'sine', 0.22, -5, 3.3, 0.4);
  return true;
}

/** Music dips briefly under a big jingle. */
function duck(sec) { if (!musBus || !musicOn) return; const t = ctx.currentTime; musBus.gain.cancelScheduledValues(t); musBus.gain.setTargetAtTime(0.25, t, 0.05); musBus.gain.setTargetAtTime(1, t + sec, 0.5); }

// ------------------------------------------------------------------ music: a slow generated loop per world
const MODES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], phryg: [0, 1, 3, 5, 7, 8, 10] };
const THEME = {
  0: { root: 57, mode: 'minor', bpm: 72, drums: 0, lead: 'sine', arp: 'sine', prog: [0, 5, 2, 6], pad: 0.05 }, // title / menus
  1: { root: 60, mode: 'major', bpm: 84, drums: 1, lead: 'triangle', arp: 'triangle', prog: [0, 4, 5, 3], pad: 0.05 }, // garden
  2: { root: 62, mode: 'dorian', bpm: 78, drums: 1, lead: 'triangle', arp: 'triangle', prog: [0, 3, 6, 4], pad: 0.05 }, // ruins
  3: { root: 67, mode: 'lydian', bpm: 90, drums: 2, lead: 'sine', arp: 'sine', prog: [0, 1, 4, 0], pad: 0.05 }, // sky
  4: { root: 57, mode: 'minor', bpm: 66, drums: 1, lead: 'sine', arp: 'triangle', prog: [0, 5, 3, 4], pad: 0.06 }, // caves
  5: { root: 64, mode: 'dorian', bpm: 74, drums: 1, lead: 'triangle', arp: 'sine', prog: [0, 6, 3, 4], pad: 0.05 }, // forest
  6: { root: 59, mode: 'dorian', bpm: 82, drums: 2, lead: 'triangle', arp: 'triangle', prog: [0, 3, 4, 0], pad: 0.05 }, // market / dusk
  7: { root: 54, mode: 'minor', bpm: 80, drums: 1, lead: 'sine', arp: 'sine', prog: [0, 2, 5, 4], pad: 0.05 }, // crystal
  8: { root: 62, mode: 'phryg', bpm: 96, drums: 2, lead: 'sawtooth', arp: 'sawtooth', prog: [0, 1, 0, 6], pad: 0.04 }, // fire
  9: { root: 70, mode: 'lydian', bpm: 70, drums: 0, lead: 'sine', arp: 'sine', prog: [0, 4, 1, 4], pad: 0.05 }, // ice
  10: { root: 57, mode: 'minor', bpm: 100, drums: 2, lead: 'triangle', arp: 'triangle', prog: [0, 5, 6, 4], pad: 0.05 }, // finale
};
let theme = 0, wanted = false, loopTimer = 0, nextBeat = 0, beatNo = 0, seed = 1;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const deg = (T, d) => { const m = MODES[T.mode]; const o = Math.floor(d / 7); return T.root + m[((d % 7) + 7) % 7] + 12 * o; };
function pad(T, notes, t, dur) {
  for (const n of notes) for (const det of [-6, 6]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = det; f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(T.pad * 1.6, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(musBus); const w = ctx.createGain(); w.gain.value = 0.5; g.connect(w).connect(reverb); o.start(t); o.stop(t + dur + 0.05);
  }
}
function pluck(T, n, t, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = T.arp; o.frequency.value = midi(n);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.connect(g).connect(musBus); const w = ctx.createGain(); w.gain.value = 0.7; g.connect(w).connect(reverb); o.start(t); o.stop(t + 0.65);
}
function bass(T, n, t, dur) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = midi(n);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(musBus); o.start(t); o.stop(t + dur + 0.05);
}
// percussion: soft kick, shaker/hat, woodblock tick, all synthesised
function kick(t, v = 0.5) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.connect(g).connect(musBus); o.start(t); o.stop(t + 0.3); }
function hat(t, v = 0.05, open = false) { const s = ctx.createBufferSource(); s.buffer = noiseBuf(); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); const d = open ? 0.18 : 0.045; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f).connect(g).connect(musBus); s.start(t, Math.random()); s.stop(t + d + 0.02); }
function snare(t, v = 0.12) { const s = ctx.createBufferSource(); s.buffer = noiseBuf(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); s.connect(f).connect(g).connect(musBus); const w = ctx.createGain(); w.gain.value = 0.4; g.connect(w).connect(reverb); s.start(t, Math.random()); s.stop(t + 0.2); const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 190; og.gain.setValueAtTime(v * 0.8, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(og).connect(musBus); o.start(t); o.stop(t + 0.12); }
function tick(t, v = 0.07) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 1100; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g).connect(musBus); o.start(t); o.stop(t + 0.06); }
// a lead voice: soft, slightly wobbling, with an echo
function lead(T, n, t, dur, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); o.type = T.lead || 'triangle'; o.frequency.value = midi(n);
  lfo.frequency.value = 5.2; lg.gain.value = 5; lfo.connect(lg).connect(o.detune);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04); g.gain.setTargetAtTime(0.0001, t + dur * 0.7, dur * 0.25);
  o.connect(g).connect(musBus); const dl = ctx.createDelay(1); dl.delayTime.value = 60 / T.bpm * 0.75; const fb = ctx.createGain(); fb.gain.value = 0.32; const ec = ctx.createGain(); ec.gain.value = 0.45;
  g.connect(dl); dl.connect(fb).connect(dl); dl.connect(ec).connect(musBus); const w = ctx.createGain(); w.gain.value = 0.6; g.connect(w).connect(reverb);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.6); lfo.stop(t + dur + 0.6);
}
// a four-note idea per world, bent a little each time it comes round, so the tune is recognisable but never identical
const MOTIFS = [[0, 2, 1, 3], [0, 1, 2, 4], [2, 1, 0, 2], [0, 3, 2, 1], [4, 2, 3, 1], [0, 2, 4, 2]];
const PHRASE = 8; // bars: A (pad+arp), A (+melody), B (+drums), B (+melody + drums)
function schedule() {
  if (!ctx || !musicOn || !wanted) return; const T = THEME[theme] || THEME[0]; const beat = 60 / T.bpm;
  while (nextBeat < ctx.currentTime + 0.35) {
    const barNo = Math.floor(beatNo / 4); const bar = barNo % 4, inBar = beatNo % 4, sec = Math.floor(barNo / 4) % 4; const root = T.prog[bar]; const t = nextBeat;
    const chord = [deg(T, root), deg(T, root + 2), deg(T, root + 4)];
    if (inBar === 0) { pad(T, chord, t, beat * 4.2); bass(T, deg(T, root) - 12, t, beat * 3.6); }
    // bass walks on beat 3 in the busier sections
    if (inBar === 2 && sec >= 2) bass(T, deg(T, root + 4) - 12, t, beat * 1.6);
    // soft plucks, two per beat, a few left out so it breathes
    const dense = sec === 1 || sec === 3 ? 74 : 56;
    for (let h = 0; h < 2; h++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff; const r = (seed >> 8) % 100;
      if (r < dense) { const pick = [0, 1, 2, 1, 2, 3][(inBar * 2 + h + ((seed >> 4) % 3)) % 6]; pluck(T, deg(T, root + pick * 2) + 12, t + h * beat / 2, 0.11 + (r % 7) * 0.006); }
    }
    // melody in the second and fourth sections: one motif note a beat, held
    if ((sec === 1 || sec === 3) && (bar === 1 || bar === 3 || sec === 3)) {
      const m = MOTIFS[(T.root + (sec === 3 ? 1 : 0)) % MOTIFS.length]; const note = deg(T, root + m[(inBar + bar) % 4]) + 24;
      if (inBar % 2 === 0 || sec === 3) lead(T, note, t, beat * (inBar % 2 === 0 ? 1.8 : 0.9), 0.07);
    }
    // drums from section 2 on (menus stay gentle)
    if (T.drums && sec >= 2) {
      if (inBar === 0 || (inBar === 2 && T.drums > 1)) kick(t, 0.42);
      if (T.drums > 1 && (inBar === 1 || inBar === 3)) snare(t, 0.09);
      hat(t, 0.03); hat(t + beat / 2, 0.045, inBar === 3);
    } else if (T.drums) { tick(t, 0.04); if (inBar === 2) tick(t + beat / 2, 0.03); }
    nextBeat += beat; beatNo++;
  }
}
function startLoop() { if (!ctx || loopTimer || !musicOn) return; nextBeat = ctx.currentTime + 0.1; beatNo = 0; loopTimer = setInterval(schedule, 120); }
function stopLoop() { if (loopTimer) { clearInterval(loopTimer); loopTimer = 0; } }
/** Which music plays: 0 = menus, 1..10 = that world's theme. Changes at once with a short fade. */
export function playMusic(world = 0) {
  wanted = true; if (world === theme && loopTimer) return; theme = world; beatNo = 0;
  if (ctx && musBus && musicOn) { musBus.gain.cancelScheduledValues(ctx.currentTime); musBus.gain.setValueAtTime(0.0, ctx.currentTime); musBus.gain.setTargetAtTime(1, ctx.currentTime + 0.05, 0.6); if (nextBeat) nextBeat = ctx.currentTime + 0.1; }
  if (ctx && !loopTimer) startLoop();
}
export function pauseMusic() { if (ctx && ctx.state === 'running') ctx.suspend(); }
export function resumeMusic() { if (ctx && ctx.state === 'suspended' && wanted) ctx.resume(); }
