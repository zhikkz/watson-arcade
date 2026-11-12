// WebAudio：合成音效 + 程序生成的芯片风格背景音乐（无任何音频文件）
import { RNG } from './util.js';

let ctx = null;
let master = null, sfxGain = null, musicGain = null, noiseBuf = null;
let vol = { sfx: 0.8, music: 0.55 };
const lastPlayed = {};

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    // 轻度压限，避免多个音效叠加时爆音
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.18;
    master.connect(comp); comp.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = vol.sfx; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = vol.music * 0.5; musicGain.connect(master);
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  } catch (_) { ctx = null; return false; }
}

function tone(o) {
  // o: type f0 f1 dur vol attack delay curve('exp'|'lin') dest vib
  const t0 = ctx.currentTime + (o.delay || 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(Math.max(20, o.f0), t0);
  if (o.f1 !== undefined) {
    if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur);
    else osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur);
  }
  const a = o.attack || 0.004;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(o.vol || 0.2, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g); g.connect(o.dest || sfxGain);
  osc.start(t0); osc.stop(t0 + o.dur + 0.02);
}

function noise(o) {
  // o: dur vol filter('lowpass'|'highpass'|'bandpass') f0 f1 q delay attack dest
  const t0 = ctx.currentTime + (o.delay || 0);
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  s.playbackRate.value = o.rate || 1;
  const f = ctx.createBiquadFilter();
  f.type = o.filter || 'lowpass';
  f.frequency.setValueAtTime(o.f0 || 2000, t0);
  if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t0 + o.dur);
  f.Q.value = o.q || 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(o.vol || 0.2, t0 + (o.attack || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  s.connect(f); f.connect(g); g.connect(o.dest || sfxGain);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + o.dur + 0.02);
}

