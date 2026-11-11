/**
 * Game design data: items, crops, animals, fruit trees, fish, production
 * machines, upgrades, levels, the story chapters and the letters.
 * Texts shown to the player are in Portuguese.
 *
 * Time unit: in-game hours. One in-game hour lasts HOUR_SECONDS real seconds.
 */

export const HOUR_SECONDS = 10;          // 1 in-game day = 4 real minutes
export const DAY_START_HOUR = 6;
export const SLEEP_FROM_HOUR = 18;
export const WET_HOURS = 16;             // how long watered soil stays wet
export const START_MONEY = 300;

/**
 * kind: tool | seed | produce (everything that can be sold)
 * cat (produce): crop | fruit | animal | fish | artisan | junk  (album sections)
 */
export const ITEMS = {
  // tools
  hoe: { name: 'Enxada', kind: 'tool', icon: 'hoe', desc: 'Prepara a terra para o plantio.' },
  watering_can: { name: 'Regador', kind: 'tool', icon: 'watering_can', desc: 'Molha a terra. Plantas só crescem molhadas.' },
  basket: { name: 'Cesta', kind: 'tool', icon: 'basket', desc: 'Colhe plantas, frutas e produtos dos animais.' },
  rod: { name: 'Vara de pesca', kind: 'tool', icon: 'fishing_rod', desc: 'Pesca no lago. Espere a boia afundar e puxe!' },

  // seeds
  seed_lettuce: { name: 'Semente de alface', kind: 'seed', crop: 'lettuce', icon: 'seed_lettuce', price: 10 },
  seed_carrot: { name: 'Semente de cenoura', kind: 'seed', crop: 'carrot', icon: 'seed_carrot', price: 15 },
  seed_tomato: { name: 'Semente de tomate', kind: 'seed', crop: 'tomato', icon: 'seed_tomato', price: 30 },
  seed_potato: { name: 'Semente de batata', kind: 'seed', crop: 'potato', icon: 'seed_potato', price: 25 },
  seed_corn: { name: 'Semente de milho', kind: 'seed', crop: 'corn', icon: 'seed_corn', price: 45 },
  seed_strawberry: { name: 'Muda de morango', kind: 'seed', crop: 'strawberry', icon: 'seed_strawberry', price: 60 },
  seed_pumpkin: { name: 'Semente de abóbora', kind: 'seed', crop: 'pumpkin', icon: 'seed_pumpkin', price: 80 },
  seed_sunflower: { name: 'Semente de girassol', kind: 'seed', crop: 'sunflower', icon: 'seed_sunflower', price: 50 },
  seed_cassava: { name: 'Rama de mandioca', kind: 'seed', crop: 'cassava', icon: 'seed_cassava', price: 70 },
  seed_watermelon: { name: 'Semente de melancia', kind: 'seed', crop: 'watermelon', icon: 'seed_watermelon', price: 120 },

  // crops
  lettuce: { name: 'Alface', kind: 'produce', cat: 'crop', icon: 'lettuce', sell: 22 },
  carrot: { name: 'Cenoura', kind: 'produce', cat: 'crop', icon: 'carrot', sell: 35 },
  tomato: { name: 'Tomate', kind: 'produce', cat: 'crop', icon: 'tomato', sell: 24 },
  potato: { name: 'Batata', kind: 'produce', cat: 'crop', icon: 'potato', sell: 22 },
  corn: { name: 'Milho', kind: 'produce', cat: 'crop', icon: 'corn', sell: 75 },
  strawberry: { name: 'Morango', kind: 'produce', cat: 'crop', icon: 'strawberry', sell: 32 },
  pumpkin: { name: 'Abóbora', kind: 'produce', cat: 'crop', icon: 'pumpkin', sell: 260 },
  sunflower: { name: 'Girassol', kind: 'produce', cat: 'crop', icon: 'sunflower', sell: 140 },
  cassava: { name: 'Mandioca', kind: 'produce', cat: 'crop', icon: 'cassava', sell: 85 },
  watermelon: { name: 'Melancia', kind: 'produce', cat: 'crop', icon: 'watermelon', sell: 420 },

  // fruits
  apple: { name: 'Maçã', kind: 'produce', cat: 'fruit', icon: 'apple', sell: 28 },
  orange: { name: 'Laranja', kind: 'produce', cat: 'fruit', icon: 'orange', sell: 32 },
  mango: { name: 'Manga', kind: 'produce', cat: 'fruit', icon: 'mango', sell: 45 },

  // animal products
  egg: { name: 'Ovo', kind: 'produce', cat: 'animal', icon: 'egg', sell: 40 },
  duck_egg: { name: 'Ovo de pata', kind: 'produce', cat: 'animal', icon: 'duck_egg', sell: 70 },
  milk: { name: 'Leite', kind: 'produce', cat: 'animal', icon: 'milk', sell: 95 },
  goat_milk: { name: 'Leite de cabra', kind: 'produce', cat: 'animal', icon: 'goat_milk', sell: 140 },
  wool: { name: 'Lã', kind: 'produce', cat: 'animal', icon: 'wool', sell: 120 },
  truffle: { name: 'Trufa', kind: 'produce', cat: 'animal', icon: 'truffle', sell: 260 },
  honey: { name: 'Mel', kind: 'produce', cat: 'animal', icon: 'honey', sell: 180 },

  // fish
  fish_lambari: { name: 'Lambari', kind: 'produce', cat: 'fish', icon: 'fish_lambari', sell: 22 },
  fish_tilapia: { name: 'Tilápia', kind: 'produce', cat: 'fish', icon: 'fish_tilapia', sell: 45 },
  fish_traira: { name: 'Traíra', kind: 'produce', cat: 'fish', icon: 'fish_traira', sell: 75 },
  fish_carpa: { name: 'Carpa', kind: 'produce', cat: 'fish', icon: 'fish_carpa', sell: 95 },
  fish_tucunare: { name: 'Tucunaré', kind: 'produce', cat: 'fish', icon: 'fish_tucunare', sell: 130 },
  fish_pintado: { name: 'Pintado', kind: 'produce', cat: 'fish', icon: 'fish_pintado', sell: 180 },
  fish_dourado: { name: 'Dourado', kind: 'produce', cat: 'fish', icon: 'fish_dourado', sell: 650 },

  // artisan goods (made in the shed)
  cheese: { name: 'Queijo minas', kind: 'produce', cat: 'artisan', icon: 'cheese', sell: 260 },
  goat_cheese: { name: 'Queijo de cabra', kind: 'produce', cat: 'artisan', icon: 'goat_cheese', sell: 360 },
  jam_apple: { name: 'Doce de maçã', kind: 'produce', cat: 'artisan', icon: 'jam_apple', sell: 90 },
  jam_orange: { name: 'Doce de laranja', kind: 'produce', cat: 'artisan', icon: 'jam_orange', sell: 95 },
  jam_strawberry: { name: 'Geleia de morango', kind: 'produce', cat: 'artisan', icon: 'jam_strawberry', sell: 110 },
  jam_mango: { name: 'Doce de manga', kind: 'produce', cat: 'artisan', icon: 'jam_mango', sell: 125 },
  pumpkin_sweet: { name: 'Doce de abóbora', kind: 'produce', cat: 'artisan', icon: 'pumpkin_sweet', sell: 560 },
  cloth: { name: 'Tecido de lã', kind: 'produce', cat: 'artisan', icon: 'cloth', sell: 300 },
  corn_cake: { name: 'Bolo de milho', kind: 'produce', cat: 'artisan', icon: 'corn_cake', sell: 190 },
  tapioca: { name: 'Tapioca', kind: 'produce', cat: 'artisan', icon: 'tapioca', sell: 210 },

  // lake junk
  old_boot: { name: 'Bota velha', kind: 'produce', cat: 'junk', icon: 'old_boot', sell: 2 },
};

