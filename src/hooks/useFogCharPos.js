/**
 * useFogCharPos — expose la position du personnage en valeur JS
 * (pas Animated.Value) pour le FogLayer SVG.
 * Met à jour à ~30fps via un listener sur animX/animY.
 */
import { useState, useEffect, useRef } from 'react';

export function useFogCharPos(animX, animY, updateHz = 30) {
  const [pos, setPos] = useState({ x: animX.__getValue(), y: animY.__getValue() });
  const rafRef = useRef(null);
  const lastUpdate = useRef(0);
  const intervalMs = 1000 / updateHz;

  useEffect(() => {
    const tick = (now) => {
      if (now - lastUpdate.current >= intervalMs) {
        lastUpdate.current = now;
        setPos({ x: animX.__getValue(), y: animY.__getValue() });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [animX, animY, intervalMs]);

  return pos;
}
