// Flèches SmoothEdgeArrow pour chaque joueur suivi (followedPlayers).
// Max 10 flèches, triées par distance croissante. Pas de flèche pour soi-même.
import React, { useMemo } from 'react';
import SmoothEdgeArrow from './SmoothEdgeArrow';

const MAX_ARROWS = 10;

export default function FollowedArrowsLayer({
  followedPlayers,
  playerAnims,
  myPos,
  camX, camY, scaleVal,
  W, H,
  myId,
}) {
  const arrows = useMemo(() => {
    if (!followedPlayers || followedPlayers.length === 0) return [];
    const candidates = followedPlayers
      .filter((fp) => fp.id !== myId && playerAnims.has(fp.id))
      .map((fp) => {
        const e = playerAnims.get(fp.id);
        const dist = Math.hypot(
          (e.x.__getValue() - (myPos?.x || 0)),
          (e.y.__getValue() - (myPos?.y || 0))
        );
        return { fp, e, dist };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, MAX_ARROWS);
    return candidates;
  }, [followedPlayers, playerAnims, myPos, myId]);

  if (!W || !H) return null;

  return (
    <>
      {arrows.map(({ fp, e }) => (
        <SmoothEdgeArrow
          key={`follow-arr-${fp.id}`}
          color={fp.color || '#ff6b6b'}
          playerX={e.x}
          playerY={e.y}
          camX={camX}
          camY={camY}
          scaleVal={scaleVal}
          W={W}
          H={H}
          opacity={0.7}
        />
      ))}
    </>
  );
}