/** Tools always in the hotbar (the rod only after the story gives it). Seeds fill the remaining slots. */
export const TOOLS = ['hoe', 'watering_can', 'basket', 'rod'];

/**
 * hoursPerStage: growth hours (while wet) between each of the 5 stages.
 * regrowStage: after harvest the plant returns to this stage instead of disappearing.
 * level: farm level that unlocks the seed in the shop.
 */
export const CROPS = {
  lettuce: { name: 'Alface', produce: 'lettuce', hoursPerStage: 1.5, yield: [1, 1], regrowStage: null, level: 1 },
  carrot: { name: 'Cenoura', produce: 'carrot', hoursPerStage: 2, yield: [1, 2], regrowStage: null, level: 1 },
  tomato: { name: 'Tomate', produce: 'tomato', hoursPerStage: 3, yield: [2, 3], regrowStage: 3, level: 1 },
  potato: { name: 'Batata', produce: 'potato', hoursPerStage: 2.5, yield: [2, 3], regrowStage: null, level: 2 },
  corn: { name: 'Milho', produce: 'corn', hoursPerStage: 4.5, yield: [1, 2], regrowStage: null, level: 2 },
  strawberry: { name: 'Morango', produce: 'strawberry', hoursPerStage: 3.5, yield: [2, 3], regrowStage: 3, level: 3 },
  pumpkin: { name: 'Abóbora', produce: 'pumpkin', hoursPerStage: 6, yield: [1, 1], regrowStage: null, level: 4 },
  sunflower: { name: 'Girassol', produce: 'sunflower', hoursPerStage: 4, yield: [1, 1], regrowStage: null, level: 5, seedBack: 0.5 },
  cassava: { name: 'Mandioca', produce: 'cassava', hoursPerStage: 5, yield: [2, 3], regrowStage: null, level: 6 },
  watermelon: { name: 'Melancia', produce: 'watermelon', hoursPerStage: 7, yield: [1, 1], regrowStage: null, level: 7 },
};
export const CROP_STAGES = 5;

