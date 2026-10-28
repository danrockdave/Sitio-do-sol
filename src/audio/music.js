/**
 * Generative background music (Web Audio, no audio files).
 *
 * The song is in F major and loops over 8-bar sections. Each section picks a
 * mood from the in-game time:
 *   day   : 96 BPM, warm pad, plucked bass, kalimba melody, light percussion
 *           and an acoustic "strum" on beats 2 and 4
 *   night : 70 BPM, dreamy maj7 chords, soft bass and a sparse music-box melody
 * A new melody is composed for every section from the F major pentatonic
 * scale with a motif / variation structure (A A' B A''), so it never repeats
 * exactly but always sounds like the same piece.
 *
 * Notes are scheduled slightly ahead of time with the Web Audio clock
 * (lookahead scheduler) so timing stays tight even if a frame is slow.
 */

import { tone, noise, pluck, bell, midiToFreq } from './synth.js';

const CHORDS = {
  F: [53, [0, 4, 7, 14]],
  C: [48, [0, 4, 7, 14]],
  Dm: [50, [0, 3, 7, 10]],
  Bb: [46, [0, 4, 7, 14]],
  Am: [45, [0, 3, 7, 10]],
  Gm: [43, [0, 3, 7, 10]],
  Fmaj7: [53, [0, 4, 7, 11]],
  Bbmaj7: [46, [0, 4, 7, 11]],
  Am7: [45, [0, 3, 7, 10]],
  Dm7: [50, [0, 3, 7, 10]],
  Csus: [48, [0, 5, 7, 14]],
};

const PROGRESSIONS = {
  day: [
    ['F', 'C', 'Dm', 'Bb', 'F', 'Am', 'Bb', 'C'],
    ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C'],
  ],
  night: [
    ['Fmaj7', 'Am7', 'Bbmaj7', 'Csus', 'Fmaj7', 'Dm7', 'Bbmaj7', 'C'],
  ],
};

// F major pentatonic, F4 .. D6
const SCALE = [65, 67, 69, 72, 74, 77, 79, 81, 84, 86];

const RHYTHMS = {
  day: [
    [1, 0, 1, 0, 1, 0, 1, 1],
    [1, 0, 0, 1, 1, 0, 1, 0],
    [1, 1, 1, 0, 1, 0, 0, 0],
    [1, 0, 1, 1, 0, 1, 0, 0],
    [1, 0, 0, 0, 1, 0, 1, 0],
    [0, 0, 1, 0, 1, 1, 1, 0],
  ],
  night: [
    [1, 0, 0, 0, 0, 0, 1, 0],
    [1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 0],
    [1, 0, 0, 1, 0, 0, 0, 0],
  ],
};

export class MusicPlayer {
  /** getMood() returns 'day' or 'night'. */
  constructor(engine, getMood) {
    this.engine = engine;
    this.getMood = getMood;
    this.running = false;
    this.timer = null;
    this.bar = 0;
    this.nextBarTime = 0;
    this.section = null;
  }

