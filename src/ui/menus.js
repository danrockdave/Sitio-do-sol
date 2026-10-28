/**
 * Menus and dialogs: title screen, loading screen, shop, selling,
 * backpack, sleep, pause, controls, about and the goal dialog.
 *
 * Panels shrink to fit small screens and their lists scroll (drag or wheel).
 */

import { C } from './ui.js';
import { formatMoney, debugViewName } from './hud.js';
import { ITEMS, SHOP_TABS, GOAL_MONEY } from '../game/data.js';
import { PLATFORM } from '../core/platform.js';

const DESKTOP_CONTROLS = [
  ['W A S D / setas', 'Andar'],
  ['Shift', 'Correr'],
  ['Mouse', 'Apontar canteiro ou objeto'],
  ['Clique esquerdo / Espaço', 'Usar ferramenta'],
  ['E', 'Interagir (loja, venda, casa, animais)'],
  ['1 a 7', 'Escolher ferramenta ou semente'],
  ['Botão direito + arrastar / Z C', 'Girar a câmera'],
  ['Roda do mouse', 'Zoom'],
  ['Tab', 'Mochila'],
  ['T', 'Acelerar o tempo (demonstração)'],
  ['M', 'Música liga / desliga'],
  ['F2 / F3 / F4', 'Sombras / estatísticas / visualizar Phong'],
  ['Esc', 'Menu'],
];

const TOUCH_CONTROLS = [
  ['Joystick (esquerda)', 'Andar; empurre até a borda para correr'],
  ['Tocar no cenário', 'Usar a ferramenta ou interagir; o fazendeiro vai até lá'],
  ['Botão redondo', 'Usar a ferramenta ou interagir com o que está perto'],
  ['Barra de baixo', 'Escolher ferramenta ou semente'],
  ['Arrastar no cenário', 'Girar a câmera'],
  ['Pinça com dois dedos', 'Zoom'],
  ['Botões no alto', 'Mochila e pausa'],
];

const CREDITS = [
  'Jogo, modelos 3D, texturas, música e efeitos sonoros criados para este projeto.',
  'Gráficos desenhados com WebGL 2 e shaders próprios; leitor OBJ próprio.',
  'gl-matrix: biblioteca de álgebra linear, licença MIT.',
  'Fonte Poppins: SIL Open Font License 1.1.',
];

export class Menus {
  constructor(ui, game) {
    this.ui = ui;
    this.game = game;
    this.open = null;
    this.shopTab = 0;
    this.returnTo = null;
    this.anim = 0;
  }

  show(name) {
    this.open = name;
    this.anim = 0;
    this.ui.resetScroll(name);
  }

  close() {
    if (this.open === 'sell') this.game.closeBin();
    this.open = null;
  }

  /** Back navigation (Esc, Android back button). */
  back() {
    if (this.open === 'help' && this.returnTo) {
      this.open = this.returnTo;
      this.returnTo = null;
    } else {
      this.close();
    }
  }

  /** Draws the open menu; returns an action for main.js or null. */
  draw(dt, settings) {
    if (!this.open) return null;
    this.anim = Math.min(1, this.anim + dt * 7);
    const ui = this.ui;
    ui.rect(0, 0, ui.w, ui.h, [0.08, 0.05, 0.02, 0.38 * this.anim]);
    ui.block(0, 0, ui.w, ui.h);
    switch (this.open) {
      case 'shop': return this._shop();
      case 'sell': return this._sell();
      case 'inventory': return this._inventory();
      case 'sleep': return this._sleep();
      case 'pause': return this._pause(settings);
      case 'help': return this._help();
      case 'about': return this._about();
      case 'goal': return this._goal();
      default: return null;
    }
  }

  get compact() {
    return this.ui.h < 600;
  }

  /** Panel with title; returns its rect, the content top and whether it was closed. */
  _frame(w, h, title, subtitle) {
    const ui = this.ui;
    w = Math.min(w, ui.w - 24 - ui.safe.left - ui.safe.right);
    h = Math.min(h, ui.h - 20);
    const ease = 1 - Math.pow(1 - this.anim, 3);
    const x = (ui.w - w) / 2;
    const y = (ui.h - h) / 2 + (1 - ease) * 30;
    ui.panel(x, y, w, h, { radius: 24, border: 4 });
    const compact = this.compact;
    ui.text(title, x + 28, y + (compact ? 16 : 22), compact ? 26 : 30, C.ink, { maxWidth: w - 300 > 200 ? w - 300 : w - 90 });
    if (subtitle) ui.text(subtitle, x + 28, y + (compact ? 50 : 62), compact ? 14 : 15, C.inkSoft, { maxWidth: w - 90 });
    const closed = ui.closeButton(x + w - 50, y + 16);
    const top = y + (subtitle ? (compact ? 78 : 96) : (compact ? 62 : 80));
    return { x, y, w, h, top, closed };
  }