export const ANIMALS = {
  chicken: { name: 'Galinha', product: 'egg', hours: 10, building: 'coop', speed: 0.9, radius: 0.3, price: 250, level: 1, article: 'a' },
  cow: { name: 'Vaca', product: 'milk', hours: 14, building: 'barn', speed: 0.55, radius: 0.7, price: 750, level: 1, article: 'a' },
  sheep: { name: 'Ovelha', product: 'wool', hours: 20, building: 'barn', speed: 0.65, radius: 0.55, price: 550, level: 2, article: 'a' },
  duck: { name: 'Pata', product: 'duck_egg', hours: 12, building: 'coop', speed: 0.8, radius: 0.3, price: 400, level: 3, article: 'a' },
  goat: { name: 'Cabra', product: 'goat_milk', hours: 16, building: 'barn', speed: 0.7, radius: 0.55, price: 900, level: 4, article: 'a' },
  pig: { name: 'Porco', product: 'truffle', hours: 24, building: 'barn', speed: 0.6, radius: 0.6, price: 1400, level: 6, article: 'o' },
};

export const FRUIT_TREES = {
  apple: { name: 'Macieira', fruit: 'apple', hours: 16 },
  orange: { name: 'Laranjeira', fruit: 'orange', hours: 18 },
  mango: { name: 'Mangueira', fruit: 'mango', hours: 20 },
};

/**
 * Fish of the lake. hours: when they bite ([from, to], may wrap past midnight);
 * rain: weight multiplier on rainy days; difficulty 1..5 sets the reel mini-game.
 */
export const FISH = {
  lambari: { item: 'fish_lambari', size: [8, 16], difficulty: 1, weight: 30 },
  tilapia: { item: 'fish_tilapia', size: [18, 42], difficulty: 2, weight: 22, hours: [6, 19] },
  traira: { item: 'fish_traira', size: [25, 58], difficulty: 3, weight: 16, hours: [17, 6], rain: 1.4 },
  carpa: { item: 'fish_carpa', size: [32, 75], difficulty: 3, weight: 9 },
  tucunare: { item: 'fish_tucunare', size: [28, 64], difficulty: 4, weight: 7, hours: [5, 10], hours2: [15, 20] },
  pintado: { item: 'fish_pintado', size: [48, 96], difficulty: 4, weight: 3, rain: 3, night: 2 },
  dourado: { item: 'fish_dourado', size: [70, 110], difficulty: 5, weight: 0, legendary: true },
};

/**
 * Production machines in the shed. Each unit of input takes `hours`;
 * up to `capacity` units can wait in line. The beehive works on its own.
 */
export const MACHINES = {
  cheese_press: {
    name: 'Queijaria', model: 'cheese_press', price: 1200, level: 3, capacity: 6, x: 11.6, z: 12.9, yaw: 0,
    recipes: [{ input: 'milk', output: 'cheese', hours: 8 }, { input: 'goat_milk', output: 'goat_cheese', hours: 9 }],
    desc: 'Transforma leite em queijo.',
  },
  jam_pot: {
    name: 'Tacho de doces', model: 'jam_pot', price: 900, level: 4, capacity: 6, x: 14.3, z: 12.9, yaw: 0,
    recipes: [
      { input: 'strawberry', output: 'jam_strawberry', hours: 6 }, { input: 'apple', output: 'jam_apple', hours: 6 },
      { input: 'orange', output: 'jam_orange', hours: 6 }, { input: 'mango', output: 'jam_mango', hours: 6 },
      { input: 'pumpkin', output: 'pumpkin_sweet', hours: 8 },
    ],
    desc: 'Frutas e abóbora viram doces e geleias.',
  },
  loom: {
    name: 'Tear', model: 'loom', price: 1500, level: 5, capacity: 6, x: 16.9, z: 12.9, yaw: 0,
    recipes: [{ input: 'wool', output: 'cloth', hours: 10 }],
    desc: 'Tece lã em tecido.',
  },
  oven: {
    name: 'Forno a lenha', model: 'oven', price: 1300, level: 6, capacity: 6, x: 19.6, z: 12.9, yaw: 0,
    recipes: [{ input: 'corn', output: 'corn_cake', hours: 5 }, { input: 'cassava', output: 'tapioca', hours: 4 }],
    desc: 'Assa bolo de milho e tapioca.',
  },
  beehive: {
    name: 'Colmeia', model: 'beehive', price: 1000, level: 7, capacity: 3, x: 7.9, z: 13.4, yaw: 20,
    passive: { output: 'honey', hours: 30, fastHours: 20 },
    desc: 'Produz mel sozinha. Girassóis na plantação aceleram as abelhas.',
  },
};

