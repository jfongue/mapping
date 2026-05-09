// Calculs de mouvement purs (testables, indépendants de React).
import { SPEED_PX_PER_SEC, MIN_DURATION_MS, MAX_DURATION_MS } from './constants';
import { TILES_DATA, MAP_W, TILE_PX, WALK_COST } from './tilemap';

// Calcule la durée d'un déplacement le long d'un tableau de points (px)
// en tenant compte du coût terrain de chaque segment.
// samples : [{x, y}] en pixels
export function movementDurationAlongPath(samples) {
  if (!samples || samples.length < 2) return { dist: 0, durationMs: MIN_DURATION_MS, baseDurationMs: MIN_DURATION_MS };
  let dist = 0;
  let weightedDist = 0;
  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i].x - samples[i-1].x;
    const dy = samples[i].y - samples[i-1].y;
    const segLen = Math.hypot(dx, dy);
    dist += segLen;
    // Coût du terrain à mi-segment
    const mx = (samples[i].x + samples[i-1].x) / 2;
    const my = (samples[i].y + samples[i-1].y) / 2;
    const tx = Math.floor(mx / TILE_PX);
    const ty = Math.floor(my / TILE_PX);
    const tileType = TILES_DATA[ty * MAP_W + tx];
    const cost = WALK_COST[tileType] ?? 1;
    weightedDist += segLen * cost;
  }
  let dur = (weightedDist / SPEED_PX_PER_SEC) * 1000;
  dur = Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, dur));
  return { dist, durationMs: dur, baseDurationMs: dur };
}

// Fallback legacy (distance euclidienne simple, sans terrain)
export function movementDuration(from, to, speedMul = 1) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  let dur = (dist / SPEED_PX_PER_SEC) * 1000;
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