  // ------------------------------------------------------------------

  _shop() {
    const ui = this.ui;
    const game = this.game;
    const f = this._frame(800, 560, 'Mercadinho do Sítio', this.compact ? null : 'Sementes, animais e melhorias para a sua fazenda');
    if (f.closed) { this.close(); return null; }
    this._moneyBadge(f.x + f.w - 246, f.y + 16);

    const tabW = 150;
    SHOP_TABS.forEach((tab, i) => {
      if (ui.tab(f.x + 28 + i * (tabW + 8), f.top - 4, tabW, 38, tab.name, this.shopTab === i)) {
        this.shopTab = i;
        ui.resetScroll('shop');
      }
    });
    const listY = f.top + 40;
    const listH = f.y + f.h - 18 - listY;
    ui.rect(f.x + 20, listY, f.w - 40, listH, [0.95, 0.89, 0.76, 1], 16);

    const tab = SHOP_TABS[this.shopTab];
    const rowH = 78;
    const content = tab.items.length * (rowH + 6) + 18;
    const offset = ui.beginScroll('shop', f.x + 20, listY, f.w - 40, listH, content);
    tab.items.forEach((id, i) => {
      const e = game.shopEntry(id);
      const x = f.x + 32;
      const y = listY + 10 + i * (rowH + 6) - offset;
      const w = f.w - 64 - 8;
      ui.rect(x, y, w, rowH, [1, 0.98, 0.93, 1], 14);
      const iconSize = rowH - 14;
      ui.rect(x + 8, y + 7, iconSize, iconSize, [0.93, 0.86, 0.72, 1], 12);
      ui.icon(e.icon, x + 10, y + 9, iconSize - 4);
      const tx = x + iconSize + 22;
      const textW = w - iconSize - 22 - 290;
      ui.text(e.name, tx, y + 10, 20, C.ink, { maxWidth: textW });
      if (e.owned !== undefined && ui.measure(e.name, 20) + 120 < textW) {
        ui.text(`você tem ${e.owned}`, tx + ui.measure(e.name, 20) + 10, y + 14, 14, C.inkSoft);
      }
      ui.textBlock(e.detail, tx, y + 38, 13, C.inkSoft, textW, 1.25);

      const bx = x + w - 140;
      if (e.maxed) {
        ui.text('Completo', bx + 65, y + rowH / 2, 18, C.green, { align: 'center', valign: 'middle' });
        return;
      }
      ui.text(formatMoney(e.price), bx - 16, y + rowH / 2 - (e.reason ? 9 : 0), 20, C.ink, { align: 'right', valign: 'middle' });
      if (e.reason) ui.text(e.reason, bx - 16, y + rowH / 2 + 14, 12, C.red, { align: 'right', valign: 'middle', maxWidth: 150 });
      const disabled = !e.canBuy;
      if (e.kind === 'seed') {
        if (ui.button(bx, y + rowH / 2 - 22, 62, 44, '1x', { variant: 'primary', disabled })) game.buy(id, 1);
        if (ui.button(bx + 68, y + rowH / 2 - 22, 62, 44, '5x', { variant: 'primary', disabled })) game.buy(id, 5);
      } else if (ui.button(bx, y + rowH / 2 - 22, 130, 44, 'Comprar', { variant: 'primary', disabled })) {
        game.buy(id, 1);
      }
    });
    ui.endScroll();
    return null;
  }

  _moneyBadge(x, y) {
    const ui = this.ui;
    ui.rect(x, y, 180, 40, [0.95, 0.88, 0.74, 1], 20);
    ui.icon('coin', x + 4, y + 2, 36);
    ui.text(formatMoney(this.game.money), x + 44, y + 20, 19, C.ink, { valign: 'middle', maxWidth: 130 });
  }

