// Catmull-Rom : lisse une polyline en courbe douce.
// `points` = [{x,y}], `samplesPerSeg` densité, `tension` (0=lisse, 1=quasi-droit).

export function smoothPath(points, samplesPerSeg = 8, tension = 0.5) {
  if (!points || points.length < 2) return { samples: points || [], length: 0 };
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

  let length = 0;
  for (let i = 1; i < samples.length; i++) {
    length += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
  }
  return { samples, length };
}

// Renvoie le point sur la polyline à la distance d depuis le début.
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
