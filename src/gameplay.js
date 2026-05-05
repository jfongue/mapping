// NOTE: Logique de résolution d'arrivée extraite (pickupCoins, pickupChests, visitPOIs).
// Non importée dans App.js — logique dupliquée inline. Candidat à remplacer le code App.js.

// Logique de résolution d'arrivée — pure, testable.
import { TILE, COIN_PICKUP_RADIUS, CHEST_PICKUP_RADIUS, POI_VISIT_RADIUS } from './constants';
import { distPointToPolyline } from './geometry';

// Sépare les pièces ramassées le long du trajet des restantes.
export function pickupCoins(coins, samples, radius = COIN_PICKUP_RADIUS) {
  const picked = [];
  const remaining = [];
  for (const c of coins) {
    if (distPointToPolyline(c.x, c.y, samples) <= radius) picked.push(c);
    else remaining.push(c);
  }
  return { picked, remaining };
}

// Coffres ouverts à l'arrivée (proximité avec end).
export function pickupChests(chests, openedSet, end, radius = CHEST_PICKUP_RADIUS) {
  const opened = [];
  for (const c of chests) {
    if (openedSet.has(c.id)) continue;
    if (Math.hypot(c.x - end.x, c.y - end.y) <= radius) opened.push(c);
  }
  return opened;
}

// POI visités à l'arrivée.
export function visitPOIs(pois, visitedSet, end, radius = POI_VISIT_RADIUS) {
  const visited = [];
  for (const p of pois) {
    if (visitedSet.has(p.id)) continue;
    if (Math.hypot(p.x - end.x, p.y - end.y) <= radius) visited.push(p);
  }
  return visited;
}

// Cellules à révéler dans le brouillard de guerre (rayon REVEAL_R cells).
export function revealedCellsAlongPath(samples, revealRadius = 3) {
  const cells = new Set();
  const r2 = revealRadius * revealRadius;
  for (const s of samples) {
    const cx = Math.floor(s.x / TILE);
    const cy = Math.floor(s.y / TILE);
    for (let dy = -revealRadius; dy <= revealRadius; dy++) {
      for (let dx = -revealRadius; dx <= revealRadius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        cells.add(`${cx + dx},${cy + dy}`);
      }
    }
  }
  return cells;
}
