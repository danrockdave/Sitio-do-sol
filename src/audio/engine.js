/**
 * Audio engine: Web Audio graph, settings, spatial sound effects, the
 * generative music and ambience (birds by day, crickets at night).
 *
 *   sound voices -> panner -> sfxBus ----\
 *   music voices --------> musicBus ------> master -> compressor -> speakers
 *   reverb sends -> convolver -> reverbReturn -/
 *
 * Browsers only allow audio after a user gesture, so the context is created
 * by unlock(), called from the first click or key press.
 */

import { createImpulse, createNoiseBuffer } from './synth.js';
import { SOUNDS } from './sounds.js';
import { MusicPlayer } from './music.js';
import { storage } from '../core/bridge.js';

const SETTINGS_KEY = 'sitio-do-sol-audio-v1';
const LEVELS = { master: 0.9, music: 0.55, sfx: 0.8, ambience: 0.6 };
const MAX_DISTANCE = 18;

function loadSettings() {
  try {
    const raw = storage.get(SETTINGS_KEY);
    if (raw) return { music: true, sfx: true, ...JSON.parse(raw) };
  } catch { /* invalid settings */ }
  return { music: true, sfx: true };
}

export class AudioEngine {
  constructor({ getMood }) {
    this.ctx = null;
    this.settings = loadSettings();
    this.getMood = getMood;
    this.listener = null;      // { pos: [x, y, z], project(pos) -> ndc | null }
    this.music = null;
    this.ambienceTimer = 2;
    this.cricketTimer = 0;
    this._recent = new Map();  // name -> last start time (avoid stacking identical sounds)

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  get ready() {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Creates (first call) or resumes the audio context. Call from a user gesture. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.attach(new Ctx());
    }
    if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume();
    if (this.settings.music) this.music.start();
  }

  /** Builds the node graph on a context (also used with OfflineAudioContext in tests). */
  attach(ctx) {
    this.ctx = ctx;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 3;
    this.compressor.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = LEVELS.master;
    this.master.connect(this.compressor);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.settings.music ? LEVELS.music : 0;
    this.musicBus.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.settings.sfx ? LEVELS.sfx : 0;
    this.sfxBus.connect(this.master);

    this.ambienceBus = ctx.createGain();
    this.ambienceBus.gain.value = LEVELS.ambience;
    this.ambienceBus.connect(this.sfxBus);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = createImpulse(ctx);
    this.reverbIn = ctx.createGain();
    this.reverbIn.gain.value = 1;
    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 0.35;
    this.reverbIn.connect(this.reverb);
    this.reverb.connect(this.reverbReturn);
    this.reverbReturn.connect(this.master);

    this.noiseBuffer = createNoiseBuffer(ctx);
    this.music = new MusicPlayer(this, this.getMood);
  }

  // ------------------------------------------------------------------
  // settings
  // ------------------------------------------------------------------

  _save() {
    storage.set(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  /** Re-reads the saved settings (after the native app restored them). */
  reloadSettings() {
    const saved = loadSettings();
    if (saved.music !== this.settings.music) this.setMusic(saved.music);
    if (saved.sfx !== this.settings.sfx) this.setSfx(saved.sfx);
  }

  /** Pauses all audio (app sent to the background). */
  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    // iOS reports 'interrupted' after calls and when the app returns from the background
    if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed' && !document.hidden) this.ctx.resume();
  }

  setMusic(on) {
    this.settings.music = on;
    this._save();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(on ? LEVELS.music : 0, t, 0.15);
    if (on) this.music.start();
    else setTimeout(() => { if (!this.settings.music) this.music.stop(); }, 800);
  }

  setSfx(on) {
    this.settings.sfx = on;
    this._save();
    if (!this.ctx) return;
    this.sfxBus.gain.setTargetAtTime(on ? LEVELS.sfx : 0, this.ctx.currentTime, 0.05);
  }

  /** Temporarily lowers the music (e.g. while sleeping). */
  duck(seconds = 2, level = 0.25) {
    if (!this.ctx || !this.settings.music) return;
    const g = this.musicBus.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(LEVELS.music * level, t, 0.2);
    g.setTargetAtTime(LEVELS.music, t + seconds, 0.6);
  }

  // ------------------------------------------------------------------
  // sound effects
  // ------------------------------------------------------------------

  /**
   * Plays a named effect. opts: pos (world position for distance and stereo),
   * volume, ambient (route to the ambience bus), plus recipe-specific options.
   */
  play(name, opts = {}) {
    if (!this.ready || !this.settings.sfx) return;
    const recipe = SOUNDS[name];
    if (!recipe) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.005;
    const last = this._recent.get(name) || 0;
    if (t - last < 0.035) return;
    this._recent.set(name, t);

    let volume = opts.volume ?? 1;
    let pan = 0;
    if (opts.pos && this.listener) {
      const p = this.listener.pos;
      const d = Math.hypot(opts.pos[0] - p[0], opts.pos[2] - p[2]);
      volume *= Math.max(0, 1 - d / MAX_DISTANCE) ** 1.5;
      if (volume < 0.02) return;
      const ndc = this.listener.project(opts.pos);
      if (ndc) pan = Math.max(-0.8, Math.min(0.8, ndc[0] * 0.75));
    }

    const gain = ctx.createGain();
    gain.gain.value = volume;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(opts.ambient ? this.ambienceBus : this.sfxBus);
    } else {
      gain.connect(opts.ambient ? this.ambienceBus : this.sfxBus);
    }
    recipe(this, gain, t, opts);
    // release the per-sound nodes once every voice has finished
    setTimeout(() => {
      try { gain.disconnect(); if (panner) panner.disconnect(); } catch { /* ignore */ }
    }, 4000);
  }

  /** Ambience: birds during the day, crickets at night. Call once per frame. */
  update(dt, night) {
    if (!this.ready || !this.settings.sfx) return;
    if (night) {
      this.cricketTimer -= dt;
      if (this.cricketTimer <= 0) {
        this.cricketTimer = 0.35 + Math.random() * 0.9;
        this._ambient('cricket', 0.7 + Math.random() * 0.5);
      }
    } else {
      this.ambienceTimer -= dt;
      if (this.ambienceTimer <= 0) {
        this.ambienceTimer = 2.5 + Math.random() * 6;
        this._ambient('bird', 0.5 + Math.random() * 0.6);
      }
    }
  }

  _ambient(name, volume) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.random() * 1.6 - 0.8;
    gain.connect(panner);
    panner.connect(this.ambienceBus);
    SOUNDS[name](this, gain, ctx.currentTime + 0.01, {});
    setTimeout(() => {
      try { gain.disconnect(); panner.disconnect(); } catch { /* ignore */ }
    }, 3000);
  }
}
