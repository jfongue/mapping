// Brouillard de guerre flouté. Mask SVG : tout est noir, on perce des trous
// circulaires aux positions découvertes (Set "x,y" en cellules).
// feGaussianBlur sur le mask → bords doux.
import React, { useMemo } from 'react';
import Svg, { Rect, G, Defs, Mask, Circle, Filter, FeGaussianBlur } from 'react-native-svg';
import { MAP_W_PX, MAP_H_PX } from './TileLayer';
import { TILE_PX } from '../src/tilemap';

export default function FogLayer({ discovered, revealRadius = 3.5 }) {
  const holes = useMemo(() => {
    const list = [];
    for (const k of discovered) {
      const [x, y] = k.split(',').map(Number);
      list.push({ cx: x * TILE_PX + TILE_PX / 2, cy: y * TILE_PX + TILE_PX / 2 });
    }
    return list;
  }, [discovered]);

  return (
    <Svg width={MAP_W_PX} height={MAP_H_PX} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
      <Defs>
        <Filter id="fogBlur">
          <FeGaussianBlur stdDeviation="20" />
        </Filter>
        <Mask id="fogMask">
          {/* fond blanc = visible (= zone fog appliqué) */}
          <Rect width={MAP_W_PX} height={MAP_H_PX} fill="white" />
          {/* zones découvertes : noir = trou dans le mask = pas de fog */}
          <G filter="url(#fogBlur)">
            {holes.map((h, i) => (
              <Circle
                key={i}
                cx={h.cx} cy={h.cy}
                r={revealRadius * TILE_PX}
                fill="black"
              />
            ))}
          </G>
        </Mask>
      </Defs>
      <Rect
        width={MAP_W_PX} height={MAP_H_PX}
        fill="#1a1a2e"
        opacity="0.78"
        mask="url(#fogMask)"
      />
    </Svg>
  );
}