// ---------------------------------------------------------------- 音效表
const SFX = {
  jump: () => tone({ type: 'square', f0: 280, f1: 560, dur: 0.11, vol: 0.10 }),
  djump: () => { tone({ type: 'square', f0: 420, f1: 880, dur: 0.12, vol: 0.09 }); noise({ dur: 0.1, vol: 0.05, filter: 'highpass', f0: 3000 }); },
  land: () => noise({ dur: 0.07, vol: 0.12, filter: 'lowpass', f0: 500, f1: 120 }),
  step: () => noise({ dur: 0.03, vol: 0.035, filter: 'bandpass', f0: 900, q: 1.5 }),
  roll: () => noise({ dur: 0.22, vol: 0.13, filter: 'bandpass', f0: 500, f1: 1800, q: 1.2 }),
  swing: () => noise({ dur: 0.1, vol: 0.14, filter: 'bandpass', f0: 900, f1: 2600, q: 1.6 }),
  swingHeavy: () => { noise({ dur: 0.2, vol: 0.18, filter: 'bandpass', f0: 300, f1: 1400, q: 1.2 }); tone({ type: 'sawtooth', f0: 110, f1: 60, dur: 0.16, vol: 0.06 }); },
  stab: () => noise({ dur: 0.05, vol: 0.12, filter: 'highpass', f0: 2500, f1: 6000 }),
  hit: () => { noise({ dur: 0.08, vol: 0.2, filter: 'lowpass', f0: 1800, f1: 300 }); tone({ type: 'square', f0: 190, f1: 70, dur: 0.08, vol: 0.12 }); },
  hitHeavy: () => { noise({ dur: 0.16, vol: 0.26, filter: 'lowpass', f0: 1400, f1: 120 }); tone({ type: 'sine', f0: 140, f1: 40, dur: 0.2, vol: 0.28 }); },
  crit: () => { noise({ dur: 0.1, vol: 0.2, filter: 'highpass', f0: 1800 }); tone({ type: 'square', f0: 880, f1: 1760, dur: 0.09, vol: 0.1 }); tone({ type: 'square', f0: 240, f1: 80, dur: 0.12, vol: 0.14 }); },
  kill: () => { tone({ type: 'square', f0: 520, f1: 130, dur: 0.16, vol: 0.12 }); noise({ dur: 0.18, vol: 0.14, filter: 'lowpass', f0: 2600, f1: 300 }); },
  hurt: () => { tone({ type: 'sawtooth', f0: 330, f1: 90, dur: 0.22, vol: 0.2 }); noise({ dur: 0.14, vol: 0.2, filter: 'lowpass', f0: 1200, f1: 200 }); },
  block: () => { tone({ type: 'square', f0: 1200, f1: 700, dur: 0.07, vol: 0.1 }); noise({ dur: 0.06, vol: 0.12, filter: 'highpass', f0: 4000 }); },
  heal: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.16, vol: 0.14, delay: i * 0.07 })); },
  gulp: () => { tone({ type: 'sine', f0: 300, f1: 180, dur: 0.09, vol: 0.16 }); tone({ type: 'sine', f0: 330, f1: 200, dur: 0.09, vol: 0.16, delay: 0.16 }); },
  gold: () => { tone({ type: 'square', f0: 988, dur: 0.05, vol: 0.07 }); tone({ type: 'square', f0: 1319, dur: 0.09, vol: 0.07, delay: 0.05 }); },
  data: () => { tone({ type: 'triangle', f0: 1400, f1: 2100, dur: 0.08, vol: 0.09 }); },
  pickup: () => { [660, 880, 1320].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.07, vol: 0.08, delay: i * 0.05 })); },
  equip: () => { noise({ dur: 0.05, vol: 0.1, filter: 'highpass', f0: 3000 }); tone({ type: 'square', f0: 440, f1: 660, dur: 0.1, vol: 0.09, delay: 0.03 }); },
  door: () => { noise({ dur: 0.3, vol: 0.14, filter: 'lowpass', f0: 300, f1: 900 }); tone({ type: 'sine', f0: 90, f1: 60, dur: 0.3, vol: 0.15 }); },
  chest: () => { noise({ dur: 0.12, vol: 0.14, filter: 'bandpass', f0: 700, q: 2 }); [392, 523, 659, 784].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.1, vol: 0.08, delay: 0.1 + i * 0.06 })); },
  select: () => tone({ type: 'square', f0: 660, f1: 990, dur: 0.07, vol: 0.08 }),
  move: () => tone({ type: 'square', f0: 440, dur: 0.035, vol: 0.06 }),
  back: () => tone({ type: 'square', f0: 440, f1: 260, dur: 0.08, vol: 0.07 }),
  deny: () => { tone({ type: 'square', f0: 160, dur: 0.08, vol: 0.1 }); tone({ type: 'square', f0: 120, dur: 0.12, vol: 0.1, delay: 0.09 }); },
  buy: () => { tone({ type: 'square', f0: 784, dur: 0.06, vol: 0.08 }); tone({ type: 'square', f0: 1175, dur: 0.14, vol: 0.08, delay: 0.06 }); noise({ dur: 0.08, vol: 0.06, filter: 'highpass', f0: 5000, delay: 0.06 }); },
  explode: () => { noise({ dur: 0.45, vol: 0.34, filter: 'lowpass', f0: 2400, f1: 80 }); tone({ type: 'sine', f0: 110, f1: 30, dur: 0.4, vol: 0.34 }); },
  boom: () => { noise({ dur: 0.9, vol: 0.4, filter: 'lowpass', f0: 1600, f1: 50 }); tone({ type: 'sine', f0: 80, f1: 24, dur: 0.8, vol: 0.4 }); },
  zap: () => { tone({ type: 'sawtooth', f0: 1800, f1: 200, dur: 0.12, vol: 0.1 }); noise({ dur: 0.12, vol: 0.14, filter: 'highpass', f0: 2500 }); },
  spark: () => noise({ dur: 0.05, vol: 0.1, filter: 'highpass', f0: 4500 }),
  laser: () => { tone({ type: 'sawtooth', f0: 1500, f1: 300, dur: 0.16, vol: 0.09 }); tone({ type: 'square', f0: 2200, f1: 900, dur: 0.1, vol: 0.05 }); },
  beam: () => { tone({ type: 'sawtooth', f0: 220, f1: 200, dur: 0.4, vol: 0.12 }); noise({ dur: 0.4, vol: 0.1, filter: 'bandpass', f0: 3000, q: 3 }); },
  charge: () => tone({ type: 'sawtooth', f0: 160, f1: 900, dur: 0.5, vol: 0.07, curve: 'lin' }),
  shoot: () => { tone({ type: 'square', f0: 700, f1: 240, dur: 0.09, vol: 0.09 }); noise({ dur: 0.05, vol: 0.08, filter: 'highpass', f0: 2500 }); },
  throw: () => noise({ dur: 0.12, vol: 0.1, filter: 'bandpass', f0: 1200, f1: 400, q: 1.5 }),
  freeze: () => { [2093, 2637, 3136].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.14, vol: 0.07, delay: i * 0.03 })); noise({ dur: 0.2, vol: 0.08, filter: 'highpass', f0: 6000 }); },
  shatter: () => { noise({ dur: 0.25, vol: 0.2, filter: 'highpass', f0: 3500 }); tone({ type: 'triangle', f0: 2400, f1: 900, dur: 0.12, vol: 0.08 }); },
  burn: () => noise({ dur: 0.3, vol: 0.12, filter: 'bandpass', f0: 800, f1: 2400, q: 0.8 }),
  steam: () => noise({ dur: 0.5, vol: 0.12, filter: 'highpass', f0: 2600, attack: 0.08 }),
  spring: () => { tone({ type: 'triangle', f0: 180, f1: 720, dur: 0.22, vol: 0.16 }); tone({ type: 'triangle', f0: 360, f1: 1440, dur: 0.22, vol: 0.06 }); },
  slam: () => { noise({ dur: 0.3, vol: 0.3, filter: 'lowpass', f0: 900, f1: 60 }); tone({ type: 'sine', f0: 100, f1: 30, dur: 0.3, vol: 0.34 }); },
  alert: () => { tone({ type: 'square', f0: 880, dur: 0.06, vol: 0.07 }); tone({ type: 'square', f0: 1175, dur: 0.1, vol: 0.07, delay: 0.07 }); },
  growl: () => { tone({ type: 'sawtooth', f0: 90, f1: 60, dur: 0.35, vol: 0.16 }); noise({ dur: 0.35, vol: 0.1, filter: 'lowpass', f0: 500 }); },
  roar: () => { tone({ type: 'sawtooth', f0: 130, f1: 48, dur: 1.0, vol: 0.26 }); tone({ type: 'sawtooth', f0: 137, f1: 52, dur: 1.0, vol: 0.2 }); noise({ dur: 1.0, vol: 0.22, filter: 'lowpass', f0: 900, f1: 200 }); },
  teleport: () => { tone({ type: 'sine', f0: 300, f1: 1800, dur: 0.2, vol: 0.12 }); tone({ type: 'sine', f0: 1800, f1: 400, dur: 0.2, vol: 0.08, delay: 0.14 }); },
  warp: () => { tone({ type: 'sine', f0: 900, f1: 90, dur: 0.5, vol: 0.14 }); noise({ dur: 0.5, vol: 0.08, filter: 'bandpass', f0: 2000, f1: 200, q: 2 }); },
  perk: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.14, vol: 0.08, delay: i * 0.07 })); },
  scroll: () => { [440, 554, 659, 880].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.18, vol: 0.12, delay: i * 0.06 })); },
  death: () => { [392, 330, 262, 196, 147].forEach((f, i) => tone({ type: 'square', f0: f, f1: f * 0.94, dur: 0.24, vol: 0.12, delay: i * 0.17 })); noise({ dur: 1.0, vol: 0.12, filter: 'lowpass', f0: 1200, f1: 100 }); },
  win: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.2, vol: 0.1, delay: i * 0.13 })); },
  meow: () => { tone({ type: 'triangle', f0: 700, f1: 1100, dur: 0.12, vol: 0.12 }); tone({ type: 'triangle', f0: 1100, f1: 600, dur: 0.2, vol: 0.12, delay: 0.11 }); },
  glass: () => { noise({ dur: 0.18, vol: 0.16, filter: 'highpass', f0: 4200 }); tone({ type: 'triangle', f0: 3000, f1: 1500, dur: 0.08, vol: 0.06 }); },
  crate: () => { noise({ dur: 0.16, vol: 0.2, filter: 'bandpass', f0: 500, q: 1 }); tone({ type: 'square', f0: 150, f1: 70, dur: 0.1, vol: 0.1 }); },
  tick: () => tone({ type: 'square', f0: 1500, dur: 0.02, vol: 0.05 }),
  warn: () => { tone({ type: 'square', f0: 620, dur: 0.09, vol: 0.08 }); tone({ type: 'square', f0: 620, dur: 0.09, vol: 0.08, delay: 0.16 }); },
  phase: () => tone({ type: 'sine', f0: 520, f1: 260, dur: 0.18, vol: 0.07 }),
  pull: () => tone({ type: 'sine', f0: 70, f1: 140, dur: 0.5, vol: 0.2, curve: 'lin' }),
};

