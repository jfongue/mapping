// Affiche une courbe (polyline lissée) sur la map, en SVG.
// Mode "preview" (pointillé) ou "active" (plein).
import React, { useMemo } from 'react';
import Svg, { Polyline } from 'react-native-svg';
import { MAP_W_PX, MAP_H_PX } from './TileLayer';

function PathOverlayImpl({ samples, color = '#ffd93d', dashed = false, opacity = 0.9 }) {
  const pointsStr = useMemo(() => {
    if (!samples || samples.length < 2) return '';
    return samples.map((p) => `${p.x},${p.y}`).join(' ');
  }, [samples]);

  if (!pointsStr) return null;

  return (
    <Svg
      width={MAP_W_PX}
      height={MAP_H_PX}
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Polyline
        points={pointsStr}
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={opacity}
        strokeDasharray={dashed ? '10,8' : undefined}
      />
    </Svg>
  );
}

export default React.memo(PathOverlayImpl);
