// Flèches directionnelles pour les joueurs suivis (cœur plein).
// Réutilise la logique de SmoothEdgeArrow mais en composant léger multi-instances.
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { MAP_W_PX, MAP_H_PX } from './TileLayer';

const ARROW_PAD = 28;
const ARROW_SIZE = 28;
const MAX_FOLLOWED_ARROWS = 10;

function FollowedArrow({ color, playerX, playerY, camX, camY, scaleVal, W, H }) {
  const left = useRef(new Animated.Value(-100)).current;
  const top = useRef(new Animated.Value(-100)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const visible = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let raf;
    const cx = W / 2, cy = H / 2;
    const recalc = () => {
      const px = typeof playerX.__getValue === 'function' ? playerX.__getValue() : playerX;
      const py = typeof playerY.__getValue === 'function' ? playerY.__getValue() : playerY;
      const tx = typeof camX.__getValue === 'function' ? camX.__getValue() : camX;
      const ty = typeof camY.__getValue === 'function' ? camY.__getValue() : camY;
      const s = typeof scaleVal.__getValue === 'function' ? scaleVal.__getValue() : scaleVal;
      const mapCx = MAP_W_PX / 2;
      const mapCy = MAP_H_PX / 2;
      const sx = tx + mapCx + (px - mapCx) * s;
      const sy = ty + mapCy + (py - mapCy) * s;
      const inView = sx >= 0 && sx <= W && sy >= 0 && sy <= H;
      if (inView) {
        visible.setValue(0);
      } else {
        const vx = sx - cx, vy = sy - cy;
        const len = Math.hypot(vx, vy) || 1;
        const ux = vx / len, uy = vy / len;
        const halfW = W / 2 - ARROW_PAD;
        const halfH = H / 2 - ARROW_PAD;
        const t1 = ux !== 0 ? halfW / Math.abs(ux) : Infinity;
        const t2 = uy !== 0 ? halfH / Math.abs(uy) : Infinity;
        const t = Math.min(t1, t2);
        left.setValue(cx + ux * t - ARROW_SIZE / 2);
        top.setValue(cy + uy * t - ARROW_SIZE / 2);
        const angleDeg = Math.atan2(uy, ux) * 180 / Math.PI + 180;
        rotate.setValue(angleDeg);
        visible.setValue(0.7);
      }
      raf = requestAnimationFrame(recalc);
    };
    recalc();
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [W, H]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: ARROW_SIZE, height: ARROW_SIZE,
        opacity: visible,
        transform: [
          { translateX: left },
          { translateY: top },
          { rotate: rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
        ],
        justifyContent: 'center', alignItems: 'center',
      }}
    >
      <View style={{
        width: 0, height: 0,
        borderTopWidth: 9, borderBottomWidth: 9, borderRightWidth: 16,
        borderTopColor: 'transparent', borderBottomColor: 'transparent',
        borderRightColor: color || '#fff',
      }} />
    </Animated.View>
  );
}

/**
 * @param {object} props
 * @param {Array}  props.followedPlayers  [{id,name,color}]
 * @param {Map}    props.playerAnims      Map<id, {x: Animated.Value, y: Animated.Value}>
 * @param {Animated.Value} props.camX
 * @param {Animated.Value} props.camY
 * @param {Animated.Value} props.scaleVal
 * @param {number} props.W  viewport width
 * @param {number} props.H  viewport height
 * @param {{x:number,y:number}} props.myPos  position du joueur courant
 */
export default function FollowedArrowsLayer({
  followedPlayers, playerAnims, camX, camY, scaleVal, W, H, myPos,
}) {
  if (!W || !H) return null;

  // Limite à 10 flèches, priorité distance
  const candidates = followedPlayers
    .map((fp) => {
      const e = playerAnims.get(fp.id);
      if (!e) return null;
      const px = e.x.__getValue();
      const py = e.y.__getValue();
      const dist = myPos ? Math.hypot(px - myPos.x, py - myPos.y) : 0;
      return { ...fp, animX: e.x, animY: e.y, dist };
    })
    .filter(Boolean)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, MAX_FOLLOWED_ARROWS);

  return (
    <>
      {candidates.map((fp) => (
        <FollowedArrow
          key={`followed-arr-${fp.id}`}
          color={fp.color}
          playerX={fp.animX}
          playerY={fp.animY}
          camX={camX}
          camY={camY}
          scaleVal={scaleVal}
          W={W}
          H={H}
        />
      ))}
    </>
  );
}
