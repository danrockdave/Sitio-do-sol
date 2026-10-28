/**
 * In-game clock. Converts real seconds into in-game hours and days.
 */

import { HOUR_SECONDS, DAY_START_HOUR, WEEKDAYS } from './data.js';

export class Clock {
  constructor() {
    this.day = 1;
    this.hour = DAY_START_HOUR;
    this.speed = 1;              // multiplier (key T toggles a fast mode for demos)
  }

  /** Advances by real seconds and returns the elapsed in-game hours. */
  tick(seconds) {
    const hours = (seconds / HOUR_SECONDS) * this.speed;
    this.advanceHours(hours);
    return hours;
  }

  advanceHours(hours) {
    this.hour += hours;
    while (this.hour >= 24) {
      this.hour -= 24;
      this.day += 1;
    }
  }

  /** Hours from now until the next given hour of the day. */
  hoursUntil(targetHour) {
    let delta = targetHour - this.hour;
    if (delta <= 0) delta += 24;
    return delta;
  }

  timeString() {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 6) * 10;   // 10-minute steps, like most farming games
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  weekday() {
    return WEEKDAYS[this.day % 7];
  }

  serialize() {
    return { day: this.day, hour: this.hour };
  }

  load(data) {
    this.day = data.day;
    this.hour = data.hour;
  }
}
