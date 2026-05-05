// Rendu de la map en Views natives (compositor RN, pas de SVG).
// Beaucoup plus fluide qu'un Svg pour une map statique.
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { TILES_DATA, TILE_COLORS, TILE_PX, MAP_W, MAP_H } from '../src/tilemap';

export const MAP_W_PX = MAP_W * TILE_PX;
export const MAP_H_PX = MAP_H * TILE_PX;

function TileLayerImpl() {
  const rects = useMemo(() => {
    // Merge 2D greedy : étend à droite (max run même type), puis vers le bas tant que
    // toute la tranche a le même type. Réduit massivement le nb de Views sur grande map.
    const visited = new Uint8Array(MAP_W * MAP_H);
    const out = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (visited[y * MAP_W + x]) continue;
        const t = TILES_DATA[y * MAP_W + x];
        let xEnd = x;
        while (xEnd < MAP_W && !visited[y * MAP_W + xEnd] && TILES_DATA[y * MAP_W + xEnd] === t) xEnd++;
        let yEnd = y + 1;
        outer: while (yEnd < MAP_H) {
          for (let xx = x; xx < xEnd; xx++) {
            if (visited[yEnd * MAP_W + xx] || TILES_DATA[yEnd * MAP_W + xx] !== t) break outer;
          }
          yEnd++;
        }
        for (let yy = y; yy < yEnd; yy++) {
          for (let xx = x; xx < xEnd; xx++) {
            visited[yy * MAP_W + xx] = 1;
          }
        }
        out.push({
          left: x * TILE_PX,
          top: y * TILE_PX,
          width: (xEnd - x) * TILE_PX,
          height: (yEnd - y) * TILE_PX,
          backgroundColor: TILE_COLORS[t],
        });
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