  _sell() {
    const ui = this.ui;
    const game = this.game;
    const items = game.inventory.listByKind('produce');
    const rowH = 58;
    const h = Math.min(620, 230 + Math.max(1, items.length) * (rowH + 6));
    const f = this._frame(720, h, 'Caixa de vendas', 'O comprador passa e paga na hora');
    if (f.closed) { this.close(); return null; }
    this._moneyBadge(f.x + f.w - 246, f.y + 16);

    const footer = 70;
    const listY = f.top;
    const listH = f.y + f.h - footer - 8 - listY;
    if (!items.length) {
      ui.textBlock('Nada para vender ainda. Colha plantas, frutas e produtos dos animais e volte aqui!',
        f.x + 40, listY + 16, 17, C.inkSoft, f.w - 80);
    }
    const offset = ui.beginScroll('sell', f.x + 20, listY, f.w - 40, listH, items.length * (rowH + 6));
    items.forEach((id, i) => {
      const item = ITEMS[id];
      const n = game.inventory.count(id);
      const x = f.x + 28;
      const y = listY + i * (rowH + 6) - offset;
      const w = f.w - 56 - 8;
      ui.rect(x, y, w, rowH, [1, 0.98, 0.93, 1], 12);
      ui.icon(item.icon, x + 8, y + 4, rowH - 8);
      ui.text(item.name, x + rowH + 10, y + 8, 19, C.ink);
      ui.text(`${n} un. · ${formatMoney(item.sell)} cada`, x + rowH + 10, y + 33, 14, C.inkSoft);
      ui.text(formatMoney(item.sell * n), x + w - 262, y + rowH / 2, 18, C.ink, { align: 'right', valign: 'middle' });
      if (ui.button(x + w - 246, y + 8, 110, 42, 'Vender 1', { size: 16 })) game.announceSale(game.sell(id, 1));
      if (ui.button(x + w - 128, y + 8, 120, 42, 'Vender tudo', { variant: 'primary', size: 16 })) game.announceSale(game.sell(id, n));
    });
    ui.endScroll();

    const total = game.inventory.sellValue();
    const by = f.y + f.h - footer + 6;
    ui.text(`Total na mochila: ${formatMoney(total)}`, f.x + 34, by + 24, 18, C.ink, { valign: 'middle', maxWidth: f.w - 330 });
    if (ui.button(f.x + f.w - 270, by, 240, 48, 'Vender tudo', { variant: 'primary', disabled: total === 0, size: 20, icon: 'coin' })) {
      game.announceSale(game.sellAll());
    }
    return null;
  }

  _inventory() {
    const ui = this.ui;
    const game = this.game;
    const f = this._frame(700, 470, 'Mochila', `Produtos para vender: ${formatMoney(game.inventory.sellValue())}`);
    if (f.closed) { this.close(); return null; }
    const ids = Object.keys(ITEMS).filter((id) => ITEMS[id].kind !== 'tool');
    const cell = 82;
    const cols = Math.max(3, Math.min(7, Math.floor((f.w - 56) / (cell + 9))));
    const rows = Math.ceil(ids.length / cols);
    const gridW = cols * (cell + 9) - 9;
    const x0 = f.x + (f.w - gridW) / 2;
    const areaY = f.top;
    const areaH = f.y + f.h - 16 - areaY;
    const offset = ui.beginScroll('inventory', f.x + 12, areaY, f.w - 24, areaH, rows * (cell + 30));
    ids.forEach((id, i) => {
      const x = x0 + (i % cols) * (cell + 9);
      const y = areaY + 4 + Math.floor(i / cols) * (cell + 30) - offset;
      const n = game.inventory.count(id);
      ui.rect(x, y, cell, cell, n ? [1, 0.98, 0.93, 1] : [0.93, 0.88, 0.78, 1], 14);
      ui.icon(ITEMS[id].icon, x + 6, y + 4, cell - 12, n ? C.white : [1, 1, 1, 0.3]);
      ui.text(String(n), x + cell - 8, y + cell - 8, 18, n ? C.ink : C.grayInk, { align: 'right', valign: 'baseline', outline: 0.2, outlineColor: [1, 1, 1, 0.9] });
      ui.text(ITEMS[id].name.replace('Semente de ', 'Sem. '), x + cell / 2, y + cell + 6, 12, C.inkSoft, { align: 'center', maxWidth: cell + 6 });
    });
    ui.endScroll();
    return null;
  }

