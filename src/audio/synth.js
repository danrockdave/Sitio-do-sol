/**
 * Small synthesis toolkit on top of the Web Audio API.
 * Every sound in the game is generated from oscillators and filtered
 * noise at runtime, so the project ships no audio files.
 *
 * All helpers take the audio engine `a` (for the context, the shared noise
 * buffer and the reverb input), an output node and a start time `t`.
 */

export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

const SILENT = 0.0001;

function cleanup(source, nodes) {
  source.onended = () => {
    for (const n of nodes) {
      try { n.disconnect(); } catch { /* already disconnected */ }
    }
  };
}

function connectReverb(a, node, amount, nodes) {
  if (!amount || !a.reverbIn) return;
  const send = a.ctx.createGain();
  send.gain.value = amount;
  node.connect(send);
  send.connect(a.reverbIn);
  nodes.push(send);
}

/**
 * Oscillator with an attack / exponential-decay envelope.
 * opts: type, freq, freqEnd, dur, attack, gain, detune, filter {type, freq, freqEnd, q},
 *       vibrato {rate, depth}, reverb (send amount), hold (seconds at full level)
 */
export function tone(a, out, t, opts) {
  const ctx = a.ctx;
  const {
    type = 'sine', freq, freqEnd = null, dur = 0.2, attack = 0.005, gain = 0.3, detune = 0,
    filter = null, vibrato = null, reverb = 0, hold = 0,
  } = opts;
  const nodes = [];
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
  if (detune) osc.detune.setValueAtTime(detune, t);
  nodes.push(osc);

  if (vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = vibrato.rate;
    depth.gain.value = vibrato.depth;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
    nodes.push(lfo, depth);
  }

  let node = osc;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type || 'lowpass';
    f.frequency.setValueAtTime(filter.freq, t);
    if (filter.freqEnd) f.frequency.exponentialRampToValueAtTime(filter.freqEnd, t + dur);
    f.Q.value = filter.q ?? 1;
    node.connect(f);
    node = f;
    nodes.push(f);
  }

  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  if (hold) g.gain.setValueAtTime(gain, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(SILENT, t + attack + hold + dur);
  node.connect(g);
  g.connect(out);
  nodes.push(g);
  connectReverb(a, g, reverb, nodes);

  osc.start(t);
  osc.stop(t + attack + hold + dur + 0.05);
  cleanup(osc, nodes);
  return osc;
}

/**
 * Filtered white noise burst.
 * opts: dur, type (filter type), freq, freqEnd, q, gain, attack, reverb, tremolo {rate, depth}
 */
export function noise(a, out, t, opts) {
  const ctx = a.ctx;
  const {
    dur = 0.2, type = 'bandpass', freq = 1000, freqEnd = null, q = 1, gain = 0.3, attack = 0.003,
    reverb = 0, tremolo = null,
  } = opts;
  const nodes = [];
  const src = ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  const offset = Math.random() * (a.noiseBuffer.duration - dur - 0.1);
  nodes.push(src);

  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  f.Q.value = q;
  src.connect(f);
  nodes.push(f);

  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
  f.connect(g);
  nodes.push(g);

  let last = g;
  if (tremolo) {
    const trem = ctx.createGain();
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    trem.gain.value = 1 - tremolo.depth;
    lfo.frequency.value = tremolo.rate;
    depth.gain.value = tremolo.depth;
    lfo.connect(depth);
    depth.connect(trem.gain);
    g.connect(trem);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    last = trem;
    nodes.push(trem, lfo, depth);
  }
  last.connect(out);
  connectReverb(a, last, reverb, nodes);

  src.start(t, Math.max(0, offset), dur + 0.05);
  cleanup(src, nodes);
  return src;
}

/** Mallet / kalimba pluck: fundamental plus a fast-decaying 4th partial and a tiny click. */
export function pluck(a, out, t, { freq, dur = 0.9, gain = 0.25, bright = 0.25, reverb = 0.25 }) {
  tone(a, out, t, { type: 'sine', freq, dur, attack: 0.004, gain, reverb });
  tone(a, out, t, { type: 'sine', freq: freq * 4.01, dur: dur * 0.28, attack: 0.002, gain: gain * bright, reverb });
  noise(a, out, t, { dur: 0.015, type: 'highpass', freq: 4000, gain: gain * 0.25 });
}

/** Soft bell / music box: inharmonic partials with long decay. */
export function bell(a, out, t, { freq, dur = 1.6, gain = 0.18, reverb = 0.4 }) {
  tone(a, out, t, { type: 'sine', freq, dur, attack: 0.004, gain, reverb });
  tone(a, out, t, { type: 'sine', freq: freq * 2.76, dur: dur * 0.5, attack: 0.002, gain: gain * 0.3, reverb });
  tone(a, out, t, { type: 'sine', freq: freq * 5.4, dur: dur * 0.25, attack: 0.002, gain: gain * 0.12, reverb });
}

/** Synthetic reverb impulse: stereo noise with an exponential tail. */
export function createImpulse(ctx, seconds = 2.4, decay = 3.2) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const k = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, decay) * (i < rate * 0.01 ? i / (rate * 0.01) : 1);
    }
  }
  return impulse;
}

export function createNoiseBuffer(ctx, seconds = 3) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
