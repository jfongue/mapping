// Calculs de mouvement purs (testables, indépendants de React).
import { SPEED_PX_PER_SEC, MIN_DURATION_MS, MAX_DURATION_MS } from './constants';

// Calcule la durée d'un déplacement entre 2 points.
//   speedMul ∈ [1..30] divise la durée (mode debug).
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
  const totalDist = (target.durationMs / 1000) * SPEED_PX_PER_SEC; // distance "base speed=1"
  if (totalDist <= 0) return 0;
  const baseRemaining = (remainingDist / totalDist) * target.durationMs;
  return baseRemaining / Math.max(1, speedMul);
}