  _sleep() {
    const ui = this.ui;
    const f = this._frame(460, 240, 'Dormir?', 'A noite passa e as plantas regadas crescem.');
    if (f.closed) { this.close(); return null; }
    ui.text('O jogo é salvo automaticamente.', f.x + 28, f.top, 15, C.inkSoft);
    if (ui.button(f.x + 28, f.y + f.h - 72, 190, 50, 'Dormir', { variant: 'primary', size: 20 })) {
      this.close();
      return 'sleep';
    }
    if (ui.button(f.x + f.w - 218, f.y + f.h - 72, 190, 50, 'Cancelar', { size: 20 })) this.close();
    return null;
  }

  _goal() {
    const ui = this.ui;
    const f = this._frame(520, 270, 'Parabéns!', `Você juntou ${formatMoney(GOAL_MONEY)} no Sítio do Sol.`);
    if (f.closed) { this.close(); return null; }
    ui.textBlock('O sítio prosperou! Continue jogando para completar todas as melhorias.', f.x + 28, f.top, 16, C.ink, f.w - 56);
    if (ui.button(f.x + f.w / 2 - 120, f.y + f.h - 72, 240, 50, 'Continuar jogando', { variant: 'primary', size: 19 })) this.close();
    return null;
  }

  _pause(settings) {
    const ui = this.ui;
    const touch = PLATFORM.touch;
    const options = [
      { label: 'Continuar', action: 'resume', variant: 'primary' },
      { label: 'Salvar jogo', action: 'save' },
      { label: 'Controles', action: 'help' },
      { label: `Qualidade gráfica: ${settings.qualityLabel}`, action: 'cycleQuality', small: true },
      ...(touch ? [] : [
        { label: `Sombras: ${settings.shadows ? 'ligadas' : 'desligadas'}`, action: 'toggleShadows', small: true },
        { label: `Phong: ${debugViewName(settings.debugView)}`, action: 'cycleView', small: true },
      ]),
      { label: `Dicas: ${settings.tips ? 'sim' : 'não'}`, action: 'toggleTips', small: true },
      { label: `Música: ${settings.music ? 'ligada' : 'desligada'}`, action: 'toggleMusic', small: true },
      { label: `Efeitos sonoros: ${settings.sfx ? 'ligados' : 'desligados'}`, action: 'toggleSfx', small: true },
      ...(PLATFORM.native ? [
        { label: `Vibração: ${settings.haptics ? 'ligada' : 'desligada'}`, action: 'toggleHaptics', small: true },
      ] : []),
      { label: 'Sobre', action: 'about', small: true },
      { label: 'Sair para o título', action: 'title', variant: 'danger' },
    ];
    const step = 56;
    const f = this._frame(420, 100 + options.length * step + 10, 'Pausa', 'O tempo está parado');
    if (f.closed) { this.close(); return 'resume'; }
    const bw = f.w - 56;
    const areaY = f.top;
    const areaH = f.y + f.h - 14 - areaY;
    const offset = ui.beginScroll('pause', f.x + 10, areaY, f.w - 20, areaH, options.length * step);
    let action = null;
    options.forEach((o, i) => {
      const y = areaY + i * step - offset;
      if (ui.button(f.x + 28, y, bw, 46, o.label, { variant: o.variant || 'secondary', size: o.small ? 17 : 19 })) action = o.action;
    });
    ui.endScroll();
    if (action === 'resume' || action === 'title') this.close();
    if (action === 'help' || action === 'about') {
      this.returnTo = 'pause';
      this.show(action);
      return null;
    }
    return action;
  }

  _list(rows, f, id) {
    const ui = this.ui;
    const rowH = this.compact ? 40 : 34;
    const areaY = f.top;
    const areaH = f.y + f.h - 78 - areaY;
    const keyW = Math.min(300, f.w * 0.42);
    const offset = ui.beginScroll(id, f.x + 16, areaY, f.w - 32, areaH, rows.length * rowH);
    rows.forEach(([key, what], i) => {
      const y = areaY + i * rowH - offset;
      ui.rect(f.x + 28, y, keyW, rowH - 6, [0.95, 0.88, 0.74, 1], 8);
      ui.text(key, f.x + 40, y + (rowH - 6) / 2, 15, C.ink, { valign: 'middle', maxWidth: keyW - 20 });
      ui.text(what, f.x + 48 + keyW, y + (rowH - 6) / 2, 15, C.ink, { valign: 'middle', maxWidth: f.w - keyW - 90 });
    });
    ui.endScroll();
  }

