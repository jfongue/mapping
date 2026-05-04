// Flèche au bord d'écran indiquant un joueur hors viewport.
// Pilotée par requestAnimationFrame qui lit Animated.Values en continu.
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

const ARROW_PAD = 28;
const ARROW_SIZE = 28;

export default function SmoothEdgeArrow({
  color, playerX, playerY,
  camX, camY, scaleVal,
  W, H,
}) {
  const left = useRef(new Animated.Value(-100)).current;
  const top = useRef(new Animated.Value(-100)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const visible = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let raf;
    const cx = W / 2, cy = H / 2;

    const recalc = () => {
      const px = playerX.__getValue();
      const py = playerY.__getValue();
      const tx = camX.__getValue();
      const ty = camY.__getValue();
      const s = scaleVal.__getValue();
      const sx = (px + tx) * s;
      const sy = (py + ty) * s;
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
        rotate.setValue(Math.atan2(uy, ux) * 180 / Math.PI);
        visible.setValue(1);
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
          { rotate: rotate.interpolate({ inputRange: [-180, 180], outputRange: ['-180deg', '180deg'] }) },
        ],
        justifyContent: 'center', alignItems: 'center',
      }}
    >
      <View style={{
        width: 0, height: 0,
        borderTopWidth: 9,
        borderBottomWidth: 9,
        borderRightWidth: 16,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderRightColor: color || '#fff',
      }} />
    </Animated.View>
  );
}
