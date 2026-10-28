/**
 * In-game HUD: clock, money and goal, tips, hotbar, interaction prompt,
 * notifications, floating texts, the debug overlay and (on touch screens)
 * the joystick, the action button and the menu buttons.
 */

import { C } from './ui.js';
import { ITEMS, HOTBAR, CROPS, CROP_STAGES, GOAL_MONEY } from '../game/data.js';

export function formatMoney(n) {
  return `R$ ${Math.floor(n).toLocaleString('pt-BR')}`;
}

/**
 * options: { tips, debug, fps, stats, debugView, shadows, touch, input }
 * Returns touch actions for main.js: { action: 'use' | 'interact' | null, pause, backpack }.
 */
export function drawHud(ui, game, camera, options) {
  const touch = !!options.touch;
  const actions = { action: null, pause: false, backpack: false };
  drawClock(ui, game);
  if (options.tips) drawTip(ui, game, touch);
  drawMoney(ui, game);
  const bar = drawHotbar(ui, game, touch);
  drawPrompt(ui, game, touch, bar);
  drawTileTooltip(ui, game, camera, touch);
  drawToasts(ui, game);
  drawFloaters(ui, game, camera);
  if (touch) {
    if (options.controls !== false) Object.assign(actions, drawTouchControls(ui, game, options.input, bar));
  } else {
    ui.text('H ajuda   ·   Esc menu   ·   Tab mochila', ui.w - 18, ui.h - 16, 13, [1, 1, 1, 0.75],
      { align: 'right', valign: 'baseline', shadow: true });
  }
  if (options.debug) drawDebug(ui, game, options);
  return actions;
}

function drawClock(ui, game) {
  const x = 18 + ui.safe.left;
  const y = 16 + ui.safe.top;
  const w = 214;
  const h = 84;
  ui.panel(x, y, w, h, { radius: 18 });
  const clock = game.clock;
  const hour = clock.hour;
  const night = hour < 5.5 || hour >= 19;
  // sun / moon badge
  const cx = x + 40;
  const cy = y + h / 2;
  ui.rect(cx - 22, cy - 22, 44, 44, night ? [0.22, 0.26, 0.45, 1] : [0.55, 0.78, 0.98, 1], 22);
  if (night) {
    ui.rect(cx - 11, cy - 11, 22, 22, [0.96, 0.95, 0.85, 1], 11);
    ui.rect(cx - 5, cy - 15, 22, 22, [0.22, 0.26, 0.45, 1], 11);
  } else {
    ui.rect(cx - 12, cy - 12, 24, 24, [1.0, 0.82, 0.25, 1], 12);
  }
  ui.text(`${clock.weekday()}, dia ${clock.day}`, x + 72, y + 14, 16, C.inkSoft);
  ui.text(clock.timeString(), x + 72, y + 34, 30, C.ink);
  const dayProgress = Math.min(1, Math.max(0, (hour - 6) / 18));
  ui.progress(x + 72, y + h - 14, w - 90, 5, dayProgress, night ? [0.4, 0.45, 0.75, 1] : C.gold);
  if (game.clock.speed > 1) {
    ui.text(`x${game.clock.speed}`, x + w - 14, y + 14, 14, C.red, { align: 'right' });
  }
}

