/**
 * In-game HUD: clock and weather, money and level, the objective tracker,
 * the hotbar, the interaction prompt, the fishing gauge and catch card,
 * banners, notifications, floating texts, the debug overlay and (on touch
 * screens) the joystick, the action button and the menu buttons.
 */

import { C } from './ui.js';
import { ITEMS, CROPS, CROP_STAGES } from '../game/data.js';
import { WEATHER } from '../game/weather.js';
import { Fishing } from '../game/fishing.js';

export function formatMoney(n) {
  return `R$ ${Math.floor(n).toLocaleString('pt-BR')}`;
}

/**
 * options: { tips, debug, fps, stats, debugView, shadows, touch, input }
 * Returns touch actions for main.js: { action: 'use' | 'interact' | null, pause, backpack, journal }.
 */
export function drawHud(ui, game, camera, options) {
  const touch = !!options.touch;
  const actions = { action: null, pause: false, backpack: false, journal: false };
  const clock = drawClock(ui, game);
  drawTracker(ui, game, touch, clock, options.tips);
  drawMoney(ui, game);
  const bar = drawHotbar(ui, game, touch, options.controls !== false);
  drawFishing(ui, game, touch, bar);
  drawPrompt(ui, game, touch, bar);
  drawTileTooltip(ui, game, camera, touch);
  drawToasts(ui, game, touch);
  drawFloaters(ui, game, camera);
  drawBanner(ui, game);
  if (touch) {
    if (options.controls !== false) Object.assign(actions, drawTouchControls(ui, game, options.input, bar));
  } else {
    ui.text('H ajuda   ·   J diário   ·   Tab mochila   ·   Esc menu', ui.w - 18, ui.h - 16, 13, [1, 1, 1, 0.75],
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
  const weather = WEATHER[game.weather.today];
  // sky badge: sun, clouds or rain by day, the moon at night
  const cx = x + 40;
  const cy = y + h / 2;
  const sky = night ? [0.22, 0.26, 0.45, 1] : game.weather.today === 'sun' ? [0.55, 0.78, 0.98, 1] : [0.6, 0.66, 0.74, 1];
  ui.rect(cx - 24, cy - 24, 48, 48, sky, 24);
  if (night) {
    ui.rect(cx - 11, cy - 11, 22, 22, [0.96, 0.95, 0.85, 1], 11);
    ui.rect(cx - 5, cy - 15, 22, 22, sky, 11);
    if (game.weather.today !== 'sun') ui.icon(weather.icon, cx - 4, cy - 2, 28);
  } else {
    ui.icon(weather.icon, cx - 22, cy - 22, 44);
  }
  ui.text(`${clock.weekday()}, dia ${clock.day}`, x + 72, y + 14, 16, C.inkSoft, { maxWidth: w - 86 });
  ui.text(clock.timeString(), x + 72, y + 34, 30, C.ink);
  const dayProgress = Math.min(1, Math.max(0, (hour - 6) / 18));
  ui.progress(x + 72, y + h - 14, w - 90, 5, dayProgress, night ? [0.4, 0.45, 0.75, 1] : C.gold);
  if (game.clock.speed > 1) {
    ui.text(`x${game.clock.speed}`, x + w - 14, y + 14, 14, C.red, { align: 'right' });
  }
  return { x, y, w, h };
}

// ----------------------------------------------------------------------
// objective tracker (story chapter + a contextual hint)
// ----------------------------------------------------------------------

function tutorialTip(game, touch) {
  if (game.progress.chapter > 0) return null;
  const tiles = [...game.farm.tiles.values()].filter((t) => t.tilled);
  const crops = tiles.filter((t) => t.crop);
  const seeds = Object.keys(ITEMS).filter((id) => id.startsWith('seed_')).reduce((n, id) => n + game.inventory.count(id), 0);
  if (!tiles.length) {
    return touch ? 'Escolha a Enxada na barra e toque na terra clara da plantação.'
      : 'Selecione a Enxada (1) e clique na terra clara da plantação.';
  }
  if (!crops.length && seeds > 0) {
    return touch ? 'Escolha uma semente na barra e toque num canteiro arado.'
      : 'Escolha uma semente na barra (teclas 4 em diante) e clique num canteiro arado.';
  }
  if (crops.some((t) => t.wet <= 0 && !game.farm.isRipe(t.crop))) {
    return touch ? 'Regue com o Regador: as plantas só crescem molhadas.' : 'Regue com o Regador (2): as plantas só crescem molhadas.';
  }
  if (crops.some((t) => game.farm.isRipe(t.crop))) return touch ? 'Há plantas prontas! Colha com a Cesta.' : 'Há plantas prontas! Colha com a Cesta (3).';
  if (game.inventory.listByKind('produce').length) return 'Venda a colheita na caixa de madeira ao lado da plantação.';
  return null;
}

function drawTracker(ui, game, touch, clock, tips) {
  const progress = game.progress;
  const chapter = progress.current;
  const w = touch ? 262 : 300;
  const x = clock.x;
  const y = clock.y + clock.h + 10;
  const rows = [];
  let title;
  if (chapter) {
    title = `Capítulo ${progress.chapter + 1} · ${chapter.title}`;
    for (const task of chapter.tasks) {
      const s = progress.taskState(task, game);
      const value = task.state === 'earned' ? formatMoney(s.value) : String(s.value);
      const target = task.state === 'earned' ? '' : `/${s.target}`;
      rows.push({ label: task.label, count: s.done ? null : `${value}${target}`, done: s.done, t: s.value / s.target });
    }
  } else {
    title = `Sítio do Sol · nível ${progress.level}`;
    const next = progress.milestoneStates().sort((a, b) => b.value / b.target - a.value / a.target).slice(0, 2);
    for (const m of next) {
      rows.push({ label: m.milestone.name, count: `${m.value}/${m.target}`, done: false, t: m.value / m.target });
    }
    if (game.orders.list.length) rows.push({ label: 'Pedidos no mural', count: String(game.orders.list.length), done: false, t: 0 });
  }
  const letterWaiting = progress.unreadLetters().length > 0;
  const hint = (tips && !letterWaiting ? tutorialTip(game, touch) : null) || game.hint();
  const hintLines = hint ? ui.font.wrap(hint, 13, w - 52) : [];
  const rowH = 22;
  const h = 40 + rows.length * rowH + (hintLines.length ? 10 + hintLines.length * 17 : 0) + 6;
  ui.panel(x, y, w, h, { radius: 14, fill: [1, 0.98, 0.9, 0.93], border: 2, shadow: false, block: false });
  ui.icon('journal', x + 8, y + 6, 28);
  ui.text(title, x + 40, y + 11, 14, C.ink, { maxWidth: w - 52 });
  let ry = y + 38;
  for (const row of rows) {
    if (row.done) {
      ui.icon('check', x + 12, ry - 2, 18);
    } else {
      ui.rect(x + 14, ry + 1, 14, 14, [0.55, 0.38, 0.24, 0.25], 4);
      if (row.t > 0) ui.rect(x + 14, ry + 1 + 14 * (1 - Math.min(1, row.t)), 14, 14 * Math.min(1, row.t), C.gold, 4);
    }
    const countW = row.count ? ui.measure(row.count, 13) + 6 : 0;
    ui.text(row.label, x + 36, ry, 13, row.done ? C.green : C.ink, { maxWidth: w - 48 - countW });
    if (row.count) ui.text(row.count, x + w - 12, ry, 13, C.inkSoft, { align: 'right' });
    ry += rowH;
  }
  if (hintLines.length) {
    ry += 4;
    ui.rect(x + 12, ry, 22, 22, C.gold, 11);
    ui.text('!', x + 23, ry + 11, 15, C.ink, { align: 'center', valign: 'middle' });
    hintLines.forEach((line, i) => ui.text(line, x + 42, ry + 2 + i * 17, 13, C.inkSoft));
  }
  // informational only: taps and clicks pass through to the world
  return { x, y, w, h };
}

function drawMoney(ui, game) {
  const w = 236;
  const h = 84;
  const x = ui.w - w - 18 - ui.safe.right;
  const y = 16 + ui.safe.top;
  ui.panel(x, y, w, h, { radius: 18 });
  ui.icon('coin', x + 10, y + 8, 46);
  ui.text(formatMoney(game.money), x + 62, y + 12, 28, C.ink, { maxWidth: w - 76 });
  const p = game.progress;
  // level badge with the experience bar
  ui.rect(x + 14, y + 54, 40, 22, C.green, 11);
  ui.text(String(p.level), x + 34, y + 65, 15, C.white, { align: 'center', valign: 'middle' });
  ui.text(`Nível ${p.level}`, x + 62, y + 50, 12, C.inkSoft);
  ui.text(`${p.xp}/${p.xpNeeded} XP`, x + w - 16, y + 50, 12, C.inkSoft, { align: 'right' });
  ui.progress(x + 62, y + h - 16, w - 78, 6, p.xp / p.xpNeeded, [0.35, 0.62, 0.9, 1]);
  const bonus = game.sellBonus();
  if (bonus > 1) {
    const label = `${game.sellBonusLabel()} +${Math.round((bonus - 1) * 100)}%`;
    const lw = ui.measure(label, 13) + 20;
    ui.rect(x + w - lw, y + h + 6, lw, 24, [0.28, 0.5, 0.2, 0.9], 12);
    ui.text(label, x + w - lw / 2, y + h + 18, 13, C.white, { align: 'center', valign: 'middle' });
  }
}

// ----------------------------------------------------------------------
// hotbar
// ----------------------------------------------------------------------

function drawHotbar(ui, game, touch, active) {
  const list = game.hotbar();
  const gap = 8;
  const count = list.length;
  const room = ui.w - (touch ? 390 : 80) - ui.safe.left - ui.safe.right;
  const slot = Math.max(44, Math.min(62, Math.floor((room - 24 - gap * (count - 1)) / count)));
  const width = count * slot + (count - 1) * gap + 24;
  const x0 = (ui.w - width) / 2;
  const y0 = ui.h - (slot + 22) - 12 - ui.safe.bottom;
  ui.panel(x0, y0, width, slot + 22, { radius: 20, fill: [0.99, 0.95, 0.86, 0.9] });
  list.forEach((id, i) => {
    const x = x0 + 12 + i * (slot + gap);
    const selected = game.selectedId === id;
    const y = y0 + 11 - (selected ? 6 : 0);
    const hovered = ui.over(x, y, slot, slot);
    if (selected) ui.rect(x - 3, y - 3, slot + 6, slot + 6, C.gold, 15);
    ui.rect(x, y, slot, slot, hovered && !touch ? [1, 0.97, 0.9, 1] : C.panelDark, 13);
    const item = ITEMS[id];
    const n = item.kind === 'seed' ? game.inventory.count(id) : null;
    const dim = n === 0 ? [1, 1, 1, 0.35] : C.white;
    ui.icon(item.icon, x + 5, y + 4, slot - 10, dim);
    if (!touch && i < 9) ui.text(String(i + 1), x + 7, y + 4, 13, C.inkSoft);
    if (n !== null) {
      ui.text(String(n), x + slot - 6, y + slot - 6, 16, n ? C.ink : C.red,
        { align: 'right', valign: 'baseline', outline: 0.2, outlineColor: [1, 1, 1, 0.9] });
    }
    if (hovered) ui.cursor = 'pointer';
    // select on press for instant feedback (works the same with mouse and fingers)
    if (active && ui.pressedOn(x, y - 6, slot, slot + 12)) game.selectItem(id);
  });
  // name of the selected item above the bar
  const sel = ITEMS[game.selectedId];
  if (!game.fishing.active) {
    ui.text(sel.name, ui.w / 2, y0 - 12, 18, C.white, { align: 'center', valign: 'baseline', shadow: true, outline: 0.16, outlineColor: [0.2, 0.12, 0.05, 0.6] });
  }
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
  if (game.fishing.active) return;
  const obj = game.hover.object;
  const water = game.hover.water;
  let label = null;
  let key = 'E';
  if (obj) {
    label = obj.inReach ? obj.label : `${obj.label} (chegue mais perto)`;
    key = 'Clique';
  } else if (water) {
    label = water.inReach ? 'Lançar a linha aqui' : 'Longe demais: chegue à beira do lago';
    key = 'Clique';
  } else if (game.hover.prompt) {
    label = game.hover.prompt;
    if (label === 'Pescar') key = 'Espaço';
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

// ----------------------------------------------------------------------
// fishing: waiting text, bite alert, reel gauge and the catch card
// ----------------------------------------------------------------------

function drawFishing(ui, game, touch, bar) {
  const f = game.fishing;
  if (!f.active) return;
  const cx = ui.w / 2;
  const press = touch ? 'Toque' : 'Clique ou Espaço';
  if (f.state === 'cast' || f.state === 'wait') {
    const label = 'Espere a boia afundar...';
    const w = ui.measure(label, 17) + 40;
    ui.rect(cx - w / 2, bar.y - 74, w, 40, C.dark, 20);
    ui.text(label, cx, bar.y - 54, 17, C.white, { align: 'center', valign: 'middle' });
  } else if (f.state === 'bite') {
    const pulse = 1 + Math.sin(game.time * 22) * 0.08;
    const y = ui.h * 0.38;
    ui.circle(cx, y, 46 * pulse, C.red);
    ui.circle(cx, y, 40 * pulse, [1, 0.95, 0.85, 1]);
    ui.text('!', cx, y, 58 * pulse, C.red, { align: 'center', valign: 'middle' });
    ui.text(`Puxe! ${press}`, cx, y + 76, 24, C.white, { align: 'center', valign: 'middle', outline: 0.22, outlineColor: [0.3, 0.1, 0.05, 0.9] });
  } else if (f.state === 'reel') {
    const g = f.gauge;
    const w = Math.min(460, ui.w - 60);
    const h = 104;
    const x = cx - w / 2;
    const y = bar.y - h - 22;
    ui.panel(x, y, w, h, { radius: 18, block: false });
    ui.text(`${press} quando o ponteiro estiver no verde`, cx, y + 20, 15, C.ink, { align: 'center', valign: 'middle', maxWidth: w - 30 });
    const gx = x + 22;
    const gw = w - 44;
    const gy = y + 38;
    const gh = 26;
    ui.rect(gx, gy, gw, gh, [0.55, 0.38, 0.24, 0.25], 13);
    ui.rect(gx + (g.zone - g.width / 2) * gw, gy, g.width * gw, gh, C.green, 10);
    const nx = gx + g.needle * gw;
    ui.rect(nx - 3, gy - 6, 6, gh + 12, C.ink, 3);
    if (g.flash > 0) {
      const col = g.flashGood ? [1, 1, 1, 0.5 * g.flash] : [0.9, 0.2, 0.15, 0.4 * g.flash];
      ui.rect(gx, gy, gw, gh, col, 13);
    }
    // hits needed and misses left
    const dot = 16;
    const total = g.need * (dot + 6) - 6;
    for (let k = 0; k < g.need; k++) {
      ui.rect(cx - total / 2 + k * (dot + 6), y + h - 28, dot, dot, k < g.hits ? C.gold : [0.55, 0.38, 0.24, 0.25], 8);
    }
    for (let k = 0; k < 3; k++) {
      ui.text('×', x + w - 22 - k * 18, y + h - 20, 20, k < g.misses ? C.red : [0.55, 0.38, 0.24, 0.3], { align: 'center', valign: 'middle' });
    }
  } else if (f.state === 'caught' && f.result) {
    const r = f.result;
    const appear = Math.min(1, f.t * 5);
    // below the farmer, who holds the catch up over the head
    const w = Math.min(380, ui.w - 40);
    const h = 132;
    const x = cx - w / 2;
    const y = Math.max(ui.h * 0.55, bar.y - h - 70) + (1 - appear) * 20;
    ui.panel(x, y, w, h, { radius: 22, block: false });
    ui.rect(x + 16, y + 16, 100, 100, [0.85, 0.93, 1, 1], 18);
    ui.icon(r.icon, x + 18, y + 18, 96);
    ui.text(r.kind === 'fish' ? 'Você pescou' : 'Você fisgou', x + 132, y + 22, 15, C.inkSoft);
    ui.text(r.name, x + 132, y + 42, 28, C.ink, { maxWidth: w - 148 });
    ui.textBlock(r.detail, x + 132, y + 84, 15, r.record ? C.green : C.inkSoft, w - 150, 1.25);
  }
}

function drawTileTooltip(ui, game, camera, touch) {
  const tile = game.hover.tile;
  if (!tile || game.fishing.active) return;
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

function drawToasts(ui, game, touch) {
  // below the money panel on the right half, so they never cover the tracker
  let y = (touch ? 150 : 140) + ui.safe.top;
  const maxW = Math.min(560, ui.w * 0.5);
  for (const toast of game.toasts) {
    const appear = Math.min(1, toast.t * 6);
    const fade = Math.min(1, (3.6 - toast.t) * 2.5);
    const a = Math.min(appear, fade);
    const size = 16;
    const lines = ui.font.wrap(toast.text, size, maxW - 36);
    const w = Math.max(...lines.map((l) => ui.measure(l, size))) + 36;
    const h = 18 + lines.length * 21;
    const x = Math.max(ui.w / 2 - w / 2, 340 + ui.safe.left);
    const yy = y - (1 - appear) * 12;
    const bg = toast.kind === 'good' ? [0.28, 0.5, 0.2, 0.9 * a] : toast.kind === 'bad' ? [0.6, 0.2, 0.16, 0.9 * a] : [0.12, 0.09, 0.07, 0.78 * a];
    ui.rect(Math.min(x, ui.w - w - 12), yy, w, h, bg, 18);
    lines.forEach((line, i) => ui.text(line, Math.min(x, ui.w - w - 12) + w / 2, yy + 9 + i * 21 + 10, size, [1, 1, 1, a], { align: 'center', valign: 'middle' }));
    y += h + 8;
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
    const size = (f.icon ? 22 : 17) * pop;
    const w = ui.measure(f.text, size);
    if (f.icon) ui.icon(f.icon, x - w / 2 - size * 1.3, y - size * 0.62, size * 1.25, [1, 1, 1, a]);
    ui.text(f.text, x, y, size, [f.color[0], f.color[1], f.color[2], a],
      { align: 'center', valign: 'middle', outline: 0.22, outlineColor: [0.25, 0.14, 0.05, 0.9 * a] });
  }
}

/** Level-up and chapter banners, one at a time. */
function drawBanner(ui, game) {
  const b = game.banners[0];
  if (!b) return;
  const appear = Math.min(1, b.t * 4);
  const fade = Math.min(1, (3.6 - b.t) * 3);
  const a = Math.min(appear, fade);
  const w = Math.min(640, ui.w - 40);
  const lines = ui.font.wrap(b.subtitle || '', 16, w - 130);
  const h = 70 + lines.length * 21;
  const x = (ui.w - w) / 2;
  const y = ui.h * 0.2 - (1 - appear) * 30;
  ui.softShadow(x, y + 6, w, h, 22, 14, [0.12, 0.07, 0.03, 0.3 * a]);
  ui.rect(x, y, w, h, [0.55, 0.38, 0.24, a], 22);
  ui.rect(x + 4, y + 4, w - 8, h - 8, [1, 0.95, 0.78, a], 19);
  ui.icon(b.icon || 'star', x + 18, y + (h - 72) / 2, 72, [1, 1, 1, a]);
  ui.text(b.title, x + 104, y + 16, 26, [0.3, 0.2, 0.12, a], { maxWidth: w - 124 });
  lines.forEach((line, i) => ui.text(line, x + 104, y + 52 + i * 21, 16, [0.5, 0.38, 0.27, a]));
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
  const result = { action: null, pause: false, backpack: false, journal: false };

  // menu buttons next to the money panel
  const topY = 16 + ui.safe.top + 42;
  const pauseX = ui.w - 236 - 18 - ui.safe.right - 40;
  roundButton(ui, pauseX, topY, 30, { pressed: ui.mouseDown && ui.over(pauseX - 30, topY - 30, 60, 60) });
  for (let k = -1; k <= 1; k++) ui.rect(pauseX - 11, topY - 2 + k * 8, 22, 4, C.ink, 2);
  if (ui._click(pauseX - 34, topY - 34, 68, 68)) result.pause = true;
  const bagX = pauseX - 70;
  roundButton(ui, bagX, topY, 30, { pressed: ui.mouseDown && ui.over(bagX - 30, topY - 30, 60, 60) });
  ui.icon('basket', bagX - 22, topY - 23, 44);
  if (ui._click(bagX - 34, topY - 34, 68, 68)) result.backpack = true;
  const bookX = bagX - 70;
  roundButton(ui, bookX, topY, 30, { pressed: ui.mouseDown && ui.over(bookX - 30, topY - 30, 60, 60) });
  ui.icon('journal', bookX - 22, topY - 22, 44);
  if (game.progress.unreadLetters().length) ui.circle(bookX + 20, topY - 20, 8, C.red);
  if (ui._click(bookX - 34, topY - 34, 68, 68)) result.journal = true;

  // action button: use the tool when the tile in front accepts it, otherwise
  // interact with whatever is in reach (shop, bin, house, animal, tree, machine)
  const r = 54;
  const ax = ui.w - 96 - ui.safe.right;
  const ay = ui.h - 112 - ui.safe.bottom;
  const tile = game.hover.tile;
  const fishing = game.fishing.active;
  const canFish = game.tool === 'rod' && !!Fishing.spotAhead(game.player.pos, game.player.forward());
  const toolFits = (tile && tile.action && tile.inReach) || canFish;
  const interact = !fishing && !toolFits && !!game.hover.prompt;
  const tool = ITEMS[game.selectedId];
  const pressed = ui.mouseDown && ui.over(ax - r, ay - r, r * 2, r * 2);
  const hot = interact || (fishing && game.fishing.state !== 'wait');
  roundButton(ui, ax, ay, r, { fill: hot ? [1, 0.93, 0.62, 0.95] : [0.99, 0.95, 0.86, 0.92], pressed });
  const iconSize = 54;
  let label = 'Usar';
  if (fishing) label = 'Puxar';
  else if (interact) label = 'Interagir';
  else if (canFish) label = 'Pescar';
  ui.icon(interact ? 'basket' : tool.icon, ax - iconSize / 2, ay - iconSize / 2 - 10, iconSize);
  ui.text(label, ax, ay + 28, 14, C.ink, { align: 'center', valign: 'middle' });
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
  } else if (!game.walkTarget && !fishing) {
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
    `Hora ${game.clock.hour.toFixed(2)} · velocidade x${game.clock.speed} (T) · ${WEATHER[game.weather.today].name}`,
  ];
  const w = 360;
  const h = lines.length * 20 + 20;
  const x = 18;
  const y = ui.h - h - 18;
  ui.rect(x, y, w, h, [0, 0, 0, 0.6], 10);
  lines.forEach((line, i) => ui.text(line, x + 12, y + 10 + i * 20, 14, [0.85, 1, 0.8, 1]));
}
