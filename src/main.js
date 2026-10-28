/**
 * Sítio do Sol — entry point and main loop.
 *
 * Flow: load shaders + font -> loading screen -> load models/textures ->
 * build the HUD icon atlas -> title screen -> game.
 *
 * The same code runs on desktops (mouse and keyboard), on phones and
 * tablets (touch controls) and inside the Android / iOS app shell
 * (src/core/bridge.js).
 */

import { createContext, resizeCanvas } from './gl/context.js';
import { createTexture, updateTexture } from './gl/texture.js';
import { Input } from './core/input.js';
import { PLATFORM, QUALITY_PRESETS, QUALITY_ORDER, defaultQuality, readSafeArea } from './core/platform.js';
import { bridge, storage } from './core/bridge.js';
import { AssetLibrary } from './loaders/assets.js';
import { Renderer } from './render/renderer.js';
import { RenderQueue } from './render/queue.js';
import { FollowCamera } from './render/camera.js';
import { computeEnvironment } from './render/lighting.js';
import { SceneBuilder } from './render/scene.js';
import { IconAtlas } from './render/icons.js';
import { UI } from './ui/ui.js';
import { drawHud, DEBUG_VIEW_COUNT, debugViewName } from './ui/hud.js';
import { Menus, drawLoading, drawTitle } from './ui/menus.js';
import { World } from './game/world.js';
import { Game } from './game/game.js';
import { ICONS, HOTBAR } from './game/data.js';
import { AudioEngine } from './audio/engine.js';

const canvas = document.getElementById('game');
const params = PLATFORM.params;
const SPEEDS = [1, 8, 30];
const QUALITY_KEY = 'sitio-do-sol-quality-v1';

// sounds that also vibrate the phone inside the native app
const HAPTICS = {
  till: 'light', plant: 'light', water: 'light', harvest: 'medium', collect: 'medium', fruit: 'medium',
  sell: 'success', buy: 'light', upgrade: 'success', goal: 'success', error: 'warning',
};

function showError(err) {
  console.error(err);
  const box = document.getElementById('error');
  box.textContent = `Erro: ${err.message || err}`;
  box.style.display = 'block';
}

