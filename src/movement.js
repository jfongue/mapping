// Calculs de mouvement purs (testables, indépendants de React).
import { SPEED_PX_PER_SEC, MIN_DURATION_MS, MAX_DURATION_MS } from './constants';
import { TILE_PX } from './tilemap';

// Calcule la durée d'un déplacement entre 2 points.
// sillonSpeedMul : multiplicateur issu des sillons (1.0 = normal, 3.0 = pavé rapide)
// speedMul ∈ [1..100] : boost debug
export function movementDuration(from, to, speedMul = 1, sillonSpeedMul = 1) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const effectiveSpeed = SPEED_PX_PER_SEC * sillonSpeedMul;
  let dur = (dist / effectiveSpeed) * 1000;
  dur = Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, dur));
  return { dist, durationMs: dur / Math.max(1, speedMul), baseDurationMs: dur };
}

// Calcule le multiplicateur de vitesse moyen d'un path (liste de points px).
// sillons = objet { 'cx,cy': {count} }, tiles = TILES_DATA, W = MAP_W
export function avgSillonSpeedMul(pathPoints, sillons, tiles, W) {
  if (!pathPoints || pathPoints.length === 0 || !sillons) return 1;
  let total = 0;
  for (const p of pathPoints) {
    const cx = Math.floor(p.x / TILE_PX);
    const cy = Math.floor(p.y / TILE_PX);
    const key = `${cx},${cy}`;
    const count = sillons[key]?.count ?? 0;
    const tileType = tiles[cy * W + cx] ?? 2;
    // Eau sans pont
    if (tileType === 0) {
      if (count < 10)  total += 0.10;
      else if (count < 40)  total += 0.40;
      else if (count < 100) total += 0.70;
      else total += 1.00;
    } else {
      if (count < 5)   total += 1.00;
      else if (count < 20)  total += 1.15;
      else if (count < 60)  total += 1.50;
      else if (count < 150) total += 2.00;
      else total += 3.00;
    }
  }
  return total / pathPoints.length;
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
