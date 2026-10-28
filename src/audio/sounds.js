/**
 * Sound effect recipes. Each entry receives the engine `a`, an output node
 * (already panned and scaled for distance) and the start time `t`.
 */

import { tone, noise, pluck, bell, midiToFreq } from './synth.js';

const rnd = (min, max) => min + Math.random() * (max - min);

function arpeggio(a, out, t, notes, { step = 0.07, gain = 0.2, dur = 0.7, bright = 0.3, reverb = 0.3 } = {}) {
  notes.forEach((m, i) => pluck(a, out, t + i * step, { freq: midiToFreq(m), gain, dur, bright, reverb }));
}

/** Chicken "bawk": short nasal pulses through a formant filter. */
function chicken(a, out, t, scale = 1) {
  const base = rnd(480, 560);
  const pulses = Math.random() < 0.5 ? [0, 0.11] : [0, 0.09, 0.19];
  pulses.forEach((dt, i) => {
    const last = i === pulses.length - 1;
    tone(a, out, t + dt, {
      type: 'sawtooth', freq: base * (last ? 1.25 : 1), freqEnd: base * (last ? 0.8 : 1.15),
      dur: last ? 0.2 : 0.07, attack: 0.01, gain: 0.42 * scale,
      filter: { type: 'bandpass', freq: 1500, q: 4 }, reverb: 0.1,
    });
  });
}

/** Cow "moo": low sawtooth with a vowel-like filter sweep and vibrato. */
function cow(a, out, t, scale = 1) {
  const f = rnd(100, 120);
  tone(a, out, t, {
    type: 'sawtooth', freq: f, freqEnd: f * 0.82, dur: 0.75, attack: 0.18, hold: 0.25, gain: 0.15 * scale,
    filter: { type: 'lowpass', freq: 350, freqEnd: 1100, q: 6 }, vibrato: { rate: 4.5, depth: 2.5 }, reverb: 0.15,
  });
  tone(a, out, t, {
    type: 'sawtooth', freq: f * 2.01, freqEnd: f * 1.6, dur: 0.75, attack: 0.2, hold: 0.25, gain: 0.05 * scale,
    filter: { type: 'bandpass', freq: 700, q: 3 },
  });
}

/** Sheep "baa": bleating vibrato. */
function sheep(a, out, t, scale = 1) {
  const f = rnd(230, 270);
  tone(a, out, t, {
    type: 'sawtooth', freq: f, freqEnd: f * 0.88, dur: 0.55, attack: 0.04, hold: 0.12, gain: 0.32 * scale,
    filter: { type: 'bandpass', freq: 950, q: 2.5 }, vibrato: { rate: 8.5, depth: 14 }, reverb: 0.15,
  });
}

/** Rooster crow for the morning. */
function rooster(a, out, t) {
  const segments = [[520, 780, 0.16], [780, 980, 0.2], [980, 900, 0.35], [900, 600, 0.3]];
  let at = t;
  for (const [f0, f1, d] of segments) {
    tone(a, out, at, {
      type: 'sawtooth', freq: f0, freqEnd: f1, dur: d, attack: 0.02, gain: 0.3,
      filter: { type: 'bandpass', freq: 1700, q: 3 }, vibrato: { rate: 14, depth: 8 }, reverb: 0.25,
    });
    at += d * 0.85;
  }
}

function rustle(a, out, t, gain = 0.12, dur = 0.25) {
  noise(a, out, t, { dur, type: 'bandpass', freq: 3200, q: 0.9, gain, tremolo: { rate: 28, depth: 0.6 } });
}