function currentTip(game, touch) {
  const tiles = [...game.farm.tiles.values()].filter((t) => t.tilled);
  const crops = tiles.filter((t) => t.crop);
  const seeds = HOTBAR.filter((id) => id.startsWith('seed_')).reduce((n, id) => n + game.inventory.count(id), 0);
  if (!tiles.length) {
    return touch ? 'Escolha a Enxada na barra e toque na terra clara da plantação.'
      : 'Selecione a Enxada (1) e clique na terra clara da plantação.';
  }
  if (!crops.length && seeds > 0) {
    return touch ? 'Escolha uma semente na barra e toque num canteiro arado.'
      : 'Escolha uma semente (teclas 4 a 7) e clique num canteiro arado.';
  }
  if (crops.some((t) => t.wet <= 0 && !game.farm.isRipe(t.crop))) {
    return touch ? 'Regue com o Regador: as plantas só crescem molhadas.' : 'Regue com o Regador (2): as plantas só crescem molhadas.';
  }
  if (crops.some((t) => game.farm.isRipe(t.crop))) return touch ? 'Há plantas prontas! Colha com a Cesta.' : 'Há plantas prontas! Colha com a Cesta (3).';
  if (game.inventory.listByKind('produce').length && game.totalEarned === 0) {
    return 'Venda a colheita na caixa de madeira ao lado da plantação.';
  }
  if (game.animals.some((a) => a.ready)) {
    return touch ? 'Toque nos animais com balão para coletar ovos e leite.' : 'Clique nos animais com balão para coletar ovos e leite.';
  }
  if (game.totalEarned > 0 && game.totalEarned < 600) return 'Compre sementes, animais e melhorias na barraca ao norte.';
  return null;
}

function drawTip(ui, game, touch) {
  const tip = currentTip(game, touch);
  if (!tip) return;
  const x = 18 + ui.safe.left;
  const y = 112 + ui.safe.top;
  const maxW = touch ? 270 : 300;
  const lines = ui.font.wrap(tip, 15, maxW - 54);
  const h = 22 + lines.length * 20;
  ui.panel(x, y, maxW, h, { radius: 14, fill: [1, 0.98, 0.9, 0.94], border: 2, shadow: false });
  ui.rect(x + 12, y + 12, 26, 26, C.gold, 13);
  ui.text('!', x + 25, y + 25, 18, C.ink, { align: 'center', valign: 'middle' });
  lines.forEach((line, i) => ui.text(line, x + 46, y + 11 + i * 20, 15, C.ink));
}

function drawMoney(ui, game) {
  const w = 236;
  const h = 84;
  const x = ui.w - w - 18 - ui.safe.right;
  const y = 16 + ui.safe.top;
  ui.panel(x, y, w, h, { radius: 18 });
  ui.icon('coin', x + 10, y + 10, 46);
  ui.text(formatMoney(game.money), x + 62, y + 14, 28, C.ink, { maxWidth: w - 76 });
  const goal = Math.min(1, game.money / GOAL_MONEY);
  ui.text(game.goalReached ? 'Meta alcançada!' : `Meta: ${formatMoney(GOAL_MONEY)}`, x + 62, y + 50, 13, C.inkSoft);
  ui.progress(x + 62, y + h - 16, w - 78, 6, goal, C.green);
}

function drawHotbar(ui, game, touch) {
  const slot = 62;
  const gap = 8;
  const count = HOTBAR.length;
  const width = count * slot + (count - 1) * gap + 24;
  const x0 = (ui.w - width) / 2;
  const y0 = ui.h - (slot + 22) - 12 - ui.safe.bottom;
  ui.panel(x0, y0, width, slot + 22, { radius: 20, fill: [0.99, 0.95, 0.86, 0.9] });
  HOTBAR.forEach((id, i) => {
    const x = x0 + 12 + i * (slot + gap);
    const selected = game.selected === i;
    const y = y0 + 11 - (selected ? 6 : 0);
    const hovered = ui.over(x, y, slot, slot);
    if (selected) ui.rect(x - 3, y - 3, slot + 6, slot + 6, C.gold, 15);
    ui.rect(x, y, slot, slot, hovered && !touch ? [1, 0.97, 0.9, 1] : C.panelDark, 13);
    const item = ITEMS[id];
    const n = item.kind === 'seed' ? game.inventory.count(id) : null;
    const dim = n === 0 ? [1, 1, 1, 0.35] : C.white;
    ui.icon(item.icon, x + 5, y + 4, slot - 10, dim);
    if (!touch) ui.text(String(i + 1), x + 7, y + 4, 13, C.inkSoft);
    if (n !== null) {
      ui.text(String(n), x + slot - 6, y + slot - 6, 16, n ? C.ink : C.red,
        { align: 'right', valign: 'baseline', outline: 0.2, outlineColor: [1, 1, 1, 0.9] });
    }
    if (hovered) ui.cursor = 'pointer';
    // select on press for instant feedback (works the same with mouse and fingers)
    if (ui.pressedOn(x, y - 6, slot, slot + 12) && game.selected !== i) {
      game.selected = i;
      game.sound('select');
    }
  });
  // name of the selected item above the bar
  const sel = ITEMS[HOTBAR[game.selected]];
  ui.text(sel.name, ui.w / 2, y0 - 12, 18, C.white, { align: 'center', valign: 'baseline', shadow: true, outline: 0.16, outlineColor: [0.2, 0.12, 0.05, 0.6] });
  return { x: x0, y: y0, w: width, h: slot + 22 };
}

