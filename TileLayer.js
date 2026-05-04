// Rendu de la map en Views natives (compositor RN, pas de SVG).
// Beaucoup plus fluide qu'un Svg pour une map statique.
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { TILES_DATA, TILE_COLORS, TILE_PX, MAP_W, MAP_H } from '../src/tilemap';

export const MAP_W_PX = MAP_W * TILE_PX;
export const MAP_H_PX = MAP_H * TILE_PX;

function TileLayerImpl() {
  const rects = useMemo(() => {
    const out = [];
    for (let y = 0; y < MAP_H; y++) {
      let x = 0;
      while (x < MAP_W) {
        const t = TILES_DATA[y * MAP_W + x];
        let xEnd = x;
        while (xEnd < MAP_W && TILES_DATA[y * MAP_W + xEnd] === t) xEnd++;
        out.push({
          left: x * TILE_PX,
          top: y * TILE_PX,
          width: (xEnd - x) * TILE_PX,
          height: TILE_PX,
          backgroundColor: TILE_COLORS[t],
        });
        x = xEnd;
      }
    }
    return out;
  }, []);

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: MAP_W_PX, height: MAP_H_PX }}
    >
      {rects.map((r, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: r.left, top: r.top,
            width: r.width, height: r.height,
            backgroundColor: r.backgroundColor,
          }}
        />
      ))}
    </View>
  );
}

export default React.memo(TileLayerImpl);
