import { MAP_SIZE, TILE, ZONE_W, ZONE_H, SEED } from './constants';
import { rng } from './random';
import { isPassable } from './terrain';

// === Pièces ===
// Découpe la map en zones et place 1-2 pièces par zone, sur cellule passable.
export function generateCoins(grid, seed = SEED) {
  const coins = [];
  const cols = Math.ceil(MAP_SIZE / ZONE_W);
  const rows = Math.ceil(MAP_SIZE / ZONE_H);
  let id = 0;

  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      const r = rng(seed + (cx * 73856093 ^ cy * 19349663));
      const count = 1 + Math.floor(r() * 2);
      for (let i = 0; i < count; i++) {
        for (let tries = 0; tries < 8; tries++) {
          const x = cx * ZONE_W + 30 + r() * (ZONE_W - 60);
          const y = cy * ZONE_H + 30 + r() * (ZONE_H - 60);
          if (isPassable(grid, Math.floor(x / TILE), Math.floor(y / TILE))) {
            coins.push({ id: id++, x, y });
            break;
          }
        }
      }
    }
  }
  return coins;
}

// === Coffres ===
// 12 coffres espacés (>=600px), sur cellule passable, récompense 5-20 pièces.
export function generateChests(grid, seed = SEED) {
  const chests = [];
  const r = rng(seed + 4242);
  const COUNT = 12;
  const MIN_DIST = 600;

  let placed = 0, tries = 0;
  while (placed < COUNT && tries++ < 500) {
    const x = Math.floor(r() * MAP_SIZE);
    const y = Math.floor(r() * MAP_SIZE);
    if (!isPassable(grid, Math.floor(x / TILE), Math.floor(y / TILE))) continue;
    if (chests.some((c) => Math.hypot(c.x - x, c.y - y) < MIN_DIST)) continue;
    chests.push({ id: placed, x, y, reward: 5 + Math.floor(r() * 15) });
    placed++;
  }
  return chests;
}

// === POI nommés ===
const POI_NAMES = {
  village: ['Brindebourg', 'Murmenois', 'Fontclaire', 'Valombre', 'Pierreloup', 'Saulebec', 'Marcheval'],
  ruin: ["Ruines d'Aldoran", 'Cité Oubliée', 'Tour des Échos', 'Sanctuaire Brisé', 'Cromlech Noir'],
  shrine: ['Autel de la Lune', 'Pierre Sacrée', "Bosquet d'Aelis"],
};

const POI_TYPES = [
  { type: 'village', count: 5 },
  { type: 'ruin', count: 3 },
  { type: 'shrine', count: 2 },
];

export function generatePOIs(grid, seed = SEED) {
  const pois = [];
  const r = rng(seed + 7777);
  const MIN_DIST = 700;
  let id = 0;

  for (const { type, count } of POI_TYPES) {
    const namesPool = [...POI_NAMES[type]];
    let placed = 0, tries = 0;
    while (placed < count && tries++ < 500) {
      const x = Math.floor(r() * MAP_SIZE);
      const y = Math.floor(r() * MAP_SIZE);
      if (!isPassable(grid, Math.floor(x / TILE), Math.floor(y / TILE))) continue;
      if (pois.some((p) => Math.hypot(p.x - x, p.y - y) < MIN_DIST)) continue;

      const nameIdx = Math.floor(r() * namesPool.length);
      const name = namesPool.splice(nameIdx, 1)[0] || `${type} ${id}`;
      pois.push({ id: id++, type, x, y, name });
      placed++;
    }
  }
  return pois;
}