function keyCap(ui, x, y, label) {
  const w = Math.max(28, ui.measure(label, 15) + 14);
  ui.rect(x, y + 3, w, 26, [0.7, 0.62, 0.52, 1], 7);
  ui.rect(x, y, w, 26, [0.98, 0.95, 0.88, 1], 7);
  ui.text(label, x + w / 2, y + 13, 15, C.ink, { align: 'center', valign: 'middle' });
  return w;
}

function drawPrompt(ui, game, touch, bar) {
  const obj = game.hover.object;
  let label = null;
  let key = 'E';
  if (obj) {
    label = obj.inReach ? obj.label : `${obj.label} (chegue mais perto)`;
    key = 'Clique';
  } else if (game.hover.prompt) {
    label = game.hover.prompt;
  }
  if (touch && game.walkTarget) label = 'Indo até lá...';
  if (!label) return;
  const size = 17;
  const y = bar.y - 74;
  if (touch) {
    const w = ui.measure(label, size) + 36;
    const x = (ui.w - w) / 2;
    ui.rect(x, y, w, 40, C.dark, 20);
    ui.text(label, ui.w / 2, y + 20, size, C.white, { align: 'center', valign: 'middle' });
    return;
  }
  const keyW = Math.max(28, ui.measure(key, 15) + 14);
  const w = ui.measure(label, size) + keyW + 34;
  const x = (ui.w - w) / 2;
  ui.rect(x, y, w, 40, C.dark, 20);
  keyCap(ui, x + 8, y + 6, key);
  ui.text(label, x + keyW + 20, y + 20, size, C.white, { valign: 'middle' });
}

function drawTileTooltip(ui, game, camera, touch) {
  const tile = game.hover.tile;
  if (!tile) return;
  if (tile.keyboard && !touch) return;
  const t = game.farm.get(tile.i, tile.j);
  if (!t || !t.crop) return;
  const def = CROPS[t.crop.type];
  const stage = game.farm.stageOf(t.crop);
  const total = def.hoursPerStage * (CROP_STAGES - 1);
  const pct = Math.floor((t.crop.growth / total) * 100);
  let status;
  let color;
  if (stage === CROP_STAGES - 1) { status = 'Pronta para colher!'; color = C.green; }
  else if (t.wet > 0) { status = `Molhada · cresce em ${Math.ceil(total - t.crop.growth)}h`; color = [0.3, 0.55, 0.85, 1]; }
  else { status = 'Precisa de água'; color = C.red; }
  const w = Math.max(ui.measure(def.name, 17), ui.measure(status, 14)) + 28;
  let ax = ui.mouse.x;
  let ay = ui.mouse.y;
  if (touch || tile.keyboard) {
    // anchor above the tile on screen
    const p = camera.project([tile.i + 0.5, 0.9, tile.j + 0.5]);
    if (!p) return;
    ax = (p[0] * 0.5 + 0.5) * ui.w - w / 2 - 18;
    ay = (1 - (p[1] * 0.5 + 0.5)) * ui.h - 10;
  }
  const x = Math.max(8, Math.min(ui.w - w - 8, ax + 18));
  const y = Math.max(8, ay - 64);
  ui.panel(x, y, w, 62, { radius: 12, border: 2, shadow: false, block: false });
  ui.text(def.name, x + 14, y + 8, 17, C.ink);
  ui.text(status, x + 14, y + 30, 14, color);
  ui.progress(x + 14, y + 50, w - 28, 5, pct / 100, color);
}

