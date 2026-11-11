/**
 * Menus and dialogs: title screen, loading screen, shop, selling,
 * backpack, sleep, pause, controls, about, the journal (story, orders,
 * album, letters), letters, the village order board and the shed machines.
 *
 * Panels shrink to fit small screens and their lists scroll (drag or wheel).
 */

import { C } from './ui.js';
import { formatMoney, debugViewName } from './hud.js';
import { ITEMS, SHOP_TABS, CHAPTERS, LETTERS, FISH, MACHINES } from '../game/data.js';
import { WEATHER } from '../game/weather.js';
import { PLATFORM } from '../core/platform.js';

const JOURNAL_TABS = ['Jornada', 'Pedidos', 'Álbum', 'Cartas'];
const ALBUM_SECTIONS = [
  ['crop', 'Plantação'], ['fruit', 'Pomar'], ['animal', 'Animais e colmeia'], ['fish', 'Peixes do lago'],
  ['artisan', 'Produtos do galpão'], ['junk', 'Achados'],
];
const PAPER = [1, 0.97, 0.88, 1];
const ROW = [1, 0.98, 0.93, 1];
const WELL = [0.95, 0.89, 0.76, 1];

const DESKTOP_CONTROLS = [
  ['W A S D / setas', 'Andar'],
  ['Shift', 'Correr'],
  ['Mouse', 'Apontar canteiro ou objeto'],
  ['Clique esquerdo / Espaço', 'Usar ferramenta'],
  ['E', 'Interagir com o que está perto'],
  ['1 a 9', 'Escolher ferramenta ou semente'],
  ['Vara de pesca', 'Clique na água; clique de novo quando a boia afundar'],
  ['J', 'Diário: capítulos, pedidos, álbum, cartas'],
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
  ['Vara de pesca', 'Toque na água; toque de novo quando a boia afundar'],
  ['Botões no alto', 'Diário, mochila e pausa'],
];