  _help() {
    const ui = this.ui;
    const rows = PLATFORM.touch ? TOUCH_CONTROLS : DESKTOP_CONTROLS;
    const f = this._frame(760, 620, 'Controles', 'Plante, regue, colha, crie animais e venda tudo na caixa');
    if (f.closed) { this.back(); return null; }
    this._list(rows, f, 'help');
    if (ui.button(f.x + f.w - 188, f.y + f.h - 64, 160, 46, 'Voltar', { variant: 'primary' })) this.back();
    return null;
  }

  _about() {
    const ui = this.ui;
    const f = this._frame(640, 400, 'Sítio do Sol', `Versão ${PLATFORM.version}`);
    if (f.closed) { this.back(); return null; }
    let y = f.top;
    for (const line of CREDITS) {
      y += ui.textBlock(line, f.x + 28, y, 15, C.ink, f.w - 56, 1.35) + 8;
    }
    if (ui.button(f.x + f.w - 188, f.y + f.h - 64, 160, 46, 'Voltar', { variant: 'primary' })) this.back();
    return null;
  }
}

// ----------------------------------------------------------------------
// screens outside the game
// ----------------------------------------------------------------------

export function drawLoading(ui, progress, label) {
  ui.rect(0, 0, ui.w, ui.h, [0.98, 0.93, 0.80, 1]);
  ui.text('Sítio do Sol', ui.w / 2, ui.h / 2 - 70, 64, C.ink, { align: 'center', valign: 'middle' });
  ui.progress(ui.w / 2 - 220, ui.h / 2, 440, 14, progress, C.green, [0.55, 0.38, 0.24, 0.25]);
  ui.text(label || 'Carregando...', ui.w / 2, ui.h / 2 + 36, 15, C.inkSoft, { align: 'center' });
}

/** options: { art } hides the buttons (store artwork captures). */
export function drawTitle(ui, hasSave, t, options = {}) {
  const cx = ui.w / 2;
  const top = ui.h * 0.18;
  const bounce = Math.sin(t * 1.6) * 4;
  ui.text('Sítio do Sol', cx, top + bounce, Math.min(92, ui.w * 0.085), [1, 0.96, 0.84, 1],
    { align: 'center', valign: 'middle', outline: 0.32, outlineColor: [0.36, 0.2, 0.08, 1], shadow: true });
  ui.text(PLATFORM.native ? 'plante, colha e faça o sítio prosperar' : 'uma fazendinha 3D feita em WebGL2 puro', cx, top + 70, 20, C.white,
    { align: 'center', valign: 'middle', outline: 0.2, outlineColor: [0.25, 0.14, 0.05, 0.8] });
  if (options.art) return null;

  const items = [];
  if (hasSave) items.push({ label: 'Continuar', action: 'continue', variant: 'primary' });
  items.push({ label: 'Novo jogo', action: 'new', variant: hasSave ? 'secondary' : 'primary' });
  items.push({ label: 'Controles', action: 'help' });
  items.push({ label: 'Sobre', action: 'about' });

  const small = ui.h < 600;
  const bh = small ? 46 : 50;
  const step = small ? 56 : 64;
  const w = 300;
  const x = cx - w / 2;
  let y = Math.max(top + 112, ui.h * (small ? 0.42 : 0.46));
  let action = null;
  ui.panel(x - 24, y - 22, w + 48, (items.length - 1) * step + bh + 44, { radius: 26, fill: [0.99, 0.95, 0.86, 0.92] });
  for (const item of items) {
    if (ui.button(x, y, w, bh, item.label, { variant: item.variant || 'secondary', size: 21 })) action = item.action;
    y += step;
  }

  const footer = PLATFORM.native
    ? `Versão ${PLATFORM.version}`
    : 'Computação Gráfica · WebGL2 · Phong · leitor OBJ próprio · sombras em tempo real';
  ui.text(footer, cx, ui.h - 20 - ui.safe.bottom, 14, [1, 1, 1, 0.85], { align: 'center', valign: 'baseline', shadow: true });
  return action;
}
