// Fonctions géométriques pures (pas d'état, pas de side effects).

// Distance d'un point à un segment [a, b].
export function distPointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Distance d'un point à une polyline (suite de samples).
export function distPointToPolyline(px, py, samples) {
  if (!samples || samples.length === 0) return Infinity;
  if (samples.length === 1) return Math.hypot(px - samples[0].x, py - samples[0].y);
  let minD = Infinity;
  for (let i = 1; i < samples.length; i++) {
    const d = distPointToSegment(px, py, samples[i - 1].x, samples[i - 1].y, samples[i].x, samples[i].y);
    if (d < minD) minD = d;
  }
  return minD;
}

// Longueur cumulée d'une polyline.
export function polylineLength(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) {
    l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return l;
}

// Catmull-Rom avec tension (0 = lisse classique, 1 = quasi-droit).
// Plus tension est élevée, plus le tracé colle aux waypoints.
export function smoothPath(points, samplesPerSeg = 8, tension = 0.6) {
  if (!points || points.length === 0) return { samples: [], length: 0 };
  if (points.length === 1) return { samples: [points[0]], length: 0 };
  if (points.length < 2) return { samples: points.slice(), length: polylineLength(points) };

  const pts = [points[0], ...points, points[points.length - 1]];
  const samples = [];
  const alpha = (1 - tension) * 0.5;

  for (let i = 0; i < pts.length - 3; i++) {
    const p0 = pts[i], p1 = pts[i + 1], p2 = pts[i + 2], p3 = pts[i + 3];
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      const t2 = t * t, t3 = t2 * t;
      const m1x = alpha * (p2.x - p0.x), m1y = alpha * (p2.y - p0.y);
      const m2x = alpha * (p3.x - p1.x), m2y = alpha * (p3.y - p1.y);
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      samples.push({
        x: h00 * p1.x + h10 * m1x + h01 * p2.x + h11 * m2x,
        y: h00 * p1.y + h10 * m1y + h01 * p2.y + h11 * m2y,
      });
    }
  }
  samples.push(points[points.length - 1]);
  return { samples, length: polylineLength(samples) };
}

// Renvoie le point sur la polyline à la distance `d` depuis le début.
export function sampleAt(samples, d) {
  if (!samples || samples.length === 0) return { x: 0, y: 0 };
  let acc = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + seg >= d) {
      const t = seg === 0 ? 0 : (d - acc) / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    acc += seg;
  }
  return { ...samples[samples.length - 1] };
}
