// Logique pure des sillons — sans React, testable Jest.
// Un sillon = une cellule (cx, cy) avec un compteur de passages.
// Stockage : objet plat { 'cx,cy': { count, lastUsed } }

import { MAP_W, MAP_H, TILES, WALKABLE } from './tilemap';

// Seuils de passages pour chaque niveau de sillon
export const SILLON_LEVELS = [
  { min: 0,   label: 'vierge',  speedMul: 1.00, color: null },
  { min: 5,   label: 'sentier', speedMul: 1.15, color: '#c8a96e' },
  { min: 20,  label: 'chemin',  speedMul: 1.50, color: '#b08040' },
  { min: 60,  label: 'route',   speedMul: 2.00, color: '#9a7030' },
  { min: 150, label: 'pavé',    speedMul: 3.00, color: '#888070' },
];

// Seuils pour les ponts sur l'eau
export const BRIDGE_LEVELS = [
  { min: 0,   label: 'eau',             speedMul: 0.10, color: '#bce0e8' },
  { min: 10,  label: 'pont-suspendu',   speedMul: 0.40, color: '#d4a070' },
  { min: 40,  label: 'pont-bois',       speedMul: 0.70, color: '#b08050' },
  { min: 100, label: 'pont-pierre',     speedMul: 1.00, color: '#909090' },
];

// Durée sans passage avant début d'érosion (7 jours en ms)
export const EROSION_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
// Décrement par tick d'érosion
export const EROSION_TICK_DEC = 1;

// Clé de stockage
export const sillonKey = (cx, cy) => `${cx},${cy}`;

// Retourne le niveau actuel d'une cellule selon son compteur et son type terrain
export function getSillonLevel(count, tileType) {
  const levels = tileType === TILES.WATER ? BRIDGE_LEVELS : SILLON_LEVELS;
  let level = levels[0];
  for (const l of levels) {
    if (count >= l.min) level = l;
  }
  return level;
}

// Calcule le multiplicateur de vitesse pour une cellule
export function getSpeedMul(sillons, cx, cy, tileType) {
  const key = sillonKey(cx, cy);
  const count = sillons[key]?.count ?? 0;
  return getSillonLevel(count, tileType).speedMul;
}

// Incrémente une liste de cellules (path = [{x, y}] en coords cellule)
// Retourne le nouvel état sillons (immutable)
export function incrementPath(sillons, path, now = Date.now()) {
  const next = { ...sillons };
  for (const { x, y } of path) {
    const key = sillonKey(x, y);
    const prev = next[key] ?? { count: 0, lastUsed: now };
    next[key] = { count: Math.min(prev.count + 1, 65535), lastUsed: now };
  }
  return next;
}

// Tick d'érosion — décrémente les cellules non utilisées depuis EROSION_DELAY_MS
// Retourne { next, changed: boolean }
export function erosionTick(sillons, now = Date.now()) {
  let changed = false;
  const next = {};
  for (const [key, cell] of Object.entries(sillons)) {
    if (cell.count <= 0) continue; // Ne pas conserver les cells à 0
    if (now - cell.lastUsed > EROSION_DELAY_MS) {
      changed = true;
      const newCount = cell.count - EROSION_TICK_DEC;
      if (newCount > 0) next[key] = { count: newCount, lastUsed: cell.lastUsed };
      // Si newCount === 0 → on supprime la clé (herbe repoussée)
    } else {
      next[key] = cell;
    }
  }
  return { next, changed };
}

// Calcule le coût A* d'une cellule en tenant compte des sillons
// cost = stepDist * walkCost / speedMul (sillon rapide = coût réduit)
export function sillonWalkCost(sillons, cx, cy, tileType, baseCost, stepDist) {
  const speedMul = getSpeedMul(sillons, cx, cy, tileType);
  return stepDist * (baseCost / speedMul);
}

// Debug : statistiques rapides
export function sillonStats(sillons) {
  const entries = Object.values(sillons);
  if (!entries.length) return { total: 0, maxCount: 0, avgCount: 0, byLevel: {} };
  const maxCount = Math.max(...entries.map(e => e.count));
  const avgCount = entries.reduce((s, e) => s + e.count, 0) / entries.length;
  const byLevel = {};
  for (const l of SILLON_LEVELS) byLevel[l.label] = 0;
  for (const e of entries) {
    const l = getSillonLevel(e.count, TILES.PLAIN);
    byLevel[l.label] = (byLevel[l.label] ?? 0) + 1;
  }
  return { total: entries.length, maxCount, avgCount: avgCount.toFixed(1), byLevel };
}