const CREDITS = [
  'No Vale dos Ipês, a Vó entregou a você o sítio que ela e o avô construíram há cinquenta anos. Recupere a terra, os bichos e o lago, atenda a Vila do Sol e faça o velho ipê florir de novo.',
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
    this.journalTab = 0;
    this.letterId = null;
    this.machineId = null;
    this.returnTo = null;
    this.anim = 0;
  }

  show(name) {
    this.open = name;
    this.anim = 0;
    this.ui.resetScroll(name);
  }

  showLetter(id, returnTo = null) {
    this.letterId = id;
    this.returnTo = returnTo;
    this.show('letter');
  }

  showMachine(id) {
    this.machineId = id;
    this.show('machine');
  }

  close() {
    if (this.open === 'sell') this.game.closeBin();
    this.open = null;
  }

  /** Back navigation (Esc, Android back button). */
  back() {
    if ((this.open === 'help' || this.open === 'about' || this.open === 'letter') && this.returnTo) {
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
      case 'journal': return this._journal();
      case 'letter': return this._letter();
      case 'orders': return this._orders();
      case 'machine': return this._machine();
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
    const f = this._frame(820, 580, 'Mercadinho do Sítio', this.compact ? null : `Novidades a cada nível do sítio · você está no nível ${game.progress.level}`);
    if (f.closed) { this.close(); return null; }
    this._moneyBadge(f.x + f.w - 246, f.y + 16);

    const tabW = Math.min(150, (f.w - 56 - 24) / 4);
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
      ui.rect(x, y, w, rowH, e.locked ? [0.94, 0.9, 0.82, 1] : ROW, 14);
      const iconSize = rowH - 14;
      ui.rect(x + 8, y + 7, iconSize, iconSize, [0.93, 0.86, 0.72, 1], 12);
      ui.icon(e.icon, x + 10, y + 9, iconSize - 4, e.locked ? [0.25, 0.2, 0.15, 0.45] : C.white);
      if (e.locked) ui.icon('lock', x + iconSize - 22, y + iconSize - 22, 30);
      const tx = x + iconSize + 22;
      const textW = w - iconSize - 22 - 290;
      ui.text(e.name, tx, y + 10, 20, C.ink, { maxWidth: textW });
      if (e.owned !== undefined && ui.measure(e.name, 20) + 120 < textW) {
        ui.text(`você tem ${e.owned}`, tx + ui.measure(e.name, 20) + 10, y + 14, 14, C.inkSoft);
      }
      ui.textBlock(e.detail, tx, y + 38, 13, C.inkSoft, textW, 1.25);

      const bx = x + w - 140;
      if (e.maxed) {
        ui.text(e.kind === 'machine' ? 'Instalada' : 'Completo', bx + 65, y + rowH / 2, 18, C.green, { align: 'center', valign: 'middle' });
        return;
      }
      if (e.locked) {
        ui.rect(bx, y + rowH / 2 - 22, 130, 44, [0.86, 0.8, 0.7, 1], 12);
        ui.text(`Nível ${e.lockLevel}`, bx + 65, y + rowH / 2, 18, C.inkSoft, { align: 'center', valign: 'middle' });
        ui.text(formatMoney(e.price), bx - 16, y + rowH / 2, 18, C.grayInk, { align: 'right', valign: 'middle' });
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
    const bonus = game.sellBonus();
    const f = this._frame(720, h, 'Caixa de vendas', bonus > 1
      ? `${game.sellBonusLabel()}: tudo vale ${Math.round((bonus - 1) * 100)}% a mais hoje!` : 'O comprador da vila passa e paga na hora');
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
      const price = game.priceOf(id);
      ui.text(`${n} un. · ${formatMoney(price)} cada`, x + rowH + 10, y + 33, 14, C.inkSoft);
      ui.text(formatMoney(price * n), x + w - 262, y + rowH / 2, 18, C.ink, { align: 'right', valign: 'middle' });
      if (ui.button(x + w - 246, y + 8, 110, 42, 'Vender 1', { size: 16 })) game.announceSale(game.sell(id, 1));
      if (ui.button(x + w - 128, y + 8, 120, 42, 'Vender tudo', { variant: 'primary', size: 16 })) game.announceSale(game.sell(id, n));
    });
    ui.endScroll();

    const total = items.reduce((sum, id) => sum + game.priceOf(id) * game.inventory.count(id), 0);
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
    const ids = Object.keys(ITEMS).filter((id) => ITEMS[id].kind !== 'tool' && game.inventory.count(id) > 0);
    const f = this._frame(720, 500, 'Mochila', `Produtos para vender: ${formatMoney(game.inventory.sellValue())} · toque numa semente para usá-la`);
    if (f.closed) { this.close(); return null; }
    if (!ids.length) {
      ui.textBlock('A mochila está vazia. Compre sementes no mercadinho ou colha alguma coisa!', f.x + 40, f.top + 10, 17, C.inkSoft, f.w - 80);
      return null;
    }
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
      const seed = ITEMS[id].kind === 'seed';
      const selected = game.selectedId === id;
      if (selected) ui.rect(x - 3, y - 3, cell + 6, cell + 6, C.gold, 16);
      ui.rect(x, y, cell, cell, seed && ui.over(x, y, cell, cell) && !ui.touch ? [1, 0.95, 0.82, 1] : ROW, 14);
      ui.icon(ITEMS[id].icon, x + 6, y + 4, cell - 12);
      ui.text(String(n), x + cell - 8, y + cell - 8, 18, C.ink, { align: 'right', valign: 'baseline', outline: 0.2, outlineColor: [1, 1, 1, 0.9] });
      ui.text(ITEMS[id].name.replace('Semente de ', 'Sem. ').replace('Rama de ', '').replace('Muda de ', 'Muda '), x + cell / 2, y + cell + 6, 12, C.inkSoft, { align: 'center', maxWidth: cell + 6 });
      if (seed) {
        if (ui.over(x, y, cell, cell)) ui.cursor = 'pointer';
        if (ui._click(x, y, cell, cell)) {
          game.selectItem(id);
          this.close();
        }
      }
    });
    ui.endScroll();
    return null;
  }

  _sleep() {
    const ui = this.ui;
    const f = this._frame(480, 260, 'Dormir?', 'As plantas regadas crescem e as máquinas trabalham.');
    if (f.closed) { this.close(); return null; }
    const forecast = WEATHER[this.game.weather.tomorrow];
    ui.rect(f.x + 28, f.top - 4, f.w - 56, 44, WELL, 12);
    ui.icon(forecast.icon, f.x + 34, f.top - 2, 40);
    ui.text(`Previsão para amanhã: ${forecast.name.toLowerCase()}`, f.x + 82, f.top + 18, 16, C.ink, { valign: 'middle', maxWidth: f.w - 120 });
    ui.text('O jogo é salvo automaticamente.', f.x + 28, f.top + 52, 14, C.inkSoft);
    if (ui.button(f.x + 28, f.y + f.h - 72, 190, 50, 'Dormir', { variant: 'primary', size: 20 })) {
      this.close();
      return 'sleep';
    }
    if (ui.button(f.x + f.w - 218, f.y + f.h - 72, 190, 50, 'Cancelar', { size: 20 })) this.close();
    return null;
  }

  _pause(settings) {
    const ui = this.ui;
    const touch = PLATFORM.touch;
    const options = [
      { label: 'Continuar', action: 'resume', variant: 'primary' },
      { label: 'Diário', action: 'journal' },
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
    if (action === 'journal') {
      this.show('journal');
      return null;
    }
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
    const f = this._frame(660, 470, 'Sítio do Sol', `Versão ${PLATFORM.version}`);
    if (f.closed) { this.back(); return null; }
    let y = f.top;
    for (const line of CREDITS) {
      y += ui.textBlock(line, f.x + 28, y, 15, C.ink, f.w - 56, 1.35) + 8;
    }
    if (ui.button(f.x + f.w - 188, f.y + f.h - 64, 160, 46, 'Voltar', { variant: 'primary' })) this.back();
    return null;
  }

  // ------------------------------------------------------------------
  // journal: story, orders, album and letters
  // ------------------------------------------------------------------

  _journal() {
    const ui = this.ui;
    const game = this.game;
    const unread = game.progress.unreadLetters().length;
    const f = this._frame(860, 620, 'Diário do Sítio', this.compact ? null : 'A jornada para fazer o ipê florir de novo');
    if (f.closed) { this.close(); return null; }
    const tabW = Math.min(150, (f.w - 56 - 24) / 4);
    JOURNAL_TABS.forEach((name, i) => {
      const label = i === 3 && unread ? `${name} (${unread})` : name;
      if (ui.tab(f.x + 28 + i * (tabW + 8), f.top - 4, tabW, 38, label, this.journalTab === i)) {
        this.journalTab = i;
        ui.resetScroll('journal');
      }
    });
    const area = { x: f.x + 20, y: f.top + 40, w: f.w - 40, h: f.y + f.h - 18 - (f.top + 40) };
    ui.rect(area.x, area.y, area.w, area.h, WELL, 16);
    switch (this.journalTab) {
      case 0: this._journey(area); break;
      case 1: this._orderList(area, false); break;
      case 2: this._album(area); break;
      default: this._letters(area); break;
    }
    return null;
  }

  _journey(area) {
    const ui = this.ui;
    const game = this.game;
    const p = game.progress;
    const states = p.milestoneStates();
    const chapterRows = CHAPTERS.length;
    const content = 150 + (p.current ? p.current.tasks.length * 30 : 30) + 40 + chapterRows * 30 + 50 + states.length * 34 + 20;
    const offset = ui.beginScroll('journal', area.x, area.y, area.w, area.h, content);
    const x = area.x + 18;
    const w = area.w - 36;
    let y = area.y + 14 - offset;

    // current chapter card
    const chapter = p.current;
    const cardH = 84 + (chapter ? chapter.tasks.length * 30 : 30);
    ui.rect(x, y, w, cardH, PAPER, 14);
    if (chapter) {
      ui.text(`Capítulo ${p.chapter + 1} de ${CHAPTERS.length}`, x + 16, y + 12, 14, C.inkSoft);
      ui.text(chapter.title, x + 16, y + 30, 24, C.ink, { maxWidth: w - 32 });
      let ty = y + 66;
      ui.text(chapter.summary, x + 16, ty - 6, 14, C.inkSoft, { maxWidth: w - 32 });
      ty += 24;
      for (const task of chapter.tasks) {
        const s = p.taskState(task, game);
        if (s.done) ui.icon('check', x + 14, ty - 3, 24);
        else ui.rect(x + 18, ty + 2, 16, 16, [0.55, 0.38, 0.24, 0.3], 5);
        ui.text(task.label, x + 46, ty, 16, s.done ? C.green : C.ink, { maxWidth: w - 260 });
        if (!s.done) {
          const label = task.state === 'earned' ? `${formatMoney(s.value)} / ${formatMoney(s.target)}` : `${s.value}/${s.target}`;
          ui.progress(x + w - 200, ty + 6, 120, 8, s.value / s.target, C.gold);
          ui.text(label, x + w - 16, ty, 14, C.inkSoft, { align: 'right', maxWidth: 74 });
        }
        ty += 30;
      }
    } else {
      ui.icon('ipe', x + 10, y + 8, 64);
      ui.text('A Festa do Sol voltou!', x + 84, y + 16, 24, C.ink, { maxWidth: w - 100 });
      ui.textBlock('O ipê floresceu e o sítio segue para sempre: pedidos novos todo dia, peixes para pescar, recordes e marcos cada vez maiores.',
        x + 84, y + 50, 14, C.inkSoft, w - 100, 1.3);
    }
    y += cardH + 14;

    // level and totals
    ui.text(`Nível ${p.level} · ${p.xp}/${p.xpNeeded} XP · ganhou ${formatMoney(game.totalEarned)} · dia ${game.clock.day}`, x + 4, y, 15, C.ink, { maxWidth: w });
    y += 30;

    // chapter list
    CHAPTERS.forEach((c, i) => {
      const done = i < p.chapter;
      const current = i === p.chapter;
      ui.rect(x, y, w, 26, current ? [1, 0.93, 0.7, 1] : ROW, 8);
      if (done) ui.icon('check', x + 6, y + 1, 24);
      else if (!current) ui.icon('lock', x + 8, y + 3, 20, [1, 1, 1, 0.7]);
      else ui.icon('star', x + 6, y + 1, 24);
      const title = done || current ? c.title : '???';
      ui.text(`${i + 1}. ${title}`, x + 38, y + 13, 15, done ? C.green : current ? C.ink : C.grayInk, { valign: 'middle', maxWidth: w - 50 });
      y += 30;
    });
    y += 16;

    // endless milestones
    ui.text('Marcos do sítio (sem fim: cada marco dobra o próximo)', x + 4, y, 16, C.ink, { maxWidth: w });
    y += 30;
    for (const s of states) {
      ui.rect(x, y, w, 30, ROW, 8);
      ui.icon(s.milestone.icon, x + 4, y + 1, 28);
      ui.text(s.milestone.name, x + 40, y + 15, 15, C.ink, { valign: 'middle', maxWidth: w * 0.4 });
      for (let k = 0; k < Math.min(s.tier, 8); k++) ui.icon('star', x + w * 0.45 + k * 18, y + 6, 18);
      ui.progress(x + w - 230, y + 11, 130, 8, s.value / s.target, C.gold);
      ui.text(`${s.value}/${s.target}`, x + w - 10, y + 15, 14, C.inkSoft, { align: 'right', valign: 'middle', maxWidth: 90 });
      y += 34;
    }
    ui.endScroll();
  }

  /** Orders list; deliver = true at the board (buttons), false in the journal. */
  _orderList(area, deliver) {
    const ui = this.ui;
    const game = this.game;
    if (!game.progress.ordersOpen) {
      ui.textBlock('O Mural da Vila abre no capítulo 3. Termine os capítulos para que a vila volte a fazer encomendas.',
        area.x + 24, area.y + 20, 16, C.inkSoft, area.w - 48);
      return;
    }
    const orders = game.orders.list;
    if (!orders.length) {
      ui.textBlock('Nenhum pedido agora. Pedidos novos chegam toda manhã e algumas horas depois de cada entrega.',
        area.x + 24, area.y + 20, 16, C.inkSoft, area.w - 48);
      return;
    }
    const rowH = 92;
    const offset = ui.beginScroll(deliver ? 'orders' : 'journal', area.x, area.y, area.w, area.h, orders.length * (rowH + 8) + 40);
    const x = area.x + 12;
    const w = area.w - 24;
    orders.forEach((o, i) => {
      const y = area.y + 10 + i * (rowH + 8) - offset;
      const have = game.inventory.count(o.item);
      const ready = have >= o.amount;
      ui.rect(x, y, w, rowH, o.special ? [1, 0.93, 0.7, 1] : PAPER, 14);
      ui.rect(x + 10, y + 10, rowH - 20, rowH - 20, [0.93, 0.86, 0.72, 1], 12);
      ui.icon(ITEMS[o.item].icon, x + 12, y + 12, rowH - 24);
      const tx = x + rowH + 4;
      const textW = w - rowH - (deliver ? 200 : 130);
      ui.text(o.special ? `${o.requester} · encomenda especial` : o.requester, tx, y + 10, 14, o.special ? C.red : C.inkSoft, { maxWidth: textW });
      ui.text(`${o.amount}x ${ITEMS[o.item].name}`, tx, y + 30, 21, C.ink, { maxWidth: textW });
      const days = o.expires - game.clock.day;
      const due = days <= 0 ? 'vence hoje' : days === 1 ? 'vence amanhã' : `vence em ${days} dias`;
      ui.text(`Você tem ${have}/${o.amount} · ${due} · +${o.xp} XP`, tx, y + 62, 13, ready ? C.green : C.inkSoft, { maxWidth: textW });
      const rx = x + w - (deliver ? 186 : 16);
      ui.icon('coin', rx - (deliver ? 0 : 120) - 2, y + 16, 28);
      ui.text(formatMoney(o.reward), deliver ? rx + 30 : rx, y + 30, 19, C.ink, { align: deliver ? 'left' : 'right', valign: 'middle' });
      if (deliver && ui.button(rx, y + rowH - 50, 172, 40, 'Entregar', { variant: 'primary', disabled: !ready, size: 17 })) {
        game.deliverOrder(o);
      }
    });
    if (!deliver) {
      const y = area.y + 10 + orders.length * (rowH + 8) - offset;
      ui.text('Entregue os pedidos no Mural da Vila, na beira da estrada principal.', x + 6, y + 6, 14, C.inkSoft, { maxWidth: w });
    }
    ui.endScroll();
  }

  _album(area) {
    const ui = this.ui;
    const game = this.game;
    const p = game.progress;
    const cell = 74;
    const cols = Math.max(4, Math.floor((area.w - 40) / (cell + 10)));
    const sections = ALBUM_SECTIONS.map(([cat, name]) => ({
      name, ids: Object.keys(ITEMS).filter((id) => ITEMS[id].kind === 'produce' && ITEMS[id].cat === cat),
    }));
    const content = sections.reduce((sum, sec) => sum + 40 + Math.ceil(sec.ids.length / cols) * (cell + 34), 50);
    const offset = ui.beginScroll('journal', area.x, area.y, area.w, area.h, content);
    const totals = p.albumTotals();
    let y = area.y + 14 - offset;
    ui.text(`Álbum: ${totals.found} de ${totals.total} descobertos`, area.x + 22, y, 18, C.ink);
    y += 36;
    const speciesOf = {};
    for (const [species, fish] of Object.entries(FISH)) speciesOf[fish.item] = species;
    for (const sec of sections) {
      ui.text(sec.name, area.x + 22, y, 15, C.inkSoft);
      y += 26;
      sec.ids.forEach((id, i) => {
        const x = area.x + 20 + (i % cols) * (cell + 10);
        const yy = y + Math.floor(i / cols) * (cell + 34);
        const found = p.found[id] || 0;
        ui.rect(x, yy, cell, cell, found ? ROW : [0.88, 0.82, 0.7, 1], 12);
        ui.icon(ITEMS[id].icon, x + 5, yy + 4, cell - 10, found ? C.white : [0.12, 0.08, 0.05, 0.55]);
        let caption = found ? ITEMS[id].name : '???';
        const species = speciesOf[id];
        if (found && species && p.records[species]) caption = `${p.records[species].toFixed(1).replace('.', ',')} cm`;
        ui.text(caption, x + cell / 2, yy + cell + 6, 12, found ? C.inkSoft : C.grayInk, { align: 'center', maxWidth: cell + 8 });
      });
      y += Math.ceil(sec.ids.length / cols) * (cell + 34) + 14;
    }
    ui.endScroll();
  }

  _letters(area) {
    const ui = this.ui;
    const game = this.game;
    const letters = [...game.progress.letters].reverse();
    if (!letters.length) {
      ui.textBlock('Nenhuma carta ainda.', area.x + 24, area.y + 20, 16, C.inkSoft, area.w - 48);
      return;
    }
    const rowH = 58;
    const bottles = game.progress.bottlesFound();
    const offset = ui.beginScroll('journal', area.x, area.y, area.w, area.h, letters.length * (rowH + 6) + 56);
    const x = area.x + 12;
    const w = area.w - 24;
    letters.forEach((l, i) => {
      const y = area.y + 10 + i * (rowH + 6) - offset;
      const letter = LETTERS[l.id];
      ui.rect(x, y, w, rowH, l.read ? ROW : [1, 0.93, 0.7, 1], 12);
      ui.icon(letter.bottle ? 'message_bottle' : 'letter', x + 6, y + 5, rowH - 10);
      ui.text(letter.title, x + rowH + 8, y + 10, 18, C.ink, { maxWidth: w - rowH - 160 });
      ui.text(l.read ? (letter.bottle ? 'Achado no lago' : 'Lida') : 'Nova!', x + rowH + 8, y + 34, 13, l.read ? C.inkSoft : C.red);
      if (ui.button(x + w - 128, y + 9, 116, 40, 'Ler', { variant: l.read ? 'secondary' : 'primary', size: 16 })) {
        this.game.progress.markRead(l.id);
        this.showLetter(l.id, 'journal');
      }
    });
    const y = area.y + 14 + letters.length * (rowH + 6) - offset;
    ui.text(`Bilhetes em garrafas achados no lago: ${bottles}/6`, x + 6, y, 14, C.inkSoft, { maxWidth: w });
    ui.endScroll();
  }

  _letter() {
    const ui = this.ui;
    const letter = LETTERS[this.letterId];
    if (!letter) { this.close(); return null; }
    const w = Math.min(640, ui.w - 24);
    const h = Math.min(600, ui.h - 20);
    const ease = 1 - Math.pow(1 - this.anim, 3);
    const x = (ui.w - w) / 2;
    const y = (ui.h - h) / 2 + (1 - ease) * 30;
    ui.softShadow(x, y + 8, w, h, 10, 18);
    ui.rect(x, y, w, h, [0.86, 0.76, 0.58, 1], 8);
    ui.rect(x + 4, y + 4, w - 8, h - 8, [0.99, 0.96, 0.87, 1], 6);
    ui.block(x, y, w, h);
    const closed = ui.closeButton(x + w - 50, y + 14);
    ui.icon(letter.bottle ? 'message_bottle' : 'letter', x + 20, y + 14, 44);
    ui.text(letter.title, x + 74, y + 24, this.compact ? 22 : 26, C.ink, { maxWidth: w - 140 });
    const size = this.compact ? 15 : 17;
    const textW = w - 72;
    const paragraphs = letter.body.map((par) => ui.font.wrap(par, size, textW));
    const lineH = size * 1.45;
    const content = paragraphs.reduce((sum, lines) => sum + lines.length * lineH + 12, 0) + 60;
    const areaY = y + 72;
    const areaH = h - 72 - 70;
    const offset = ui.beginScroll('letter', x + 10, areaY, w - 20, areaH, content);
    let ty = areaY + 6 - offset;
    // faint ruled lines like a notebook page
    for (const lines of paragraphs) {
      for (const line of lines) {
        ui.rect(x + 34, ty + lineH - 4, textW, 1, [0.6, 0.7, 0.85, 0.25]);
        ui.text(line, x + 36, ty, size, [0.25, 0.17, 0.1, 1]);
        ty += lineH;
      }
      ty += 12;
    }
    ui.text(letter.sign, x + w - 40, ty + 8, size + 1, [0.45, 0.25, 0.15, 1], { align: 'right' });
    ui.endScroll();
    const label = this.returnTo ? 'Voltar' : 'Fechar';
    if (ui.button(x + w - 188, y + h - 62, 160, 46, label, { variant: 'primary' }) || closed) this.back();
    return null;
  }

  _orders() {
    const ui = this.ui;
    const game = this.game;
    const f = this._frame(820, 560, 'Mural da Vila', this.compact ? null : 'Encomendas da Vila do Sol: pagam mais que a caixa de vendas');
    if (f.closed) { this.close(); return null; }
    this._moneyBadge(f.x + f.w - 246, f.y + 16);
    const area = { x: f.x + 20, y: f.top, w: f.w - 40, h: f.y + f.h - 18 - f.top };
    ui.rect(area.x, area.y, area.w, area.h, WELL, 16);
    this._orderList(area, true);
    return null;
  }

  _machine() {
    const ui = this.ui;
    const game = this.game;
    const machine = game.machineById(this.machineId);
    if (!machine) { this.close(); return null; }
    const def = MACHINES[machine.id];
    const recipes = def.recipes;
    const rowH = 66;
    const f = this._frame(720, 250 + recipes.length * (rowH + 6), def.name, def.desc);
    if (f.closed) { this.close(); return null; }

    // status: current item, queue and finished goods
    const x = f.x + 24;
    const w = f.w - 48;
    let y = f.top - 6;
    ui.rect(x, y, w, 84, PAPER, 14);
    const recipe = machine.currentRecipe();
    if (recipe) {
      const left = Math.max(0, recipe.hours - machine.progress);
      ui.icon(ITEMS[recipe.output].icon, x + 10, y + 10, 64);
      ui.text(`Fazendo: ${ITEMS[recipe.output].name}`, x + 84, y + 14, 17, C.ink, { maxWidth: w - 300 });
      ui.progress(x + 84, y + 44, w - 330, 10, machine.progress / recipe.hours, C.gold);
      ui.text(`~${Math.ceil(left)}h · fila ${machine.queue.length}/${def.capacity}`, x + 84, y + 60, 13, C.inkSoft);
    } else {
      ui.text('Parada. Coloque ingredientes abaixo.', x + 16, y + 30, 16, C.inkSoft, { maxWidth: w - 260 });
    }
    const ready = machine.readyCount();
    if (ui.button(x + w - 220, y + 20, 206, 46, ready ? `Coletar ${ready}` : 'Nada pronto', { variant: 'primary', disabled: !ready, size: 17 })) {
      game.machineCollect(machine);
    }
    y += 98;

    // recipes (scroll when the screen is short, e.g. phones in landscape)
    const listY = y;
    const listH = f.y + f.h - 14 - listY;
    const offset = ui.beginScroll('machine', f.x + 12, listY, f.w - 24, listH, recipes.length * (rowH + 6));
    y = listY - offset;
    recipes.forEach((r, i) => {
      const have = game.inventory.count(r.input);
      const room = machine.room();
      ui.rect(x, y, w, rowH, ROW, 12);
      ui.icon(ITEMS[r.input].icon, x + 8, y + 5, rowH - 10);
      ui.text('»', x + rowH + 14, y + rowH / 2, 26, C.inkSoft, { align: 'center', valign: 'middle' });
      ui.icon(ITEMS[r.output].icon, x + rowH + 28, y + 5, rowH - 10);
      const tx = x + rowH * 2 + 34;
      ui.text(`${ITEMS[r.input].name} » ${ITEMS[r.output].name}`, tx, y + 12, 16, C.ink, { maxWidth: w - rowH * 2 - 200 });
      ui.text(`${r.hours}h cada · vende por ${formatMoney(ITEMS[r.output].sell)} · você tem ${have}`, tx, y + 38, 13, have ? C.inkSoft : C.grayInk, { maxWidth: w - rowH * 2 - 200 });
      const disabled = !have || room <= 0;
      if (ui.button(x + w - 148, y + 12, 62, 42, '+1', { variant: 'primary', disabled, size: 17 })) game.machineAdd(machine, i, 1);
      if (ui.button(x + w - 78, y + 12, 66, 42, '+5', { variant: 'primary', disabled, size: 17 })) game.machineAdd(machine, i, 5);
      y += rowH + 6;
    });
    ui.endScroll();
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