/** Upgrade levels: `levels[i]` is the value after buying level i (level 0 = start); `need` = farm level per step. */
export const UPGRADES = {
  field: {
    name: 'Ampliar plantação', icon: 'upgrade_field',
    desc: 'Aumenta a área de plantio.',
    levels: [6, 8, 10, 12], costs: [0, 400, 1000, 2000], need: [1, 1, 3, 5],
    describe: (v) => `${v} x ${v} canteiros`,
  },
  can: {
    name: 'Regador grande', icon: 'upgrade_can',
    desc: 'O regador passa a molhar uma área 3 x 3.',
    levels: [1, 3], costs: [0, 650], need: [1, 3],
    describe: (v) => (v === 1 ? '1 canteiro' : '3 x 3 canteiros'),
  },
  coop: {
    name: 'Ampliar galinheiro', icon: 'upgrade_coop',
    desc: 'Mais espaço para galinhas e patas.',
    levels: [4, 8, 12], costs: [0, 900, 2200], need: [1, 2, 6],
    describe: (v) => `${v} aves`,
  },
  barn: {
    name: 'Ampliar celeiro', icon: 'upgrade_barn',
    desc: 'Mais espaço para vacas, ovelhas, cabras e porcos.',
    levels: [3, 6, 10], costs: [0, 1500, 3200], need: [1, 3, 7],
    describe: (v) => `${v} animais`,
  },
  orchard: {
    name: 'Pomar', icon: 'upgrade_orchard',
    desc: 'Planta mais árvores frutíferas (a terceira etapa traz mangueiras).',
    levels: [2, 4, 6], costs: [0, 1200, 2600], need: [1, 2, 8],
    describe: (v) => `${v} árvores`,
  },
  irrigation: {
    name: 'Irrigação automática', icon: 'upgrade_irrigation',
    desc: 'Canos do poço regam todos os canteiros toda manhã.',
    levels: [0, 1], costs: [0, 3500], need: [1, 7],
    describe: (v) => (v ? 'ligada' : 'desligada'),
  },
};

export const SHOP_TABS = [
  { id: 'seeds', name: 'Sementes', items: Object.keys(ITEMS).filter((id) => ITEMS[id].kind === 'seed') },
  { id: 'animals', name: 'Animais', items: Object.keys(ANIMALS) },
  { id: 'machines', name: 'Oficina', items: Object.keys(MACHINES) },
  { id: 'upgrades', name: 'Melhorias', items: Object.keys(UPGRADES) },
];

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ---------------------------------------------------------------------------
// experience and levels
// ---------------------------------------------------------------------------

/** XP needed to go from `level` to `level + 1` (the level never stops growing). */
export function xpToNext(level) {
  return 50 + level * 60 + level * level * 12;
}

/** XP for harvesting one unit of a product. */
export function harvestXp(itemId) {
  return Math.max(1, Math.ceil(ITEMS[itemId].sell / 14));
}

// ---------------------------------------------------------------------------
// story: chapters of "A Jornada do Sol" (then the farm goes on forever)
// ---------------------------------------------------------------------------

/**
 * Task forms:
 *   { stat, n }   counter that grows from the moment the chapter starts
 *   { state, n }  current value of the farm (level, animals, species, earned)
 */
