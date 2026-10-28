/**
 * Model manifest: every 3D model the game loads from an OBJ file.
 *
 * Fields
 *   file        path relative to MODEL_BASE
 *   scale       uniform number or [x, y, z]                    (optional, default 1)
 *   rotationY   degrees applied at load time                  (optional)
 *   offset      [x, y, z] translation applied at load time     (optional)
 *   wind        vertex-shader sway strength for plants          (optional)
 *   shadow      false to skip the shadow pass                   (optional)
 *   pivots      rotation pivots of named OBJ objects (parts) used by the animations
 *
 * To use third-party models (e.g. Quaternius CC0 packs), copy the OBJ/MTL
 * files into assets/models/ and point `file` at them, adjusting scale,
 * rotationY and offset so the model stands on y = 0, faces +Z and is about
 * one tile wide. Parts that do not exist in a model are simply not animated
 * individually (the whole model still bobs, turns and walks).
 */

export const MODEL_BASE = 'assets/models/';

const CROP_WIND = { carrot: 0.35, tomato: 0.14, corn: 0.06, pumpkin: 0.12 };

function cropStages(name) {
  const entries = {};
  for (let stage = 0; stage <= 4; stage++) {
    entries[`${name}_${stage}`] = { file: `${name}_${stage}.obj`, wind: stage >= 1 ? CROP_WIND[name] : 0 };
  }
  return entries;
}

export const MODELS = {
  // characters and animals (multi-part, animated)
  farmer: {
    file: 'farmer.obj',
    pivots: {
      leg_l: [-0.095, 0.52, 0], leg_r: [0.095, 0.52, 0],
      arm_l: [-0.26, 0.94, 0], arm_r: [0.26, 0.94, 0],
      head: [0, 0.97, 0],
    },
  },
  chicken: {
    file: 'chicken.obj',
    pivots: {
      head: [0, 0.34, 0.08], leg_l: [-0.05, 0.14, 0], leg_r: [0.05, 0.14, 0],
      wing_l: [-0.15, 0.31, 0], wing_r: [0.15, 0.31, 0],
    },
  },
  cow: {
    file: 'cow.obj',
    pivots: {
      head: [0, 0.88, 0.45], tail: [0, 0.97, -0.5],
      leg_fl: [-0.2, 0.55, 0.36], leg_fr: [0.2, 0.55, 0.36],
      leg_bl: [-0.2, 0.55, -0.36], leg_br: [0.2, 0.55, -0.36],
    },
  },
  sheep: {
    file: 'sheep.obj',
    pivots: {
      head: [0, 0.72, 0.36],
      leg_fl: [-0.14, 0.42, 0.24], leg_fr: [0.14, 0.42, 0.24],
      leg_bl: [-0.14, 0.42, -0.24], leg_br: [0.14, 0.42, -0.24],
    },
  },

  // crops: five growth stages each (0 = seeds ... 4 = ripe)
  ...cropStages('carrot'),
  ...cropStages('tomato'),
  ...cropStages('corn'),
  ...cropStages('pumpkin'),

  // trees and nature
  fruit_tree: { file: 'fruit_tree.obj', wind: 0.012 },
  tree_round: { file: 'tree_round.obj', wind: 0.008 },
  tree_round_b: { file: 'tree_round_b.obj', wind: 0.01 },
  tree_autumn: { file: 'tree_autumn.obj', wind: 0.009 },
  tree_pine: { file: 'tree_pine.obj', wind: 0.006 },
  apple: { file: 'apple.obj' },
  orange: { file: 'orange.obj' },
  bush: { file: 'bush.obj', wind: 0.05 },
  rock: { file: 'rock.obj' },
  rock_b: { file: 'rock_b.obj' },
  flower_pink: { file: 'flower_pink.obj', wind: 0.5, shadow: false },
  flower_blue: { file: 'flower_blue.obj', wind: 0.5, shadow: false },
  flower_yellow: { file: 'flower_yellow.obj', wind: 0.5, shadow: false },
  flower_white: { file: 'flower_white.obj', wind: 0.5, shadow: false },
  grass_tuft: { file: 'grass_tuft.obj', wind: 0.9, shadow: false },
  tall_grass: { file: 'tall_grass.obj', wind: 0.35 },
  hay_bale: { file: 'hay_bale.obj' },
  pond_water: { file: 'pond_water.obj', wave: 0.022, shadow: false },
  pond_bank: { file: 'pond_bank.obj', shadow: false },

  // buildings and props
  house: { file: 'house.obj' },
  barn: { file: 'barn.obj' },
  coop: { file: 'coop.obj' },
  shop: { file: 'shop.obj' },
  shipping_bin: { file: 'shipping_bin.obj', pivots: { lid: [0, 0.69, -0.4] } },
  fence: { file: 'fence.obj' },
  lamp_post: { file: 'lamp_post.obj' },
  windmill: { file: 'windmill.obj', pivots: { blades: [0, 3.6, 0.9] } },
  well: { file: 'well.obj' },
  scarecrow: { file: 'scarecrow.obj' },
  crate: { file: 'crate.obj' },
  barrel: { file: 'barrel.obj' },
  trough: { file: 'trough.obj' },
  soil_tile: { file: 'soil_tile.obj', shadow: false },
  tile_marker: { file: 'tile_marker.obj', shadow: false },
  ring_marker: { file: 'ring_marker.obj', shadow: false },

  // items (HUD icons and held tools)
  carrot_item: { file: 'carrot_item.obj' },
  tomato_item: { file: 'tomato_item.obj' },
  corn_item: { file: 'corn_item.obj' },
  pumpkin_item: { file: 'pumpkin_item.obj' },
  apple_item: { file: 'apple_item.obj' },
  orange_item: { file: 'orange_item.obj' },
  egg: { file: 'egg.obj' },
  milk: { file: 'milk.obj' },
  wool: { file: 'wool.obj' },
  seed_bag: { file: 'seed_bag.obj' },
  hoe: { file: 'hoe.obj' },
  watering_can: { file: 'watering_can.obj' },
  basket: { file: 'basket.obj' },
  coin: { file: 'coin.obj' },
  upgrade_icon: { file: 'upgrade_icon.obj' },
  sapling: { file: 'sapling.obj' },
};
