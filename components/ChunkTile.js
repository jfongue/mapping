// ChunkTile — rend un seul chunk via des Views natives (greedy merge).
// Accepte un objet chunk { originPx, grid } généré par chunkManager.
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { TILE_COLORS, GRID_STEP } from '../src/tilemap';

// Mapping string→couleur (chunkManager retourne des strings)
const CHUNK_COLORS = {
  grass:    TILE_COLORS[2], // plain vert
  water:    TILE_COLORS[0],
  mountain: TILE_COLORS[4],
  bridge:   TILE_COLORS[1], // bridge = couleur plage/passerelle
};

const CELLS = 10; // CHUNK_CELLS

function ChunkTileImpl({ chunk }) {
  const { originPx, grid } = chunk;

  const rects = useMemo(() => {
    if (!grid || grid.length === 0) return [];
    const visited = new Uint8Array(CELLS * CELLS);
    const out = [];

    for (let row = 0; row < CELLS; row++) {
      for (let col = 0; col < CELLS; col++) {
        if (visited[row * CELLS + col]) continue;
        const t = grid[row][col];
        // Étend à droite
        let colEnd = col;
        while (colEnd < CELLS && !visited[row * CELLS + colEnd] && grid[row][colEnd] === t) colEnd++;
        // Étend vers le bas
        let rowEnd = row + 1;
        outer: while (rowEnd < CELLS) {
          for (let c = col; c < colEnd; c++) {
            if (visited[rowEnd * CELLS + c] || grid[rowEnd][c] !== t) break outer;
          }
          rowEnd++;
        }
        // Marque comme visité
        for (let r = row; r < rowEnd; r++) {
          for (let c = col; c < colEnd; c++) visited[r * CELLS + c] = 1;
        }
        out.push({
          left:   col * GRID_STEP,
          top:    row * GRID_STEP,
          width:  (colEnd - col) * GRID_STEP,
          height: (rowEnd - row) * GRID_STEP,
          color:  CHUNK_COLORS[t] || '#e0eaa8',
        });
      }
    }
    return out;
  }, [grid]);

  const chunkSize = CELLS * GRID_STEP; // 500px

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: originPx.x,
        top:  originPx.y,
        width:  chunkSize,
        height: chunkSize,
      }}
    >
      {rects.map((r, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left:   r.left,
            top:    r.top,
            width:  r.width,
            height: r.height,
            backgroundColor: r.color,
          }}
        />
      ))}
    </View>
  );
}

export default React.memo(ChunkTileImpl);
