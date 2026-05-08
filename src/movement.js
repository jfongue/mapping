// Calculs de mouvement purs (testables, indépendants de React).
import { SPEED_PX_PER_SEC, MIN_DURATION_MS, MAX_DURATION_MS } from './constants';
import { TILE_PX } from './tilemap';

// Calcule la durée d'un déplacement pour un chemin donné en tenant compte des coûts terrain.
// weightedCost : résultat de pathWeightedCost (distance pondérée en cellules)
// Si weightedCost absent, fallback sur distance euclidienne (comportement legacy).
//   speedMul ∈ [1..30] divise la durée (mode debug).
export function movementDuration(from, to, speedMul = 1, weightedCost = null) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  let effectiveDist;
  if (weightedCost !== null && weightedCost > 0) {
    // Convertit le coût pondéré (en cellules) en pixels équivalents
    const rawCells = dist / TILE_PX;
    const costRatio = weightedCost / rawCells;
    effectiveDist = dist * costRatio;
  } else {
    effectiveDist = dist;
  }
  let dur = (effectiveDist / SPEED_PX_PER_SEC) * 1000;
  dur = Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, dur));
  return { dist, durationMs: dur / Math.max(1, speedMul), baseDurationMs: dur };
}

// Position interpolée à un instant t entre from et to selon target Firebase.
export function lerpFromTarget(target, now = Date.now()) {
  if (!target || typeof target.startTs !== 'number' || typeof target.durationMs !== 'number') {
    return null;
  }
  const t = Math.max(0, Math.min(1, (now - target.startTs) / target.durationMs));
  return {
    x: target.fromX + (target.toX - target.fromX) * t,
    y: target.fromY + (target.toY - target.fromY) * t,
    progress: t,
  };
}

// Reste à parcourir (en ms) à la nouvelle vitesse, depuis la pos courante vers la cible.
export function remainingDurationAt(target, curX, curY, speedMul) {
  if (!target) return 0;
  const remainingDist = Math.hypot(target.toX - curX, target.toY - curY);
  const totalDist = (target.durationMs / 1000) * SPEED_PX_PER_SEC;
  if (totalDist <= 0) return 0;
  const baseRemaining = (remainingDist / totalDist) * target.durationMs;
  return baseRemaining / Math.max(1, speedMul);
}
