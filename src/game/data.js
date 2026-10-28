/**
 * Game design data: items, crops, animals, fruit trees, shop and upgrades.
 * Texts shown to the player are in Portuguese.
 *
 * Time unit: in-game hours. One in-game hour lasts HOUR_SECONDS real seconds.
 */

export const HOUR_SECONDS = 10;          // 1 in-game day = 4 real minutes
export const DAY_START_HOUR = 6;
export const SLEEP_FROM_HOUR = 18;
export const WET_HOURS = 16;             // how long watered soil stays wet
export const START_MONEY = 300;
export const GOAL_MONEY = 10000;

export const ITEMS = {
  // tools (always in the hotbar)
  hoe: { name: 'Enxada', kind: 'tool', icon: 'hoe', desc: 'Prepara a terra para o plantio.' },
  watering_can: { name: 'Regador', kind: 'tool', icon: 'watering_can', desc: 'Molha a terra. Plantas só crescem molhadas.' },
  basket: { name: 'Cesta', kind: 'tool', icon: 'basket', desc: 'Colhe plantas, frutas, ovos, leite e lã.' },

  // seeds
  seed_carrot: { name: 'Semente de cenoura', kind: 'seed', crop: 'carrot', icon: 'seed_carrot', price: 15 },
  seed_tomato: { name: 'Semente de tomate', kind: 'seed', crop: 'tomato', icon: 'seed_tomato', price: 30 },
  seed_corn: { name: 'Semente de milho', kind: 'seed', crop: 'corn', icon: 'seed_corn', price: 45 },
  seed_pumpkin: { name: 'Semente de abóbora', kind: 'seed', crop: 'pumpkin', icon: 'seed_pumpkin', price: 80 },

  // produce
  carrot: { name: 'Cenoura', kind: 'produce', icon: 'carrot', sell: 35 },
  tomato: { name: 'Tomate', kind: 'produce', icon: 'tomato', sell: 24 },
  corn: { name: 'Milho', kind: 'produce', icon: 'corn', sell: 75 },
  pumpkin: { name: 'Abóbora', kind: 'produce', icon: 'pumpkin', sell: 260 },
  apple: { name: 'Maçã', kind: 'produce', icon: 'apple', sell: 28 },
  orange: { name: 'Laranja', kind: 'produce', icon: 'orange', sell: 32 },
  egg: { name: 'Ovo', kind: 'produce', icon: 'egg', sell: 40 },
  milk: { name: 'Leite', kind: 'produce', icon: 'milk', sell: 95 },
  wool: { name: 'Lã', kind: 'produce', icon: 'wool', sell: 120 },
};

export const HOTBAR = ['hoe', 'watering_can', 'basket', 'seed_carrot', 'seed_tomato', 'seed_corn', 'seed_pumpkin'];

/**
 * hoursPerStage: growth hours (while wet) between each of the 5 stages.
 * regrowStage: after harvest the plant returns to this stage instead of disappearing.
 */
export const CROPS = {
  carrot: { name: 'Cenoura', produce: 'carrot', hoursPerStage: 2, yield: [1, 2], regrowStage: null },
  tomato: { name: 'Tomate', produce: 'tomato', hoursPerStage: 3, yield: [2, 3], regrowStage: 3 },
  corn: { name: 'Milho', produce: 'corn', hoursPerStage: 4.5, yield: [1, 2], regrowStage: null },
  pumpkin: { name: 'Abóbora', produce: 'pumpkin', hoursPerStage: 6, yield: [1, 1], regrowStage: null },
};
export const CROP_STAGES = 5;

export const ANIMALS = {
  chicken: { name: 'Galinha', product: 'egg', hours: 10, building: 'coop', speed: 0.9, radius: 0.3, price: 250 },
  cow: { name: 'Vaca', product: 'milk', hours: 14, building: 'barn', speed: 0.55, radius: 0.7, price: 750 },
  sheep: { name: 'Ovelha', product: 'wool', hours: 20, building: 'barn', speed: 0.65, radius: 0.55, price: 550 },
};

export const FRUIT_TREES = {
  apple: { name: 'Macieira', fruit: 'apple', hours: 16 },
  orange: { name: 'Laranjeira', fruit: 'orange', hours: 18 },
};