export const SOUNDS = {
  // ---- farming -------------------------------------------------------
  till(a, out, t) {
    tone(a, out, t, { type: 'sine', freq: 140, freqEnd: 55, dur: 0.16, attack: 0.003, gain: 0.45 });
    noise(a, out, t, { dur: 0.2, type: 'lowpass', freq: 900, freqEnd: 250, q: 0.7, gain: 0.45 });
    noise(a, out, t + 0.05, { dur: 0.12, type: 'bandpass', freq: 2200, q: 1.2, gain: 0.12 });
  },
  clear(a, out, t) {
    rustle(a, out, t, 0.18, 0.3);
    tone(a, out, t + 0.05, { type: 'sine', freq: 180, freqEnd: 70, dur: 0.14, gain: 0.25 });
  },
  water(a, out, t) {
    noise(a, out, t, { dur: 0.6, type: 'bandpass', freq: 1400, q: 0.8, gain: 0.16, attack: 0.05, tremolo: { rate: 18, depth: 0.5 } });
    for (let i = 0; i < 7; i++) {
      const f = rnd(700, 1500);
      tone(a, out, t + 0.05 + i * rnd(0.05, 0.09), { type: 'sine', freq: f, freqEnd: f * 1.9, dur: 0.05, attack: 0.002, gain: 0.12, reverb: 0.2 });
    }
  },
  plant(a, out, t) {
    tone(a, out, t, { type: 'sine', freq: 320, freqEnd: 720, dur: 0.11, attack: 0.004, gain: 0.3, reverb: 0.15 });
    noise(a, out, t, { dur: 0.06, type: 'lowpass', freq: 700, gain: 0.2 });
    pluck(a, out, t + 0.08, { freq: midiToFreq(84), gain: 0.07, dur: 0.4, bright: 0.2, reverb: 0.3 });
  },
  harvest(a, out, t) {
    rustle(a, out, t, 0.14, 0.18);
    arpeggio(a, out, t + 0.04, [79, 84, 88], { step: 0.06, gain: 0.16, dur: 0.6 });
  },
  ripe(a, out, t) {
    bell(a, out, t, { freq: midiToFreq(91), gain: 0.05, dur: 0.9, reverb: 0.5 });
    bell(a, out, t + 0.09, { freq: midiToFreq(96), gain: 0.04, dur: 0.9, reverb: 0.5 });
  },
  fruit(a, out, t) {
    rustle(a, out, t, 0.2, 0.4);
    for (let i = 0; i < 3; i++) {
      tone(a, out, t + 0.12 + i * 0.09, { type: 'sine', freq: rnd(180, 240), freqEnd: 90, dur: 0.09, gain: 0.18 });
    }
    arpeggio(a, out, t + 0.1, [77, 81, 84, 89], { step: 0.06, gain: 0.13, dur: 0.6 });
  },
  collect(a, out, t) {
    arpeggio(a, out, t, [84, 88, 91], { step: 0.055, gain: 0.15, dur: 0.6 });
  },
  pet(a, out, t) {
    tone(a, out, t, { type: 'sine', freq: 660, freqEnd: 990, dur: 0.18, attack: 0.01, gain: 0.12, reverb: 0.3 });
    tone(a, out, t + 0.12, { type: 'sine', freq: 880, freqEnd: 1320, dur: 0.22, attack: 0.01, gain: 0.1, reverb: 0.3 });
  },

  // ---- animals ----------------------------------------------------------
  chicken(a, out, t, o) { chicken(a, out, t, o.scale ?? 1); },
  cow(a, out, t, o) { cow(a, out, t, o.scale ?? 1); },
  sheep(a, out, t, o) { sheep(a, out, t, o.scale ?? 1); },
  rooster(a, out, t) { rooster(a, out, t); },

  // ---- economy --------------------------------------------------------------
  sell(a, out, t) {
    noise(a, out, t, { dur: 0.07, type: 'lowpass', freq: 1200, gain: 0.25 });
    tone(a, out, t + 0.04, { type: 'square', freq: midiToFreq(88), dur: 0.08, attack: 0.002, gain: 0.07, filter: { type: 'lowpass', freq: 5000 } });
    tone(a, out, t + 0.11, { type: 'square', freq: midiToFreq(93), dur: 0.5, attack: 0.002, gain: 0.07, filter: { type: 'lowpass', freq: 5000 }, reverb: 0.3 });
    bell(a, out, t + 0.11, { freq: midiToFreq(100), gain: 0.06, dur: 0.6 });
    noise(a, out, t + 0.11, { dur: 0.45, type: 'highpass', freq: 7000, gain: 0.05 });
  },
  buy(a, out, t) {
    arpeggio(a, out, t, [72, 76, 79, 84], { step: 0.065, gain: 0.15, dur: 0.6 });
  },
  upgrade(a, out, t) {
    arpeggio(a, out, t, [72, 76, 79, 84, 88], { step: 0.08, gain: 0.15, dur: 0.9 });
    [60, 64, 67].forEach((m) => tone(a, out, t + 0.4, {
      type: 'triangle', freq: midiToFreq(m), dur: 1.2, attack: 0.05, gain: 0.07, reverb: 0.4,
    }));
  },
  goal(a, out, t) {
    const melody = [72, 76, 79, 84, 79, 84, 88];
    melody.forEach((m, i) => pluck(a, out, t + i * 0.11, { freq: midiToFreq(m), gain: 0.17, dur: 0.8, reverb: 0.4 }));
    [60, 64, 67, 72].forEach((m) => tone(a, out, t + 0.75, {
      type: 'triangle', freq: midiToFreq(m), dur: 1.8, attack: 0.08, gain: 0.07, reverb: 0.5,
    }));
  },
  bin(a, out, t) {
    tone(a, out, t, { type: 'sine', freq: 210, freqEnd: 120, dur: 0.18, gain: 0.25 });
    noise(a, out, t, { dur: 0.12, type: 'bandpass', freq: 600, q: 2, gain: 0.25 });
    tone(a, out, t + 0.02, { type: 'sawtooth', freq: 90, freqEnd: 140, dur: 0.22, gain: 0.04, filter: { type: 'bandpass', freq: 800, q: 6 } });
  },

  // ---- interface ----------------------------------------------------------
  click(a, out, t) {
    tone(a, out, t, { type: 'sine', freq: 1250, freqEnd: 900, dur: 0.045, attack: 0.002, gain: 0.12 });
  },
  select(a, out, t) {
    tone(a, out, t, { type: 'triangle', freq: 880, dur: 0.05, attack: 0.002, gain: 0.08 });
  },
  open(a, out, t) {
    noise(a, out, t, { dur: 0.22, type: 'bandpass', freq: 500, freqEnd: 2400, q: 1.2, gain: 0.09, attack: 0.05 });
    pluck(a, out, t + 0.1, { freq: midiToFreq(81), gain: 0.1, dur: 0.5 });
  },
  close(a, out, t) {
    noise(a, out, t, { dur: 0.2, type: 'bandpass', freq: 2200, freqEnd: 500, q: 1.2, gain: 0.07, attack: 0.03 });
    pluck(a, out, t + 0.05, { freq: midiToFreq(76), gain: 0.07, dur: 0.4 });
  },
  error(a, out, t) {
    tone(a, out, t, { type: 'square', freq: 247, dur: 0.09, attack: 0.003, gain: 0.05, filter: { type: 'lowpass', freq: 1400 } });
    tone(a, out, t + 0.1, { type: 'square', freq: 196, dur: 0.16, attack: 0.003, gain: 0.05, filter: { type: 'lowpass', freq: 1200 } });
  },
  step(a, out, t, o) {
    const dirt = o.surface === 'dirt';
    noise(a, out, t, {
      dur: dirt ? 0.07 : 0.09, type: dirt ? 'bandpass' : 'lowpass', freq: dirt ? rnd(900, 1300) : rnd(1600, 2400), q: 0.8,
      gain: dirt ? 0.09 : 0.05, attack: 0.004,
    });
    tone(a, out, t, { type: 'sine', freq: rnd(70, 90), freqEnd: 45, dur: 0.06, gain: 0.06 });
  },
  sleep(a, out, t) {
    [84, 81, 77, 74, 72].forEach((m, i) => bell(a, out, t + i * 0.32, { freq: midiToFreq(m), gain: 0.09, dur: 1.4, reverb: 0.6 }));
  },
  morning(a, out, t) {
    rooster(a, out, t + 0.1);
    arpeggio(a, out, t + 1.1, [72, 77, 81, 84], { step: 0.09, gain: 0.12, dur: 0.8, reverb: 0.4 });
  },

  // ---- ambience -------------------------------------------------------------
  bird(a, out, t) {
    const base = rnd(2400, 3600);
    const chirps = 2 + Math.floor(Math.random() * 4);
    let at = t;
    for (let i = 0; i < chirps; i++) {
      const up = Math.random() < 0.6;
      tone(a, out, at, {
        type: 'sine', freq: base * (up ? 0.85 : 1.2), freqEnd: base * (up ? 1.25 : 0.8),
        dur: rnd(0.05, 0.11), attack: 0.004, gain: 0.05, reverb: 0.35,
      });
      at += rnd(0.08, 0.16);
    }
  },
  cricket(a, out, t) {
    const f = rnd(4300, 4900);
    for (let i = 0; i < 3; i++) {
      tone(a, out, t + i * 0.045, { type: 'sine', freq: f, dur: 0.028, attack: 0.004, gain: 0.04, reverb: 0.2 });
    }
  },
};
