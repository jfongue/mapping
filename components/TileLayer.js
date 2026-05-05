// TileLayer — version chunk-aware.
// Reçoit la Map<string, chunk> des chunks actifs et délègue le rendu
// à ChunkTile (un composant par chunk). Seuls les chunks visibles sont
// montés dans l'arbre React → mémoire et CPU proportionnels au viewport,
// pas à la taille totale de la map.
import React from 'react';
import { View } from 'react-native';
import ChunkTile from './ChunkTile';
import { MAP_SIZE } from '../src/constants';

export const MAP_W_PX = MAP_SIZE;
export const MAP_H_PX = MAP_SIZE;

function TileLayerImpl({ chunks }) {
  const chunkList = chunks ? Array.from(chunks.values()) : [];

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: MAP_W_PX, height: MAP_H_PX }}
    >
      {chunkList.map((chunk) => (
        <ChunkTile key={chunk.key} chunk={chunk} />
      ))}
    </View>
  );
}

export default React.memo(TileLayerImpl, (prev, next) => {
  // Re-render uniquement si la Map a changé (comparaison par référence)
  return prev.chunks === next.chunks;
});
