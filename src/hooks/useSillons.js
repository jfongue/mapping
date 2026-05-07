// Hook React — état persisté des sillons + érosion auto + helpers debug.
import { useEffect, useRef, useCallback } from 'react';
import { usePersistedState } from './usePersistedState';
import {
  incrementPath,
  erosionTick,
  getSpeedMul,
  getSillonLevel,
  sillonStats,
  EROSION_DELAY_MS,
} from '../sillons';

const STORAGE_KEY = '@treasureProto.sillons.v1';
const EROSION_INTERVAL_MS = 60 * 1000; // 1 min

export function useSillons() {
  const [sillons, setSillons] = usePersistedState(STORAGE_KEY, {});
  const isMovingRef = useRef(false);
  const sillonsRef = useRef(sillons);
  sillonsRef.current = sillons;

  // Érosion automatique — pause si en mouvement
  useEffect(() => {
    const id = setInterval(() => {
      if (isMovingRef.current) return;
      const { next, changed } = erosionTick(sillonsRef.current);
      if (changed) setSillons(next);
    }, EROSION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [setSillons]);

  // Appelé au départ d'un trajet
  const onTripStart = useCallback(() => {
    isMovingRef.current = true;
  }, []);

  // Appelé à l'arrivée avec le path en coords cellule [{x, y}]
  const onTripEnd = useCallback((cellPath) => {
    isMovingRef.current = false;
    if (!cellPath || cellPath.length === 0) return;
    setSillons(prev => incrementPath(prev, cellPath));
  }, [setSillons]);

  // Multiplicateur vitesse pour une cellule (pour pathfinding & movement)
  const speedMulAt = useCallback((cx, cy, tileType) => {
    return getSpeedMul(sillonsRef.current, cx, cy, tileType);
  }, []);

  // Niveau visuel d'une cellule
  const levelAt = useCallback((cx, cy, tileType) => {
    const key = `${cx},${cy}`;
    const count = sillonsRef.current[key]?.count ?? 0;
    return getSillonLevel(count, tileType);
  }, []);

  // DEBUG : boost rapide d'une zone (carrée centrix, rayon r)
  const debugBoost = useCallback((cx, cy, r = 5, amount = 50) => {
    setSillons(prev => {
      const next = { ...prev };
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const key = `${cx + dx},${cy + dy}`;
          const old = next[key] ?? { count: 0, lastUsed: Date.now() };
          next[key] = { count: Math.min(old.count + amount, 65535), lastUsed: Date.now() };
        }
      }
      return next;
    });
  }, [setSillons]);

  // DEBUG : simule N jours d'inactivité sur tout
  const debugFastErosion = useCallback((days = 7) => {
    setSillons(prev => {
      const fakePast = Date.now() - days * 24 * 60 * 60 * 1000 - 1000;
      const aged = {};
      for (const [k, v] of Object.entries(prev)) {
        aged[k] = { ...v, lastUsed: fakePast };
      }
      const { next } = erosionTick(aged);
      return next;
    });
  }, [setSillons]);

  // DEBUG : reset total
  const debugReset = useCallback(() => setSillons({}), [setSillons]);

  // DEBUG : stats
  const debugStats = useCallback(() => sillonStats(sillonsRef.current), []);

  return {
    sillons,
    onTripStart,
    onTripEnd,
    speedMulAt,
    levelAt,
    debugBoost,
    debugFastErosion,
    debugReset,
    debugStats,
  };
}
