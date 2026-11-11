/**
 * Long-term progress: experience and farm level, the story chapters,
 * activity counters, letters, the collection album and fish records.
 * The level has no cap and the farm keeps going after the last chapter.
 */

import { CHAPTERS, LETTERS, ITEMS, FISH, MILESTONES, xpToNext, milestoneTarget } from './data.js';

export class Progress {
  constructor() {
    this.level = 1;
    this.xp = 0;
    this.chapter = 0;              // index into CHAPTERS; CHAPTERS.length = epilogue
    this.chapterStart = {};        // stats snapshot when the chapter began
    this.stats = {};               // activity counters (till, plant, harvest, fish, ...)
    this.found = {};               // item id -> amount obtained (album)
    this.records = {};             // fish species -> biggest size (cm)
    this.letters = [];             // { id, read }
    this.rod = false;              // got the grandfather's fishing rod
    this.ordersOpen = false;       // village order board unlocked
    this.bloom = false;            // the ipê bloomed (story finished)
    this.milestones = {};          // milestone id -> tiers reached
  }

  /** { milestone, tier, value, target } for each endless milestone. */
  milestoneStates() {
    return MILESTONES.map((m) => {
      const tier = this.milestones[m.id] || 0;
      return { milestone: m, tier, value: this.stat(m.stat), target: milestoneTarget(m, tier) };
    });
  }

  /** Advances milestones whose target was reached; returns the list reached now. */
  checkMilestones() {
    const reached = [];
    for (const state of this.milestoneStates()) {
      if (state.value >= state.target) {
        this.milestones[state.milestone.id] = state.tier + 1;
        reached.push(state);
      }
    }
    return reached;
  }

  // ------------------------------------------------------------------
  // experience
  // ------------------------------------------------------------------

  get xpNeeded() {
    return xpToNext(this.level);
  }

  /** Adds experience; returns how many levels were gained. */
  addXp(amount) {
    this.xp += Math.max(0, Math.round(amount));
    let gained = 0;
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level += 1;
      gained += 1;
    }
    return gained;
  }

  // ------------------------------------------------------------------
  // counters and album
  // ------------------------------------------------------------------

  count(stat, amount = 1) {
    this.stats[stat] = (this.stats[stat] || 0) + amount;
  }

  stat(stat) {
    return this.stats[stat] || 0;
  }

  /** Records an obtained item; returns true the first time. */
  discover(itemId, amount = 1) {
    const first = !this.found[itemId];
    this.found[itemId] = (this.found[itemId] || 0) + amount;
    return first;
  }

  fishSpeciesCaught() {
    return Object.keys(FISH).filter((s) => this.found[FISH[s].item]).length;
  }

  /** Returns true when the size beats the species record. */
  recordFish(species, size) {
    const best = this.records[species] || 0;
    if (size > best) {
      this.records[species] = size;
      return best > 0;
    }
    return false;
  }

  albumTotals() {
    const ids = Object.keys(ITEMS).filter((id) => ITEMS[id].kind === 'produce');
    return { found: ids.filter((id) => this.found[id]).length, total: ids.length };
  }

  // ------------------------------------------------------------------
  // story
  // ------------------------------------------------------------------

  get current() {
    return CHAPTERS[this.chapter] || null;
  }

  get finished() {
    return this.chapter >= CHAPTERS.length;
  }

  startChapter(index) {
    this.chapter = index;
    this.chapterStart = { ...this.stats };
  }

  /** Current value of a chapter task: { value, target, done }. */
  taskState(task, game) {
    let value;
    if (task.stat) {
      value = this.stat(task.stat) - (this.chapterStart[task.stat] || 0);
    } else {
      switch (task.state) {
        case 'level': value = this.level; break;
        case 'animals': value = game.animals.length; break;
        case 'species': value = this.fishSpeciesCaught(); break;
        case 'earned': value = Math.floor(game.totalEarned); break;
        default: value = 0;
      }
    }
    return { value: Math.min(value, task.n), target: task.n, done: value >= task.n };
  }

  chapterComplete(game) {
    const chapter = this.current;
    return !!chapter && chapter.tasks.every((task) => this.taskState(task, game).done);
  }

  // ------------------------------------------------------------------
  // letters
  // ------------------------------------------------------------------

  addLetter(id, read = false) {
    if (!LETTERS[id] || this.letters.some((l) => l.id === id)) return false;
    this.letters.push({ id, read });
    return true;
  }

  unreadLetters() {
    return this.letters.filter((l) => !l.read);
  }

  bottlesFound() {
    return this.letters.filter((l) => LETTERS[l.id].bottle).length;
  }

  markRead(id) {
    const letter = this.letters.find((l) => l.id === id);
    if (letter) letter.read = true;
  }

  serialize() {
    return {
      level: this.level, xp: this.xp, chapter: this.chapter, chapterStart: this.chapterStart,
      stats: this.stats, found: this.found, records: this.records, letters: this.letters,
      rod: this.rod, ordersOpen: this.ordersOpen, bloom: this.bloom, milestones: this.milestones,
    };
  }

  load(data) {
    Object.assign(this, {
      level: data.level || 1,
      xp: data.xp || 0,
      chapter: Math.min(data.chapter || 0, CHAPTERS.length),
      chapterStart: { ...(data.chapterStart || {}) },
      stats: { ...(data.stats || {}) },
      found: { ...(data.found || {}) },
      records: { ...(data.records || {}) },
      letters: (data.letters || []).filter((l) => LETTERS[l.id]).map((l) => ({ id: l.id, read: !!l.read })),
      rod: !!data.rod,
      ordersOpen: !!data.ordersOpen,
      bloom: !!data.bloom,
      milestones: { ...(data.milestones || {}) },
    });
  }
}