/** Upgrade levels: `levels[i]` is the value after buying level i (level 0 = start). */
export const UPGRADES = {
  field: {
    name: 'Ampliar plantação', icon: 'upgrade_field',
    desc: 'Aumenta a área de plantio.',
    levels: [6, 8, 10, 12], costs: [0, 400, 1000, 2000],
    describe: (v) => `${v} x ${v} canteiros`,
  },
  can: {
    name: 'Regador grande', icon: 'upgrade_can',
    desc: 'O regador passa a molhar uma área 3 x 3.',
    levels: [1, 3], costs: [0, 650],
    describe: (v) => (v === 1 ? '1 canteiro' : '3 x 3 canteiros'),
  },
  coop: {
    name: 'Ampliar galinheiro', icon: 'upgrade_coop',
    desc: 'Mais espaço para galinhas.',
    levels: [4, 8], costs: [0, 900],
    describe: (v) => `${v} galinhas`,
  },
  barn: {
    name: 'Ampliar celeiro', icon: 'upgrade_barn',
    desc: 'Mais espaço para vacas e ovelhas.',
    levels: [3, 6], costs: [0, 1500],
    describe: (v) => `${v} animais`,
  },
  orchard: {
    name: 'Pomar', icon: 'upgrade_orchard',
    desc: 'Planta mais árvores frutíferas.',
    levels: [2, 4], costs: [0, 1200],
    describe: (v) => `${v} árvores`,
  },
};

export const SHOP_TABS = [
  { id: 'seeds', name: 'Sementes', items: ['seed_carrot', 'seed_tomato', 'seed_corn', 'seed_pumpkin'] },
  { id: 'animals', name: 'Animais', items: ['chicken', 'cow', 'sheep'] },
  { id: 'upgrades', name: 'Melhorias', items: ['field', 'can', 'coop', 'barn', 'orchard'] },
];

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * HUD icons are rendered from the 3D models into a texture atlas at start-up.
 * Each icon lists model parts with an optional local transform.
 */
export const ICONS = {
  hoe: [{ model: 'hoe', rotZ: 20 }],
  watering_can: [{ model: 'watering_can', rotY: -60 }],
  basket: [{ model: 'basket' }],
  coin: [{ model: 'coin', rotY: -25 }],
  carrot: [{ model: 'carrot_item', rotZ: -40 }],
  tomato: [{ model: 'tomato_item' }],
  corn: [{ model: 'corn_item', rotZ: -35 }],
  pumpkin: [{ model: 'pumpkin_item' }],
  apple: [{ model: 'apple_item' }],
  orange: [{ model: 'orange_item' }],
  egg: [{ model: 'egg', rotZ: -15 }],
  milk: [{ model: 'milk' }],
  wool: [{ model: 'wool' }],
  seed_carrot: [{ model: 'seed_bag' }, { model: 'carrot_item', scale: 0.5, offset: [0.13, -0.08, 0.18], rotZ: -40 }],
  seed_tomato: [{ model: 'seed_bag' }, { model: 'tomato_item', scale: 0.5, offset: [0.13, -0.1, 0.18] }],
  seed_corn: [{ model: 'seed_bag' }, { model: 'corn_item', scale: 0.5, offset: [0.13, -0.08, 0.18], rotZ: -35 }],
  seed_pumpkin: [{ model: 'seed_bag' }, { model: 'pumpkin_item', scale: 0.5, offset: [0.13, -0.1, 0.18] }],
  chicken: [{ model: 'chicken', rotY: 35 }],
  cow: [{ model: 'cow', rotY: 50 }],
  sheep: [{ model: 'sheep', rotY: 50 }],
  upgrade_field: [{ model: 'soil_tile' }, { model: 'carrot_4', scale: 0.9 }],
  upgrade_can: [{ model: 'watering_can', rotY: -60 }, { model: 'upgrade_icon', scale: 0.55, offset: [0.22, 0.18, 0.2] }],
  upgrade_coop: [{ model: 'coop', rotY: 20 }],
  upgrade_barn: [{ model: 'barn', rotY: 20 }],
  upgrade_orchard: [{ model: 'fruit_tree' }],
  sapling: [{ model: 'sapling' }],
  house: [{ model: 'house', rotY: 20 }],
};