function drawToasts(ui, game) {
  let y = 112 + ui.safe.top;
  for (const toast of game.toasts) {
    const appear = Math.min(1, toast.t * 6);
    const fade = Math.min(1, (3.2 - toast.t) * 2.5);
    const a = Math.min(appear, fade);
    const size = 17;
    const w = ui.measure(toast.text, size) + 40;
    const x = (ui.w - w) / 2;
    const yy = y - (1 - appear) * 12;
    const bg = toast.kind === 'good' ? [0.28, 0.5, 0.2, 0.9 * a] : toast.kind === 'bad' ? [0.6, 0.2, 0.16, 0.9 * a] : [0.12, 0.09, 0.07, 0.78 * a];
    ui.rect(x, yy, w, 38, bg, 19);
    ui.text(toast.text, ui.w / 2, yy + 19, size, [1, 1, 1, a], { align: 'center', valign: 'middle' });
    y += 46;
  }
}

function drawFloaters(ui, game, camera) {
  for (const f of game.floaters) {
    const p = camera.project(f.pos);
    if (!p || p[2] > 1) continue;
    const x = (p[0] * 0.5 + 0.5) * ui.w;
    const y = (1 - (p[1] * 0.5 + 0.5)) * ui.h;
    const a = Math.min(1, (1.6 - f.t) * 2);
    const pop = 1 + Math.max(0, 0.35 - f.t) * 1.5;
    const size = 22 * pop;
    const w = ui.measure(f.text, size);
    if (f.icon) ui.icon(f.icon, x - w / 2 - size * 1.3, y - size * 0.62, size * 1.25, [1, 1, 1, a]);
    ui.text(f.text, x, y, size, [f.color[0], f.color[1], f.color[2], a],
      { align: 'center', valign: 'middle', outline: 0.22, outlineColor: [0.25, 0.14, 0.05, 0.9 * a] });
  }
}

// ----------------------------------------------------------------------
// touch controls
// ----------------------------------------------------------------------

function roundButton(ui, cx, cy, r, { fill = [0.99, 0.95, 0.86, 0.92], edge = C.panelEdge, pressed = false } = {}) {
  ui.softShadow(cx - r, cy - r + 4, r * 2, r * 2, r, 10);
  ui.circle(cx, cy + (pressed ? 1 : 0), r, edge);
  ui.circle(cx, cy + (pressed ? 1 : 0), r - 3, fill);
  ui.block(cx - r, cy - r, r * 2, r * 2);
}