export const CHAPTERS = [
  {
    id: 'terra', title: 'Terra boa', summary: 'Prepare a terra, plante, colha e venda a primeira colheita.',
    tasks: [
      { stat: 'till', n: 6, label: 'Arar 6 canteiros' },
      { stat: 'plant', n: 6, label: 'Plantar 6 sementes' },
      { stat: 'harvest', n: 6, label: 'Colher 6 vegetais' },
      { stat: 'sell', n: 5, label: 'Vender 5 produtos na caixa' },
    ],
    reward: { money: 200, letter: 'terra_boa' },
  },
  {
    id: 'bichos', title: 'Bicho de casa', summary: 'Cuide dos animais e aumente a criação.',
    tasks: [
      { stat: 'collect', n: 4, label: 'Coletar 4 produtos dos animais' },
      { stat: 'pet', n: 3, label: 'Fazer carinho em 3 animais' },
      { stat: 'buy_animal', n: 1, label: 'Comprar um animal no mercadinho' },
    ],
    reward: { rod: true, letter: 'bichos' },
  },
  {
    id: 'lago', title: 'Beira do lago', summary: 'Pesque com a vara de bambu do seu avô.',
    tasks: [
      { stat: 'fish', n: 5, label: 'Pescar 5 peixes' },
      { state: 'species', n: 3, label: 'Pescar 3 espécies diferentes' },
    ],
    reward: { money: 300, orders: true, letter: 'lago' },
  },
  {
    id: 'vila', title: 'A vila tem fome', summary: 'Atenda as encomendas pregadas no mural.',
    tasks: [
      { stat: 'orders', n: 3, label: 'Entregar 3 pedidos do mural' },
      { state: 'level', n: 4, label: 'Chegar ao nível 4' },
    ],
    reward: { machine: 'cheese_press', letter: 'vila' },
  },
  {
    id: 'maos', title: 'Mãos na massa', summary: 'Transforme a colheita em produtos do galpão.',
    tasks: [
      { stat: 'artisan', n: 6, label: 'Fazer 6 produtos no galpão' },
      { state: 'animals', n: 8, label: 'Ter 8 animais no sítio' },
    ],
    reward: { items: { seed_sunflower: 10 }, letter: 'maos' },
  },
  {
    id: 'girassois', title: 'Mar de girassóis', summary: 'Devolva os girassóis ao Sítio do Sol.',
    tasks: [
      { stat: 'harvest_sunflower', n: 12, label: 'Colher 12 girassóis' },
      { stat: 'orders', n: 6, label: 'Entregar mais 6 pedidos' },
    ],
    reward: { money: 1000, letter: 'girassois' },
  },
  {
    id: 'festa', title: 'A Festa do Sol', summary: 'Encontre o Dourado e faça o ipê florir de novo.',
    tasks: [
      { stat: 'fish_dourado', n: 1, label: 'Pescar o Dourado (manhã de chuva)' },
      { state: 'earned', n: 25000, label: 'Ganhar R$ 25.000 no total' },
    ],
    reward: { bloom: true, letter: 'festa' },
  },
];

// ---------------------------------------------------------------------------
// milestones: endless goals with growing targets (each tier gives a prize)
// ---------------------------------------------------------------------------

export const MILESTONES = [
  { id: 'harvest', stat: 'harvest', name: 'Colheitas', icon: 'basket', base: 20 },
  { id: 'collect', stat: 'collect', name: 'Produtos dos animais', icon: 'egg', base: 10 },
  { id: 'pet', stat: 'pet', name: 'Carinhos nos animais', icon: 'heart', base: 10 },
  { id: 'fish', stat: 'fish', name: 'Peixes pescados', icon: 'fish_tilapia', base: 5 },
  { id: 'orders', stat: 'orders', name: 'Pedidos entregues', icon: 'order_board', base: 3 },
  { id: 'artisan', stat: 'artisan', name: 'Produtos do galpão', icon: 'cheese', base: 5 },
  { id: 'sell', stat: 'sell', name: 'Produtos vendidos', icon: 'coin', base: 30 },
];

const MILESTONE_STEPS = [1, 3, 6, 12, 25, 50, 100];

/** Target of a milestone tier (0 = first). After the table it keeps doubling forever. */
export function milestoneTarget(milestone, tier) {
  const last = MILESTONE_STEPS.length - 1;
  const k = tier <= last ? MILESTONE_STEPS[tier] : MILESTONE_STEPS[last] * 2 ** (tier - last);
  return milestone.base * k;
}

// ---------------------------------------------------------------------------
// letters from Vó and the notes found in bottles in the lake
// ---------------------------------------------------------------------------