  start() {
    if (this.running || !this.engine.ctx) return;
    this.running = true;
    this.bar = 0;
    this.nextBarTime = this.engine.ctx.currentTime + 0.15;
    this.timer = setInterval(() => this.schedule(), 60);
    this.schedule();
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Schedules every bar that starts within the lookahead window. */
  schedule(lookahead = 0.35) {
    const ctx = this.engine.ctx;
    while (this.nextBarTime < ctx.currentTime + lookahead) {
      // after a long pause (hidden tab) restart cleanly instead of catching up
      if (this.nextBarTime < ctx.currentTime - 0.5) this.nextBarTime = ctx.currentTime + 0.05;
      const duration = this.scheduleBar(this.bar, this.nextBarTime);
      this.nextBarTime += duration;
      this.bar += 1;
    }
  }

  _newSection() {
    const mood = this.getMood();
    const options = PROGRESSIONS[mood];
    const progression = options[Math.floor(Math.random() * options.length)];
    this.section = {
      mood,
      bpm: mood === 'day' ? 96 : 70,
      progression,
      melody: composeMelody(progression, mood),
    };
  }

  /** Schedules one bar starting at time t and returns its duration in seconds. */
  scheduleBar(index, t) {
    const inSection = index % 8;
    if (inSection === 0 || !this.section) this._newSection();
    const s = this.section;
    const a = this.engine;
    const out = a.musicBus;
    const beat = 60 / s.bpm;
    const eighth = beat / 2;
    const barLength = beat * 4;
    const [root, intervals] = CHORDS[s.progression[inSection]];
    const day = s.mood === 'day';

    // pad: two detuned triangles per chord tone, slow attack
    for (const iv of intervals) {
      const freq = midiToFreq(root + 12 + iv);
      for (const detune of [-7, 7]) {
        tone(a, out, t, {
          type: 'triangle', freq, detune, dur: 1.2, attack: barLength * 0.35, hold: barLength * 0.55,
          gain: day ? 0.022 : 0.026, filter: { type: 'lowpass', freq: day ? 1300 : 800, q: 0.5 }, reverb: 0.5,
        });
      }
    }

    // bass
    const bassFreq = midiToFreq(root - 12 + (root < 48 ? 12 : 0));
    const bassBeats = day ? [0, 2] : [0];
    for (const b of bassBeats) {
      tone(a, out, t + b * beat, { type: 'sine', freq: bassFreq, dur: day ? 0.55 : 1.4, attack: 0.01, gain: 0.3 });
      tone(a, out, t + b * beat, { type: 'triangle', freq: bassFreq * 2, dur: 0.25, attack: 0.01, gain: 0.04 });
    }
    if (day && inSection % 2 === 1) {
      // walking approach note on beat 4 (the fifth)
      tone(a, out, t + 3.5 * beat, { type: 'sine', freq: bassFreq * 1.5, dur: 0.3, attack: 0.01, gain: 0.18 });
    }

    // melody
    for (const note of s.melody[inSection]) {
      const at = t + note.step * eighth + (Math.random() - 0.5) * 0.012;
      if (day) pluck(a, out, at, { freq: midiToFreq(note.midi), dur: 0.5 + note.len * eighth, gain: 0.16, bright: 0.3, reverb: 0.3 });
      else bell(a, out, at, { freq: midiToFreq(note.midi), dur: 1.4 + note.len * eighth, gain: 0.09, reverb: 0.55 });
    }

    if (day) {
      // acoustic strum on beats 2 and 4
      for (const b of [1, 3]) {
        intervals.slice(0, 3).forEach((iv, k) => {
          tone(a, out, t + b * beat + k * 0.014, {
            type: 'triangle', freq: midiToFreq(root + 12 + iv), dur: 0.22, attack: 0.003, gain: 0.035,
            filter: { type: 'lowpass', freq: 2200 }, reverb: 0.2,
          });
        });
      }
      // kick, rim and shaker
      for (const b of [0, 2]) tone(a, out, t + b * beat, { type: 'sine', freq: 95, freqEnd: 42, dur: 0.18, attack: 0.002, gain: 0.22 });
      for (const b of [1, 3]) noise(a, out, t + b * beat, { dur: 0.05, type: 'bandpass', freq: 1900, q: 1.5, gain: 0.05 });
      for (let e = 0; e < 8; e++) {
        noise(a, out, t + e * eighth, { dur: 0.035, type: 'highpass', freq: 7000, gain: e % 2 ? 0.028 : 0.014 });
      }
    }
    return barLength;
  }
}

/** 8 bars of melody: motif A, A', B, A'' (ending on the tonic). */
function composeMelody(progression, mood) {
  const rhythms = RHYTHMS[mood];
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const chordPitchClasses = (name) => {
    const [root, intervals] = CHORDS[name];
    return intervals.map((iv) => (root + iv) % 12);
  };
  const nearestChordTone = (idx, name) => {
    const pcs = chordPitchClasses(name);
    for (let d = 0; d < SCALE.length; d++) {
      for (const k of [idx + d, idx - d]) {
        if (k >= 0 && k < SCALE.length && pcs.includes(SCALE[k] % 12)) return k;
      }
    }
    return idx;
  };

  const makeTwoBars = (startIdx, bars, rhythmPair) => {
    let idx = startIdx;
    return rhythmPair.map((rhythm, b) => {
      const chord = progression[bars[b]];
      const notes = [];
      rhythm.forEach((hit, step) => {
        if (!hit) return;
        idx += pick([-2, -1, -1, 0, 1, 1, 2]);
        idx = Math.max(1, Math.min(SCALE.length - 2, idx));
        if (step === 0 || step === 4) idx = nearestChordTone(idx, chord);
        notes.push({ step, idx });
      });
      return notes;
    });
  };

  const rhythmA = [pick(rhythms), pick(rhythms)];
  const rhythmB = [pick(rhythms), pick(rhythms)];
  const a1 = makeTwoBars(3 + Math.floor(Math.random() * 3), [0, 1], rhythmA);
  // A': same rhythm and contour, last notes varied and re-fitted to the chords
  const a2 = a1.map((notes, b) => notes.map((n, k) => {
    const vary = k >= notes.length - 2 ? pick([-1, 0, 1]) : 0;
    let idx = Math.max(1, Math.min(SCALE.length - 2, n.idx + vary));
    if (n.step === 0 || n.step === 4) idx = nearestChordTone(idx, progression[2 + b]);
    return { step: n.step, idx };
  }));
  const b1 = makeTwoBars(5, [4, 5], rhythmB);
  const a3 = a1.map((notes, b) => notes.map((n) => {
    let idx = n.idx;
    if (n.step === 0 || n.step === 4) idx = nearestChordTone(idx, progression[6 + b]);
    return { step: n.step, idx };
  }));
  // final cadence: land on F
  const lastBar = a3[1];
  if (lastBar.length) lastBar[lastBar.length - 1].idx = SCALE.indexOf(77);

  const bars = [...a1, ...a2, ...b1, ...a3];
  // note lengths (in eighths) until the next note, capped
  return bars.map((notes) => notes.map((n, k) => {
    const next = k + 1 < notes.length ? notes[k + 1].step : 8;
    return { step: n.step, midi: SCALE[n.idx], len: Math.min(3, next - n.step) };
  }));
}
