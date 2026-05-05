// Flèche au bord d'écran indiquant un joueur hors viewport.
// Pilotée par requestAnimationFrame qui lit Animated.Values en continu.
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { MAP_W_PX, MAP_H_PX } from './TileLayer';

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
      // camX/camY = translation du coin sup-gauche de la View map à l'écran.
      // React Native applique le scale depuis le centre de la View map (transform-origin = centre).
      const tx = camX.__getValue();
      const ty = camY.__getValue();
      const s = scaleVal.__getValue();

      const mapCx = MAP_W_PX / 2;
      const mapCy = MAP_H_PX / 2;
      // Position écran = translation + centre_map + (pos_joueur - centre_map) * scale
      const sx = tx + mapCx + (px - mapCx) * s;
      const sy = ty + mapCy + (py - mapCy) * s;

      const inView = sx >= 0 && sx <= W && sy >= 0 && sy <= H;
      if (inView) {
        visible.setValue(0);
      } else {
        // Vecteur du centre écran vers la position du joueur
        const vx = sx - cx, vy = sy - cy;
        const len = Math.hypot(vx, vy) || 1;
        const ux = vx / len, uy = vy / len;
        // Clamp sur le rectangle du bord écran
        const halfW = W / 2 - ARROW_PAD;
        const halfH = H / 2 - ARROW_PAD;
        const t1 = ux !== 0 ? halfW / Math.abs(ux) : Infinity;
        const t2 = uy !== 0 ? halfH / Math.abs(uy) : Infinity;
        const t = Math.min(t1, t2);
        left.setValue(cx + ux * t - ARROW_SIZE / 2);
        top.setValue(cy + uy * t - ARROW_SIZE / 2);
        // Le triangle CSS (borderRightColor) pointe vers la gauche (←).
        // atan2 retourne 0° pour la droite, donc on ajoute +180°
        // pour que la flèche pointe vers le joueur (direction ux, uy).
        const angleDeg = Math.atan2(uy, ux) * 180 / Math.PI + 180;
        rotate.setValue(angleDeg);
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
          // inputRange élargi pour couvrir les angles après +180° (0–360)
          { rotate: rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
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