export const LETTERS = {
  boas_vindas: {
    title: 'Uma carta da Vó',
    body: [
      'Meu bem,',
      'Se você está lendo esta carta, é porque chegou ao Sítio do Sol. Faz cinquenta anos que seu avô e eu cavamos aquele lago com as próprias mãos, plantamos o primeiro canteiro de cenoura e levantamos a casa de madeira azul.',
      'Desde que seu avô se foi, a terra ficou quieta demais. Minhas costas já não aguentam a enxada, e o sítio precisa de alguém com vontade de recomeçar. Escolhi você.',
      'Comece devagar: prepare a terra com a enxada, plante as sementes que deixei na mochila e regue todos os dias. A caixa de madeira ao lado da plantação vende tudo para o comprador da vila.',
      'Vou mandar notícias pela caixa de correio, ao lado da casa.',
    ],
    sign: 'Com carinho, Vó',
  },
  terra_boa: {
    title: 'Terra que dá fruto',
    body: [
      'Meu bem,',
      'A notícia correu a Vila do Sol: tem fumaça saindo da chaminé do sítio de novo! Seu avô dizia que terra boa é terra conversada: todo dia um pouco de água, um pouco de cuidado.',
      'As galinhas e a vaca que ficaram aí sentem falta de carinho. Bicho feliz produz mais rápido, pode acreditar. Faça um afago neles toda manhã e veja a diferença.',
      'Quando puder, aumente a criação. O mercadinho vende filhotes saudáveis.',
    ],
    sign: 'Com carinho, Vó',
  },
  bichos: {
    title: 'A vara de bambu',
    body: [
      'Meu bem,',
      'Junto desta carta vai a velha vara de pesca do seu avô. Ele mesmo cortou o bambu na beira do córrego.',
      'O lago do sítio tem lambaris, tilápias e traíras, e dizem que lá no fundo mora o Dourado, um peixe cor de sol que quase ninguém viu. Seu avô jurava que o viu na manhã em que choveu pela primeira vez depois da grande seca, no ano em que plantamos o ipê.',
      'Para pescar, escolha a vara, mire na água e espere. Quando a boia afundar, puxe na hora certa!',
    ],
    sign: 'Com carinho, Vó',
  },
  lago: {
    title: 'A vila lembra de vocês',
    body: [
      'Meu bem,',
      'A Prefeita da Vila do Sol me telefonou. Disse que a padaria, a doceria e até a escola querem voltar a comprar do Sítio do Sol, como nos velhos tempos.',
      'Pedi para pregarem os pedidos no mural de madeira, na beira da estrada principal. Uma encomenda paga melhor do que a caixa, e a vila vai conhecendo o seu trabalho.',
      'Quanto mais o sítio ficar conhecido, mais sementes, bichos e ferramentas o mercadinho vai oferecer.',
    ],
    sign: 'Com carinho, Vó',
  },
  vila: {
    title: 'O galpão do seu avô',
    body: [
      'Meu bem,',
      'No galpão ao sul do curral ficaram as máquinas do seu avô: a prensa de queijo, o tacho de cobre, o tear e o forno de barro. Pedi ao marceneiro da vila para consertar a prensa, e ela já está esperando por você.',
      'Leite vira queijo, fruta vira doce, lã vira tecido. Coisa feita com as mãos vale muito mais na vila!',
      'As outras máquinas aparecem na oficina do mercadinho conforme o sítio cresce.',
    ],
    sign: 'Com carinho, Vó',
  },
  maos: {
    title: 'Por que Sítio do Sol',
    body: [
      'Meu bem,',
      'Você já me perguntou por que o sítio tem esse nome. Quando chegamos ao vale, não havia nada além de capim seco. Seu avô plantou um campo inteiro de girassóis, e de manhã cedo eles viravam todos para o mesmo lado, como se cumprimentassem o sol.',
      'Mandei um saquinho de sementes de girassol, iguais às daquele primeiro campo. As abelhas adoram, e a vila sempre comprou nossas flores para a Festa do Sol.',
    ],
    sign: 'Com carinho, Vó',
  },
  girassois: {
    title: 'A lenda do ipê',
    body: [
      'Meu bem,',
      'Os girassóis voltaram e a vila inteira está falando nisso. Agora preciso te contar a história do ipê da beira do lago.',
      'Seu avô o plantou no dia em que a seca acabou. Todo inverno ele se cobria de flores amarelas, e debaixo dele a vila fazia a Festa do Sol, com sanfona, quentão e o sítio inteiro enfeitado.',
      'Depois que seu avô se foi, o ipê nunca mais floriu. O pescador velho do vale diz que ele espera o Dourado voltar a ser visto. E o Dourado só sobe nas manhãs de chuva, antes das dez horas.',
      'Se alguém pode trazer a festa de volta, é você.',
    ],
    sign: 'Com carinho, Vó',
  },
  festa: {
    title: 'A Festa do Sol',
    body: [
      'Meu bem,',
      'A Prefeita me mandou um retrato: o ipê do lago coberto de flores amarelas e a vila inteira dançando embaixo dele. Chorei de alegria, igual ao dia em que seu avô o plantou.',
      'O Sítio do Sol está vivo de novo, graças a você. De agora em diante, todo domingo é dia de festa na vila, e os produtos do sítio valem mais.',
      'Um sítio não tem fim, meu bem: sempre haverá uma semente para plantar, um pedido para entregar e um peixe novo no lago. Cuide dele como nós cuidamos.',
    ],
    sign: 'Com todo o meu amor, Vó',
  },

  // notes the grandfather threw into the lake in bottles (found while fishing)
  garrafa_1: {
    title: 'Bilhete na garrafa (1/6)', bottle: true,
    body: ['Terminamos de cavar o lago hoje. Choveu à tarde e a água foi subindo devagarinho, e ela riu de mim, todo enlameado.', 'Jogo esta garrafa para pedir que este lago nunca seque.'],
    sign: '— o avô',
  },
  garrafa_2: {
    title: 'Bilhete na garrafa (2/6)', bottle: true,
    body: ['Colhemos a primeira cenoura do sítio. Era torta e pequena, e foi a coisa mais gostosa que já comi.', 'Quem achar este bilhete: comemore as colheitas pequenas.'],
    sign: '— o avô',
  },
  garrafa_3: {
    title: 'Bilhete na garrafa (3/6)', bottle: true,
    body: ['Vi um brilho cor de sol debaixo da água, logo cedo, com a chuva fina caindo. Não era reflexo: era um peixe enorme e dourado.', 'Ninguém na vila acredita em mim. Eu sei o que vi.'],
    sign: '— o avô',
  },
  garrafa_4: {
    title: 'Bilhete na garrafa (4/6)', bottle: true,
    body: ['Plantei uma muda de ipê-amarelo na beira do lago, no lugar onde vi o Dourado.', 'Que ele floresça todo inverno e chame a vila para festejar.'],
    sign: '— o avô',
  },
  garrafa_5: {
    title: 'Bilhete na garrafa (5/6)', bottle: true,
    body: ['Primeira Festa do Sol debaixo do ipê. A vila trouxe sanfona, a padaria trouxe bolo de milho e as crianças correram entre os girassóis.', 'Quero que seja assim para sempre.'],
    sign: '— o avô',
  },
  garrafa_6: {
    title: 'Bilhete na garrafa (6/6)', bottle: true,
    body: ['Se você achou todas as garrafas, é porque gosta deste lago tanto quanto eu.', 'Cuide da terra, dos bichos e da vila. E quando o ipê florir, lembre de mim.'],
    sign: '— o avô',
  },
};

