/**
 * Daily weather: sunny, cloudy or rainy, rolled every morning.
 * Rain waters the field by itself, darkens the sky, wets the ground and
 * makes some fish bite more (the legendary Dourado only rises in the rain).
 */

export const WEATHER = {
  sun: { name: 'Ensolarado', icon: 'sun_icon', overcast: 0, rain: 0 },
  cloud: { name: 'Nublado', icon: 'cloud_icon', overcast: 0.62, rain: 0 },
  rain: { name: 'Chuva', icon: 'rain_icon', overcast: 0.92, rain: 1 },
};

const CHANCES = [['sun', 0.58], ['cloud', 0.2], ['rain', 0.22]];

export class Weather {
  constructor() {
    this.today = 'sun';
    this.tomorrow = 'sun';
    this.overcast = 0;        // smoothed 0..1 (sky, light)
    this.rain = 0;            // smoothed 0..1 (streaks, sound, wet ground)
    this.wetness = 0;         // ground darkening that lingers after the rain
    this.dryDays = 0;         // days in a row without rain
  }

  static roll(random) {
    let r = random();
    for (const [id, chance] of CHANCES) {
      if (r < chance) return id;
      r -= chance;
    }
    return 'sun';
  }

  /**
   * Called every morning. maxDryDays (or null): after that many dry days in a
   * row tomorrow is forced to rain, so the forecast always tells the truth.
   */
  newDay(random, maxDryDays = null) {
    this.today = this.tomorrow;
    this.dryDays = this.today === 'rain' ? 0 : this.dryDays + 1;
    this.tomorrow = Weather.roll(random);
    if (maxDryDays !== null && this.dryDays >= maxDryDays) this.tomorrow = 'rain';
  }

  get def() {
    return WEATHER[this.today];
  }

  get raining() {
    return this.today === 'rain';
  }

  /** Smooth transitions (real seconds); `instant` snaps (loading, waking up). */
  update(dt, instant = false) {
    const def = this.def;
    const k = instant ? 1 : 1 - Math.exp(-dt * 0.6);
    this.overcast += (def.overcast - this.overcast) * k;
    this.rain += (def.rain - this.rain) * k;
    const wetTarget = def.rain;
    const kw = instant ? 1 : 1 - Math.exp(-dt * (wetTarget > this.wetness ? 0.4 : 0.05));
    this.wetness += (wetTarget - this.wetness) * kw;
  }

  serialize() {
    return { today: this.today, tomorrow: this.tomorrow, dryDays: this.dryDays };
  }

  load(data) {
    if (!data) return;
    this.today = WEATHER[data.today] ? data.today : 'sun';
    this.tomorrow = WEATHER[data.tomorrow] ? data.tomorrow : 'sun';
    this.dryDays = data.dryDays || 0;
    this.update(0, true);
  }
}