// ---------------------------------------------------------------- 音乐
// 每首曲子由「调式 + 和弦进行 + 型态参数」经固定种子生成，循环播放。
const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], major: [0, 2, 4, 5, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], penta: [0, 2, 4, 7, 9],
};
const SONGS = {
  title: { bpm: 92, root: 57, scale: 'minor', prog: [0, 5, 3, 4], seed: 11, lead: 0.45, arp: 'up', drums: 'soft', bassStyle: 'long', leadWave: 'triangle' },
  mech: { bpm: 122, root: 50, scale: 'dorian', prog: [0, 3, 0, 6, 0, 3, 5, 4], seed: 23, lead: 0.7, arp: 'bounce', drums: 'swing', bassStyle: 'walk', leadWave: 'square' },
  em: { bpm: 134, root: 52, scale: 'minor', prog: [0, 5, 2, 6], seed: 37, lead: 0.75, arp: 'fast', drums: 'drive', bassStyle: 'pulse', leadWave: 'sawtooth' },
  thermo: { bpm: 116, root: 48, scale: 'harmonic', prog: [0, 3, 5, 4], seed: 41, lead: 0.6, arp: 'updown', drums: 'heavy', bassStyle: 'pulse', leadWave: 'square' },
  quantum: { bpm: 128, root: 54, scale: 'phrygian', prog: [0, 2, 6, 5], seed: 59, lead: 0.55, arp: 'glitch', drums: 'break', bassStyle: 'synco', leadWave: 'triangle' },
  boss: { bpm: 152, root: 50, scale: 'harmonic', prog: [0, 0, 5, 6, 0, 0, 3, 4], seed: 73, lead: 0.85, arp: 'fast', drums: 'drive', bassStyle: 'gallop', leadWave: 'sawtooth' },
  rest: { bpm: 80, root: 60, scale: 'major', prog: [0, 5, 3, 4], seed: 89, lead: 0.4, arp: 'up', drums: 'none', bassStyle: 'long', leadWave: 'triangle' },
};

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function buildSong(spec) {
  // 进行不足 8 小节的曲子重复一遍（后半段旋律带变奏），避免循环太短
  if (spec.prog.length < 8) spec = Object.assign({}, spec, { prog: spec.prog.concat(spec.prog) });
  const rng = new RNG(spec.seed);
  const sc = SCALES[spec.scale];
  const deg = (d, oct = 0) => spec.root + sc[((d % sc.length) + sc.length) % sc.length] + 12 * (Math.floor(d / sc.length) + oct);
  const bars = spec.prog.length;
  const steps = bars * 16;
  const tracks = { lead: new Array(steps).fill(null), arp: new Array(steps).fill(null), bass: new Array(steps).fill(null), kick: new Array(steps).fill(0), snare: new Array(steps).fill(0), hat: new Array(steps).fill(0) };

  // 主旋律：两小节动机 + 变奏
  const rhythms = [
    [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    [1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    [0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0],
    [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  ];
  const motifRh = [rng.pick(rhythms), rng.pick(rhythms)];
  const motif = [];
  let cur = 4 + rng.int(0, 2);
  for (let b = 0; b < 2; b++) {
    const notes = [];
    for (let s = 0; s < 16; s++) {
      if (motifRh[b][s] && rng.chance(spec.lead + 0.25)) {
        const stepMove = rng.pick([-2, -1, -1, 0, 1, 1, 2, 3]);
        cur = Math.max(2, Math.min(11, cur + stepMove));
        notes.push(cur);
      } else notes.push(null);
    }
    motif.push(notes);
  }
  for (let b = 0; b < bars; b++) {
    const chord = spec.prog[b];
    const src = motif[b % 2];
    const variation = b >= bars / 2 && b % 2 === 1;
    for (let s = 0; s < 16; s++) {
      let d = src[s];
      if (d === null) continue;
      // 强拍吸附到和弦音
      if (s % 8 === 0) {
        const tones = [chord, chord + 2, chord + 4, chord + 7];
        let best = tones[0], bd = 99;
        for (const t of tones) for (const o of [0, 7]) { const dd = Math.abs(t + o - d); if (dd < bd) { bd = dd; best = t + o; } }
        d = best;
      }
      if (variation && s >= 8) d += rng.pick([0, 1, 2, -1]);
      const len = (s + 1 < 16 && src[s + 1] === null) ? (s + 2 < 16 && src[s + 2] === null ? 3 : 2) : 1;
      tracks.lead[b * 16 + s] = { n: deg(d, 1), len };
    }
    // 句尾留白
    if (b % 4 === 3) for (let s = 12; s < 16; s++) tracks.lead[b * 16 + s] = null;
  }

  // 琶音
  for (let b = 0; b < bars; b++) {
    const c = spec.prog[b];
    const tones = [c, c + 2, c + 4, c + 7];
    let pat;
    switch (spec.arp) {
      case 'up': pat = [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 3, -1]; break;
      case 'bounce': pat = [0, -1, 2, 0, -1, 2, 0, -1, 1, -1, 3, 1, -1, 3, 1, -1]; break;
      case 'fast': pat = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 2, 1, 3]; break;
      case 'updown': pat = [0, -1, 1, 2, -1, 1, 0, -1, 0, -1, 1, 2, -1, 3, 2, -1]; break;
      case 'glitch': pat = Array.from({ length: 16 }, () => (rng.chance(0.62) ? rng.int(0, 3) : -1)); break;
      default: pat = [0, -1, -1, -1, 1, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1];
    }
    for (let s = 0; s < 16; s++) if (pat[s] >= 0) tracks.arp[b * 16 + s] = { n: deg(tones[pat[s]], spec.arp === 'glitch' && rng.chance(0.2) ? 2 : 1), len: 1 };
  }

  // 贝斯
  for (let b = 0; b < bars; b++) {
    const c = spec.prog[b];
    const r = deg(c, -1), f = deg(c + 4, -1), o = deg(c + 7, -1);
    const put = (s, n, len) => { tracks.bass[b * 16 + s] = { n, len }; };
    switch (spec.bassStyle) {
      case 'long': put(0, r, 8); put(8, r, 6); break;
      case 'walk': put(0, r, 2); put(4, f, 2); put(8, o, 2); put(12, f, 2); if (b % 2) put(14, deg(c + 6, -1), 2); break;
      case 'pulse': for (let s = 0; s < 16; s += 2) put(s, s % 8 === 6 ? f : r, 1); break;
      case 'synco': put(0, r, 3); put(3, r, 2); put(6, o, 2); put(10, r, 2); put(13, f, 2); break;
      case 'gallop': for (let s = 0; s < 16; s += 4) { put(s, r, 2); put(s + 2, r, 1); put(s + 3, s === 12 ? f : r, 1); } break;
      default: put(0, r, 4); put(8, r, 4);
    }
  }

  // 鼓
  for (let b = 0; b < bars; b++) {
    const K = (s) => { tracks.kick[b * 16 + s] = 1; };
    const S = (s) => { tracks.snare[b * 16 + s] = 1; };
    const Hh = (s, v = 1) => { tracks.hat[b * 16 + s] = v; };
    switch (spec.drums) {
      case 'soft': K(0); if (b % 2) K(10); for (let s = 4; s < 16; s += 8) Hh(s, 0.6); break;
      case 'swing': K(0); K(8); K(11); S(4); S(12); for (let s = 0; s < 16; s += 2) Hh(s, s % 4 === 0 ? 1 : 0.5); Hh(7, 0.4); Hh(15, 0.4); break;
      case 'drive': K(0); K(4); K(8); K(12); S(4); S(12); for (let s = 2; s < 16; s += 4) Hh(s); if (b % 4 === 3) { S(13); S(14); S(15); } break;
      case 'heavy': K(0); K(3); K(8); K(10); S(4); S(12); for (let s = 0; s < 16; s += 4) Hh(s, 0.7); break;
      case 'break': K(0); K(6); K(10); S(4); S(12); if (b % 2) S(15); for (let s = 0; s < 16; s++) if (rng.chance(0.45)) Hh(s, 0.5); break;
      default: break;
    }
  }
  return { spec, steps, tracks, stepDur: 60 / spec.bpm / 4 };
}

const music = { name: null, song: null, step: 0, nextTime: 0, timer: null, cache: {} };

function scheduleStep(song, i, t) {
  const tr = song.tracks, sd = song.stepDur, sp = song.spec;
  const play = (type, n, len, v, dest) => {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(midi(n), t);
    const dur = Math.max(0.05, len * sd * 0.92);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.008);
    g.gain.setValueAtTime(v * 0.75, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(dest || musicGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  };
  const L = tr.lead[i]; if (L) play(sp.leadWave, L.n, L.len, sp.leadWave === 'triangle' ? 0.2 : 0.085);
  const A = tr.arp[i]; if (A) play('square', A.n, A.len, 0.04);
  const B = tr.bass[i]; if (B) play('triangle', B.n, B.len, 0.26);
  if (tr.kick[i]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.16);
  }
  if (tr.snare[i] || tr.hat[i]) {
    const mk = (dur, v, type, f) => {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(musicGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    };
    if (tr.snare[i]) mk(0.13, 0.2, 'bandpass', 1900);
    if (tr.hat[i]) mk(0.035, 0.07 * tr.hat[i], 'highpass', 7500);
  }
}

function tick() {
  if (!ctx || !music.song || ctx.state !== 'running') return;
  const song = music.song;
  if (music.nextTime < ctx.currentTime - 0.3) music.nextTime = ctx.currentTime + 0.05;   // 后台挂起后追上
  while (music.nextTime < ctx.currentTime + 0.22) {
    scheduleStep(song, music.step, music.nextTime);
    music.nextTime += song.stepDur;
    music.step = (music.step + 1) % song.steps;
  }
}

export const audio = {
  ready: false,
  /** 需在用户手势内调用 */
  unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this.ready = true;
    if (!music.timer) music.timer = setInterval(tick, 40);
    if (music.pending) { const n = music.pending; music.pending = null; this.music(n); }
  },
  sfx(name, opts) {
    if (!this.ready || !ctx || ctx.state !== 'running' || vol.sfx <= 0) return;
    const f = SFX[name];
    if (!f) return;
    // 同名音效限流，避免一帧内叠几十个
    const now = ctx.currentTime;
    const minGap = (opts && opts.gap) || 0.035;
    if (lastPlayed[name] && now - lastPlayed[name] < minGap) return;
    lastPlayed[name] = now;
    try { f(); } catch (_) { /* ignore */ }
  },
  music(name) {
    if (music.name === name) return;
    music.name = name;
    if (!this.ready || !ctx) { music.pending = name; return; }
    if (!name || !SONGS[name]) { music.song = null; return; }
    if (!music.cache[name]) music.cache[name] = buildSong(SONGS[name]);
    music.song = music.cache[name];
    music.step = 0;
    music.nextTime = ctx.currentTime + 0.12;
  },
  stopMusic() { music.name = null; music.song = null; music.pending = null; },
  setVolumes(sfx, mus) {
    vol.sfx = sfx; vol.music = mus;
    if (ctx) {
      sfxGain.gain.setTargetAtTime(sfx, ctx.currentTime, 0.02);
      musicGain.gain.setTargetAtTime(mus * 0.5, ctx.currentTime, 0.05);
    }
  },
  /** 暂停菜单 / 失焦时压低音乐 */
  duck(on) { if (ctx) musicGain.gain.setTargetAtTime(vol.music * (on ? 0.18 : 0.5), ctx.currentTime, 0.08); },
  suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
  resume() { if (ctx && this.ready && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
};

/** 测试用：返回某首曲子的音序数据 */
export function debugSong(name) { return buildSong(SONGS[name]); }
export const SONG_NAMES = Object.keys(SONGS);