export const BOTTLE_LETTERS = Object.keys(LETTERS).filter((id) => LETTERS[id].bottle);

// ---------------------------------------------------------------------------
// village orders (mural)
// ---------------------------------------------------------------------------

/** Who orders what: categories or explicit items they prefer. */
export const REQUESTERS = [
  { name: 'Padaria da Vila', likes: ['egg', 'duck_egg', 'milk', 'corn', 'corn_cake', 'honey', 'potato', 'cheese'] },
  { name: 'Mercearia do Largo', cats: ['crop'] },
  { name: 'Restaurante da Praça', cats: ['fish', 'crop'], likes: ['cheese', 'goat_cheese', 'truffle'] },
  { name: 'Doceria Flor do Ipê', cats: ['fruit'], likes: ['strawberry', 'jam_apple', 'jam_orange', 'jam_strawberry', 'jam_mango', 'pumpkin_sweet', 'honey', 'pumpkin'] },
  { name: 'Escola da Vila', likes: ['apple', 'orange', 'mango', 'lettuce', 'carrot', 'milk', 'tomato', 'watermelon'] },
  { name: 'Pousada do Vale', likes: ['cheese', 'goat_cheese', 'honey', 'jam_strawberry', 'egg', 'cloth', 'tapioca', 'sunflower'] },
  { name: 'Peixaria do Porto', cats: ['fish'] },
  { name: 'Ateliê de Costura', likes: ['wool', 'cloth', 'sunflower'] },
  { name: 'Quermesse da Capela', likes: ['corn', 'corn_cake', 'tapioca', 'pumpkin_sweet', 'cassava', 'sunflower', 'watermelon'] },
];

export const ORDER_SLOTS = 3;

// ---------------------------------------------------------------------------
// HUD icons: rendered from the 3D models into a texture atlas at start-up.
// Each icon lists model parts with an optional local transform.
// ---------------------------------------------------------------------------

const seedIcon = (model, extra = {}) => [{ model: 'seed_bag' }, { model, scale: 0.5, offset: [0.13, -0.1, 0.18], ...extra }];