async function boot() {
  if (PLATFORM.touch) document.documentElement.classList.add('touch');
  const gl = createContext(canvas, { preserveDrawingBuffer: params.has('capture') });
  const input = new Input(canvas, { touch: PLATFORM.touch });
  const assets = new AssetLibrary(gl);
  await assets.loadEssentials();
  const ui = new UI(gl, assets, input);
  input.uiHitTest = (x, y) => ui.hitTestCss(x, y);
  document.getElementById('boot').style.display = 'none';

  let qualityId = storage.get(QUALITY_KEY);
  if (!QUALITY_PRESETS[qualityId]) qualityId = defaultQuality();
  let quality = QUALITY_PRESETS[qualityId];
  const dprCap = () => parseFloat(params.get('dpr')) || quality.maxDpr;   // ?dpr=3 for store captures

  let safe = readSafeArea();
  window.addEventListener('resize', () => { safe = readSafeArea(); });
  const uiOptions = () => ({ touch: PLATFORM.touch, safe });

  // loading screen while models and textures arrive
  let loadProgress = 0;
  let loadLabel = '';
  let loading = true;
  const drawLoadingFrame = () => {
    if (!loading) return;
    const { width, height, dpr } = resizeCanvas(gl, canvas, dprCap());
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.98, 0.93, 0.8, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    ui.begin(width, height, dpr, uiOptions());
    drawLoading(ui, loadProgress, `Carregando ${loadLabel}`);
    ui.end();
    requestAnimationFrame(drawLoadingFrame);
  };
  requestAnimationFrame(drawLoadingFrame);
  await assets.loadWorldAssets((p, label) => {
    loadProgress = p;
    loadLabel = label;
  });
  loading = false;

  const renderer = new Renderer(gl, assets);
  const icons = new IconAtlas(gl, renderer, assets, ICONS);
  icons.build();
  ui.icons = icons;

  const world = new World();
  const game = new Game(world);
  game.tapToWalk = PLATFORM.touch;
  game.showcase();
  const scene = new SceneBuilder(gl, assets, world);
  const splatTexture = createTexture(gl, world.splatImage(), { repeat: false, mipmaps: false });
  const camera = new FollowCamera();
  const queue = new RenderQueue();
  const overlay = new RenderQueue();
  const billboards = [];
  const menus = new Menus(ui, game);
  const settings = { shadows: true, debugView: 0, tips: true, debug: params.has('debug'), hud: !params.has('nohud') };

  const applyQuality = (id) => {
    qualityId = id;
    quality = QUALITY_PRESETS[id];
    renderer.setShadowSize(quality.shadowSize);
    renderer.settings.pcf = quality.pcf;
    scene.quality = quality;
  };
  applyQuality(qualityId);

  // sound: created on the first click, tap or key press (browser autoplay rules)
  const audio = new AudioEngine({ getMood: () => (computeEnvironment(game.clock.hour).isNight ? 'night' : 'day') });
  const unlockAudio = () => audio.unlock();
  // touch only counts as a user gesture on pointerup / touchend in mobile browsers
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown']) window.addEventListener(type, unlockAudio);
  ui.onClick = () => audio.play('click');
  let lastMenu = null;

  let state = 'title';
  let hasSave = Game.hasSave();
  let last = performance.now();
  let fps = 60;
  let fade = null;          // { t, slept } for the sleep transition
  let titleTime = 0;
  let pendingTouch = null;  // action button pressed in the previous frame
  let announcedReady = false;

  const startPlaying = () => {
    state = 'playing';
    camera.target = [...game.player.pos];
    camera.yaw = 0;
    camera.distance = PLATFORM.touch ? 13 : 14;
    camera.pitch = 0.92;
  };

  const handleMenuAction = (action) => {
    switch (action) {
      case 'save':
        game.toast(game.save() ? 'Jogo salvo!' : 'Não foi possível salvar.', 'good');
        hasSave = Game.hasSave();
        break;
      case 'toggleShadows':
        settings.shadows = !settings.shadows;
        break;
      case 'cycleView':
        settings.debugView = (settings.debugView + 1) % DEBUG_VIEW_COUNT;
        break;
      case 'cycleQuality': {
        const next = QUALITY_ORDER[(QUALITY_ORDER.indexOf(qualityId) + 1) % QUALITY_ORDER.length];
        applyQuality(next);
        storage.set(QUALITY_KEY, next);
        break;
      }
      case 'toggleTips':
        settings.tips = !settings.tips;
        break;
      case 'toggleMusic':
        audio.setMusic(!audio.settings.music);
        break;
      case 'toggleSfx':
        audio.setSfx(!audio.settings.sfx);
        break;
      case 'toggleHaptics':
        bridge.hapticsEnabled = !bridge.hapticsEnabled;
        if (bridge.hapticsEnabled) bridge.haptic('medium');
        break;
      case 'title':
        game.save();
        hasSave = Game.hasSave();
        game.showcase();
        state = 'title';
        break;
      case 'sleep':
        fade = { t: 0, slept: false };
        audio.play('sleep');
        audio.duck(3.2);
        break;
      default:
        break;
    }
  };

  const rayAt = (cssX, cssY) => {
    const nx = (cssX / canvas.clientWidth) * 2 - 1;
    const ny = 1 - (cssY / canvas.clientHeight) * 2;
    return camera.rayFromNdc(nx, ny);
  };

  const controlsFrom = (dt) => {
    const blocked = ui.mouseBlocked();
    const { forward, right } = camera.groundAxes();
    let f = 0;
    let s = 0;
    let running = input.down('ShiftLeft') || input.down('ShiftRight');

    if (!menus.open) {
      camera.yaw -= input.dragX * (PLATFORM.touch ? 0.008 : 0.006);
      if (input.down('KeyZ')) camera.yaw += dt * 1.8;
      if (input.down('KeyC')) camera.yaw -= dt * 1.8;
      if (input.wheel && !blocked) camera.zoom(input.wheel * 0.12);
      if (input.pinch) camera.zoom(input.pinch);
    }
    if (input.down('KeyW') || input.down('ArrowUp')) f += 1;
    if (input.down('KeyS') || input.down('ArrowDown')) f -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) s += 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) s -= 1;
    const stick = input.joystickVector();
    if (stick.length > 0.12) {
      f = -stick.y;
      s = stick.x;
      running = stick.length > 0.92;
    }
    const move = [forward[0] * f + right[0] * s, forward[2] * f + right[2] * s];

    let select = null;
    for (let i = 0; i < HOTBAR.length; i++) {
      if (input.wasPressed(`Digit${i + 1}`, `Numpad${i + 1}`)) select = i;
    }

    const controls = { move, running, use: false, interact: false, ray: null, rayFromMouse: false, select };
    if (PLATFORM.touch) {
      const tap = input.taps[0];
      if (tap && !menus.open) {
        controls.ray = rayAt(tap.x, tap.y);
        controls.rayFromMouse = true;
        controls.use = true;
      }
      if (pendingTouch === 'use') controls.use = true;
      if (pendingTouch === 'interact') controls.interact = true;
      pendingTouch = null;
    } else {
      const mouseActive = input.mouse.inside && !blocked;
      if (mouseActive) controls.ray = rayAt(input.mouse.x, input.mouse.y);
      controls.rayFromMouse = mouseActive;
      controls.use = (input.mousePressed(0) && mouseActive) || input.wasPressed('Space');
      controls.interact = input.wasPressed('KeyE');
    }
    return controls;
  };

  const goBack = () => {
    if (fade) return true;
    if (menus.open) {
      menus.back();
      return true;
    }
    if (state === 'playing') {
      menus.show('pause');
      return true;
    }
    return false;
  };

  const globalKeys = () => {
    if (input.wasPressed('F3')) settings.debug = !settings.debug;
    if (input.wasPressed('F4')) settings.debugView = (settings.debugView + 1) % DEBUG_VIEW_COUNT;
    if (input.wasPressed('F2')) settings.shadows = !settings.shadows;
    if (input.wasPressed('F1')) settings.hud = !settings.hud;
    if (input.wasPressed('KeyM')) {
      audio.setMusic(!audio.settings.music);
      if (state === 'playing') game.toast(audio.settings.music ? 'Música ligada' : 'Música desligada', 'info');
    }
    if (input.wasPressed('Escape') && (state === 'playing' || menus.open)) goBack();
    if (state !== 'playing') return;
    if (input.wasPressed('Tab')) {
      if (menus.open === 'inventory') menus.close();
      else if (!menus.open) menus.show('inventory');
    }
    if (input.wasPressed('KeyH') && !menus.open) {
      menus.returnTo = null;
      menus.show('help');
    }
    if (input.wasPressed('KeyT') && !menus.open) {
      const next = SPEEDS[(SPEEDS.indexOf(game.clock.speed) + 1) % SPEEDS.length];
      game.clock.speed = next;
      game.toast(next === 1 ? 'Tempo normal' : `Tempo acelerado x${next}`, 'info');
    }
  };

  // calls from the native app shell
  window.sitioApp = {
    restore(values) {
      if (storage.restore(values)) {
        hasSave = Game.hasSave();
        audio.reloadSettings();
        const saved = storage.get(QUALITY_KEY);
        if (QUALITY_PRESETS[saved]) applyQuality(saved);
      }
    },
    onPause() {
      if (state === 'playing') {
        if (!menus.open && !fade) menus.show('pause');
        game.save();
        hasSave = true;
      }
      audio.suspend();
    },
    onResume() {
      audio.resume();
    },
    onBack() {
      return goBack();
    },
  };

  let frameCount = 0;
  const frame = (now) => {
    frameCount++;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fps += (1 / Math.max(dt, 1e-4) - fps) * 0.05;

    const { width, height, dpr } = resizeCanvas(gl, canvas, dprCap());
    ui.begin(width, height, dpr, uiOptions());
    ui.modal = !!menus.open || state !== 'playing';
    globalKeys();
    renderer.settings.shadows = settings.shadows;
    renderer.settings.debugView = settings.debugView;

    if (state === 'title') {
      titleTime += dt;
      game.idle(dt);
      game.clock.hour = 17.1;
      camera.target = [2, 0, -1];
      camera.yaw = 0.35 + Math.sin(titleTime * 0.05) * 0.5;
      camera.pitch = 0.55;
      camera.distance = 25;
    } else {
      const controls = controlsFrom(dt);
      if (controls.select !== null && controls.select !== game.selected) game.sound('select');
      const paused = !!menus.open || fade !== null;
      game.update(dt, paused ? { move: [0, 0], select: null } : controls, paused);
      for (const ev of game.events) {
        if (ev.type === 'shop') menus.show('shop');
        else if (ev.type === 'sell') menus.show('sell');
        else if (ev.type === 'sleep') menus.show('sleep');
        else if (ev.type === 'goal') {
          menus.show('goal');
          audio.play('goal');
          bridge.haptic('success');
        }
      }
      game.events.length = 0;
      camera.follow([game.player.pos[0], 0.6, game.player.pos[2]], dt);
    }

    camera.update(width / height);
    const env = computeEnvironment(game.clock.hour);

    // audio and haptics: drain the game's sound events, ambience
    audio.listener = { pos: game.player.pos, project: (p) => camera.project(p) };
    if (state === 'playing') {
      for (const s of game.sounds) {
        audio.play(s.name, s);
        if (HAPTICS[s.name] && !s.ambient) bridge.haptic(HAPTICS[s.name]);
      }
    }
    game.sounds.length = 0;
    audio.update(dt, env.isNight);
    if (game.fieldDirty) {
      updateTexture(gl, splatTexture, world.splatImage());
      game.fieldDirty = false;
    }
    scene.build(game, env, queue, overlay, billboards, icons, camera);
    renderer.render({
      width, height, camera, env, time: game.time, queue, overlay, billboards,
      pointLights: scene.pointLights(game, env, camera),
      ground: { splatTexture, splatRect: world.splatRect },
      iconTexture: icons.texture,
    });

    // interface
    const menuSettings = {
      ...settings, music: audio.settings.music, sfx: audio.settings.sfx, qualityLabel: quality.label,
      haptics: bridge.hapticsEnabled,
    };
    if (state === 'title') {
      if (!menus.open) {
        const action = drawTitle(ui, hasSave, titleTime, { art: params.has('art') });
        if (action === 'new') {
          game.newGame();
          startPlaying();
          game.toast('Bem-vindo ao Sítio do Sol!', 'good');
        } else if (action === 'continue') {
          if (game.loadSaved()) startPlaying();
          else game.showcase();
        } else if (action === 'help' || action === 'about') {
          menus.returnTo = null;
          menus.show(action);
        }
      }
      menus.draw(dt, menuSettings);
      if (!announcedReady) {
        announcedReady = true;
        bridge.ready();
      }
    } else {
      if (settings.hud) {
        const touchActions = drawHud(ui, game, camera, {
          tips: settings.tips, debug: settings.debug, fps, stats: renderer.stats,
          debugView: settings.debugView, shadows: settings.shadows,
          touch: PLATFORM.touch, controls: !menus.open && !fade, input,
        });
        if (!menus.open && !fade) {
          if (touchActions.action) pendingTouch = touchActions.action;
          if (touchActions.pause) menus.show('pause');
          if (touchActions.backpack) menus.show('inventory');
        }
      } else if (settings.debugView) {
        ui.text(`Phong: ${debugViewName(settings.debugView)}`, 18, 18, 18, [1, 1, 1, 1], { shadow: true });
      }
      handleMenuAction(menus.draw(dt, menuSettings));
    }
    if (menus.open !== lastMenu) {
      if (menus.open && !lastMenu) audio.play('open');
      else if (!menus.open && lastMenu) audio.play('close');
      lastMenu = menus.open;
    }

    if (fade) {
      fade.t += dt;
      const a = fade.t < 0.8 ? fade.t / 0.8 : Math.max(0, 1 - (fade.t - 1.4) / 0.9);
      if (!fade.slept && fade.t >= 0.8) {
        game.sleep();
        fade.slept = true;
        audio.play('morning');
        hasSave = Game.hasSave();
      }
      ui.rect(0, 0, ui.w, ui.h, [0.03, 0.03, 0.08, a]);
      if (fade.t > 0.5 && fade.t < 1.8) {
        ui.text('Zzz...', ui.w / 2, ui.h / 2, 48, [1, 1, 1, Math.min(1, a * 1.5)], { align: 'center', valign: 'middle' });
      }
      if (fade.t > 2.3) fade = null;
    }

    ui.end();
    canvas.style.cursor = ui.cursor;
    input.endFrame();
    requestAnimationFrame(frame);
  };
  // handle for automated tests and the browser console
  window.__sitio = {
    game, camera, renderer, menus, settings, audio, input, ui,
    get fps() { return fps; },
    get frames() { return frameCount; },
    get quality() { return qualityId; },
    get state() { return state; },
  };
  requestAnimationFrame(frame);
}

boot().catch(showError);
