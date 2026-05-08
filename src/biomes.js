// Biomes — source de vérité pour couleurs sol, végétation et densité.
// Chaque biome définit :
//   ground    : { base, shadow, accent }  — couleurs du sol
//   detail    : identifiant du micro-détail SVG (rendu dans TileLayer)
//   vegetation: tableau de types de végétaux (rendus dans VegetationLayer)
//   vegDensity: 0–1, probabilité de spawner un végétal par cellule

export const BIOMES = {
  plains: {
    ground:     { base: '#8DB87A', shadow: '#6A9B5E', accent: '#A8CC8F' },
    detail:     'furrows',
    vegetation: ['bush', 'flower'],
    vegDensity: 0.3,
  },
  forest: {
    ground:     { base: '#3D5C3A', shadow: '#2A4228', accent: '#4A6E47' },
    detail:     'moss',
    vegetation: ['tree', 'shrub'],
    vegDensity: 0.7,
  },
  desert: {
    ground:     { base: '#C4A96B', shadow: '#A8894E', accent: '#D4BF8A' },
    detail:     'dunes',
    vegetation: ['cactus', 'deadwood'],
    vegDensity: 0.1,
  },
  marsh: {
    ground:     { base: '#5C7A52', shadow: '#3D5C3A', accent: '#7A9B6E' },
    detail:     'reeds',
    vegetation: ['reed', 'lily'],
    vegDensity: 0.5,
  },
  jungle: {
    ground:     { base: '#2A5C2A', shadow: '#1A3D1A', accent: '#3D7A3D' },
    detail:     'roots',
    vegetation: ['palm', 'fern', 'vine'],
    vegDensity: 0.9,
  },
  tundra: {
    ground:     { base: '#B8D4E8', shadow: '#8AAEC4', accent: '#D4EAF5' },
    detail:     'frost',
    vegetation: ['shrub'],
    vegDensity: 0.15,
  },
};

// Seed dédiée biomes — indépendante du terrain et des POI
export const BIOME_SEED = 0xB10E50;

// Seuils de la noise pour assigner un biome (valeur ∈ [0,1))
// Modifie ces valeurs pour ajuster la répartition sur la map
const BIOME_THRESHOLDS = [
  { max: 0.20, name: 'tundra'  },
  { max: 0.38, name: 'marsh'   },
  { max: 0.55, name: 'plains'  },
  { max: 0.72, name: 'forest'  },
  { max: 0.87, name: 'jungle'  },
  { max: 1.00, name: 'desert'  },
];

// Retourne le nom du biome pour une cellule (cellX, cellY).
// Utilise valueNoise avec un zoom large (÷20) pour de grandes régions douces.
import { valueNoise } from './random';
const biomeNoise = valueNoise(BIOME_SEED);

export function getBiomeAt(cellX, cellY) {
  const n = biomeNoise(cellX / 20, cellY / 20);
  for (const t of BIOME_THRESHOLDS) {
    if (n < t.max) return t.name;
  }
  return 'plains'; // fallback
}

// Z-offsets par type d'élément — utilisés par le painter's sort
export const Z_OFFSET = {
  ground:    0,
  bush:     -8,
  flower:   -8,
  shrub:   -12,
  reed:    -12,
  lily:    -12,
  cactus:  -18,
  fern:    -18,
  building:-20,
  deadwood:-22,
  vine:    -28,
  tree:    -35,
  palm:    -35,
  mountain:-60,
};