export const ICONS = {
  hoe: [{ model: 'hoe', rotZ: 20 }],
  watering_can: [{ model: 'watering_can', rotY: -60 }],
  basket: [{ model: 'basket' }],
  fishing_rod: [{ model: 'fishing_rod', rotZ: -40 }],
  coin: [{ model: 'coin', rotY: -25 }],
  carrot: [{ model: 'carrot_item', rotZ: -40 }],
  tomato: [{ model: 'tomato_item' }],
  corn: [{ model: 'corn_item', rotZ: -35 }],
  pumpkin: [{ model: 'pumpkin_item' }],
  lettuce: [{ model: 'lettuce_item' }],
  potato: [{ model: 'potato_item' }],
  strawberry: [{ model: 'strawberry_item' }],
  sunflower: [{ model: 'sunflower_item', rotY: -20 }],
  cassava: [{ model: 'cassava_item', rotZ: 25 }],
  watermelon: [{ model: 'watermelon_item' }],
  apple: [{ model: 'apple_item' }],
  orange: [{ model: 'orange_item' }],
  mango: [{ model: 'mango_item' }],
  egg: [{ model: 'egg', rotZ: -15 }],
  duck_egg: [{ model: 'duck_egg', rotZ: -15 }],
  milk: [{ model: 'milk' }],
  goat_milk: [{ model: 'goat_milk' }],
  wool: [{ model: 'wool' }],
  truffle: [{ model: 'truffle' }],
  honey: [{ model: 'honey' }],
  fish_lambari: [{ model: 'fish_lambari', rotZ: 20 }],
  fish_tilapia: [{ model: 'fish_tilapia', rotZ: 20 }],
  fish_traira: [{ model: 'fish_traira', rotZ: 20 }],
  fish_carpa: [{ model: 'fish_carpa', rotZ: 20 }],
  fish_tucunare: [{ model: 'fish_tucunare', rotZ: 20 }],
  fish_pintado: [{ model: 'fish_pintado', rotZ: 20 }],
  fish_dourado: [{ model: 'fish_dourado', rotZ: 20 }],
  old_boot: [{ model: 'old_boot', rotY: -40 }],
  message_bottle: [{ model: 'message_bottle', rotZ: -30 }],
  cheese: [{ model: 'cheese_wheel' }],
  goat_cheese: [{ model: 'goat_cheese', rotY: -20 }],
  jam_apple: [{ model: 'jam_apple' }],
  jam_orange: [{ model: 'jam_orange' }],
  jam_strawberry: [{ model: 'jam_strawberry' }],
  jam_mango: [{ model: 'jam_mango' }],
  pumpkin_sweet: [{ model: 'pumpkin_sweet' }, { model: 'pumpkin_item', scale: 0.45, offset: [0.16, -0.12, 0.2] }],
  cloth: [{ model: 'cloth_roll' }],
  corn_cake: [{ model: 'corn_cake' }],
  tapioca: [{ model: 'tapioca', rotY: 20 }],
  seed_lettuce: seedIcon('lettuce_item'),
  seed_carrot: seedIcon('carrot_item', { rotZ: -40, offset: [0.13, -0.08, 0.18] }),
  seed_tomato: seedIcon('tomato_item'),
  seed_potato: seedIcon('potato_item'),
  seed_corn: seedIcon('corn_item', { rotZ: -35, offset: [0.13, -0.08, 0.18] }),
  seed_strawberry: seedIcon('strawberry_item'),
  seed_pumpkin: seedIcon('pumpkin_item'),
  seed_sunflower: seedIcon('sunflower_item'),
  seed_cassava: seedIcon('cassava_item', { rotZ: 25 }),
  seed_watermelon: seedIcon('watermelon_item'),
  chicken: [{ model: 'chicken', rotY: 35 }],
  cow: [{ model: 'cow', rotY: 50 }],
  sheep: [{ model: 'sheep', rotY: 50 }],
  duck: [{ model: 'duck', rotY: 35 }],
  goat: [{ model: 'goat', rotY: 50 }],
  pig: [{ model: 'pig', rotY: 50 }],
  cheese_press: [{ model: 'cheese_press', rotY: 20 }],
  jam_pot: [{ model: 'jam_pot', rotY: 20 }],
  loom: [{ model: 'loom', rotY: 20 }],
  oven: [{ model: 'oven', rotY: 20 }],
  beehive: [{ model: 'beehive', rotY: 20 }],
  upgrade_field: [{ model: 'soil_tile' }, { model: 'carrot_4', scale: 0.9 }],
  upgrade_can: [{ model: 'watering_can', rotY: -60 }, { model: 'upgrade_icon', scale: 0.55, offset: [0.22, 0.18, 0.2] }],
  upgrade_coop: [{ model: 'coop', rotY: 20 }],
  upgrade_barn: [{ model: 'barn', rotY: 20 }],
  upgrade_orchard: [{ model: 'fruit_tree' }],
  upgrade_irrigation: [{ model: 'well', rotY: 20 }, { model: 'upgrade_icon', scale: 0.7, offset: [0.6, 0.9, 0.5] }],
  sapling: [{ model: 'sapling' }],
  house: [{ model: 'house', rotY: 20 }],
  heart: [{ model: 'heart' }],
  star: [{ model: 'star' }],
  check: [{ model: 'check' }],
  lock: [{ model: 'lock' }],
  letter: [{ model: 'letter', rotY: -15 }],
  journal: [{ model: 'journal', rotY: -25 }],
  order_board: [{ model: 'order_board', rotY: 15 }],
  sun_icon: [{ model: 'sun_icon' }],
  cloud_icon: [{ model: 'cloud_icon' }],
  rain_icon: [{ model: 'rain_icon' }],
  ipe: [{ model: 'ipe_bloom' }],
};
