// Trail léger : rend des dots espacés régulièrement le long d'un chemin (waypoints).
// Native Views uniquement — pas de SVG, pas de Skia : très bon framerate.
import React, { useMemo } from 'react';
import { View } from 'react-native';

function DottedTrailImpl({
  samples,
  color = '#3a7ea8',
  spacing = 28,
  size = 6,
  opacity = 0.95,
  minDist = 0,
}) {
  // Pré-calcule chaque dot avec sa distance cumulée le long du chemin.
  const dots = useMemo(() => {
    if (!samples || samples.length < 2) return [];
    const out = [];
    let acc = 0;
    let next = spacing / 2; // petit décalage pour ne pas coller au perso
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const seg = Math.hypot(dx, dy);
      if (seg <= 0) continue;
      while (next <= acc + seg) {
        const t = (next - acc) / seg;
        out.push({ x: a.x + dx * t, y: a.y + dy * t, dist: next });
        next += spacing;
      }
      acc += seg;
    }
    return out;
  }, [samples, spacing]);

  if (dots.length === 0) return null;
  const half = size / 2;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
      {dots.map((d, i) => {
        if (d.dist < minDist) return null;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: d.x - half, top: d.y - half,
              width: size, height: size, borderRadius: half,
              backgroundColor: color,
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}

export default React.memo(DottedTrailImpl);