function drawTouchControls(ui, game, input, bar) {
  const result = { action: null, pause: false, backpack: false };

  // menu buttons next to the money panel
  const topY = 16 + ui.safe.top + 42;
  const pauseX = ui.w - 236 - 18 - ui.safe.right - 40;
  roundButton(ui, pauseX, topY, 30, { pressed: ui.mouseDown && ui.over(pauseX - 30, topY - 30, 60, 60) });
  for (let k = -1; k <= 1; k++) ui.rect(pauseX - 11, topY - 2 + k * 8, 22, 4, C.ink, 2);
  if (ui._click(pauseX - 34, topY - 34, 68, 68)) result.pause = true;
  const bagX = pauseX - 72;
  roundButton(ui, bagX, topY, 30, { pressed: ui.mouseDown && ui.over(bagX - 30, topY - 30, 60, 60) });
  ui.icon('basket', bagX - 22, topY - 23, 44);
  if (ui._click(bagX - 34, topY - 34, 68, 68)) result.backpack = true;

  // action button: use the tool when the tile in front accepts it, otherwise
  // interact with whatever is in reach (shop, bin, house, animal, tree)
  const r = 54;
  const ax = ui.w - 96 - ui.safe.right;
  const ay = ui.h - 112 - ui.safe.bottom;
  const tile = game.hover.tile;
  const toolFits = tile && tile.action && tile.inReach;
  const interact = !toolFits && !!game.hover.prompt;
  const tool = ITEMS[HOTBAR[game.selected]];
  const pressed = ui.mouseDown && ui.over(ax - r, ay - r, r * 2, r * 2);
  roundButton(ui, ax, ay, r, { fill: interact ? [1, 0.93, 0.62, 0.95] : [0.99, 0.95, 0.86, 0.92], pressed });
  const iconSize = 54;
  ui.icon(interact ? 'basket' : tool.icon, ax - iconSize / 2, ay - iconSize / 2 - 10, iconSize);
  ui.text(interact ? 'Interagir' : 'Usar', ax, ay + 28, 14, C.ink, { align: 'center', valign: 'middle' });
  if (ui.pressedOn(ax - r, ay - r, r * 2, r * 2)) result.action = interact ? 'interact' : 'use';

  // joystick: floating base where the thumb landed, faint hint otherwise
  if (input.joystick) {
    const j = input.joystick;
    const cx = ui.fromCss(j.cx);
    const cy = ui.fromCss(j.cy);
    const radius = ui.fromCss(input.joystickRadius);
    const v = input.joystickVector();
    ui.circle(cx, cy, radius + 10, [0.1, 0.08, 0.06, 0.25]);
    ui.circle(cx, cy, radius, [1, 1, 1, 0.12]);
    ui.circle(cx + v.x * radius, cy + v.y * radius, radius * 0.48, [1, 0.97, 0.9, 0.85]);
  } else if (!game.walkTarget) {
    const cx = 120 + ui.safe.left;
    const cy = ui.h - 120 - ui.safe.bottom;
    ui.circle(cx, cy, 62, [1, 1, 1, 0.1]);
    ui.circle(cx, cy, 28, [1, 1, 1, 0.18]);
    ui.text('mover', cx, cy + 82, 13, [1, 1, 1, 0.6], { align: 'center', valign: 'middle', shadow: true });
  }
  return result;
}

// ----------------------------------------------------------------------
// debug
// ----------------------------------------------------------------------

const DEBUG_VIEWS = ['Completo', 'Só ambiente', 'Só difusa', 'Só especular', 'Normais', 'Sombras', 'Albedo (cor/textura)'];

export function debugViewName(index) {
  return DEBUG_VIEWS[index];
}

export const DEBUG_VIEW_COUNT = DEBUG_VIEWS.length;

function drawDebug(ui, game, options) {
  const s = options.stats;
  const lines = [
    `FPS ${options.fps.toFixed(0)}`,
    `Draw calls ${s.drawCalls} · instâncias ${s.instances}`,
    `Triângulos ${Math.round(s.triangles).toLocaleString('pt-BR')}`,
    `Visualização: ${DEBUG_VIEWS[options.debugView]} (F4)`,
    `Sombras: ${options.shadows ? 'ligadas' : 'desligadas'} (F2)`,
    `Jogador ${game.player.pos[0].toFixed(1)}, ${game.player.pos[2].toFixed(1)}`,
    `Hora ${game.clock.hour.toFixed(2)} · velocidade x${game.clock.speed} (T)`,
  ];
  const w = 330;
  const h = lines.length * 20 + 20;
  const x = 18;
  const y = ui.h - h - 18;
  ui.rect(x, y, w, h, [0, 0, 0, 0.6], 10);
  lines.forEach((line, i) => ui.text(line, x + 12, y + 10 + i * 20, 14, [0.85, 1, 0.8, 1]));
}
