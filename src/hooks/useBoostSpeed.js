// useBoostSpeed — bouton "long press" debug qui escalade un multiplicateur de vitesse.
// Tant que le bouton reste pressé, le niveau monte tous les 600ms jusqu'au max.
//
// Retourne : { speedLvl, speedMul, onPressIn, onPressOut }

import { useCallback, useEffect, useRef, useState } from 'react';
import { SPEED_LEVELS } from '../constants';

const TICK_MS = 600;

export function useBoostSpeed() {
  const [speedLvl, setSpeedLvl] = useState(0);
  const timerRef = useRef(null);

  const speedMul = SPEED_LEVELS[speedLvl];

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPressIn = useCallback(() => {
    clearTimer();
    setSpeedLvl(1);
    let lvl = 1;
    const tick = () => {
      lvl++;
      if (lvl >= SPEED_LEVELS.length) return;
      setSpeedLvl(lvl);
      timerRef.current = setTimeout(tick, TICK_MS);
    };
    timerRef.current = setTimeout(tick, TICK_MS);
  }, [clearTimer]);

  const onPressOut = useCallback(() => {
    clearTimer();
    setSpeedLvl(0);
  }, [clearTimer]);

  // Cleanup unmount
  useEffect(() => clearTimer, [clearTimer]);

  return { speedLvl, speedMul, onPressIn, onPressOut };
}
