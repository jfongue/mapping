// useFogOfWar — gère le brouillard de guerre :
// - charge le Set de tiles découvertes depuis AsyncStorage
// - révèle les tiles autour d'une position pendant le mouvement
// - persiste avec debounce 3s
//
// Retourne : { explored, revealAt }
//   explored: Set<"col,row"> à passer au FogLayer
//   revealAt: (px, py) => void — à appeler manuellement si besoin

import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FOG_KEY, FOG_REVEAL_RADIUS } from '../constants';
import { getTilesInRadius } from '../mapUtils';

const SAVE_DEBOUNCE_MS = 3000;
const REVEAL_INTERVAL_MS = 500;

export function useFogOfWar({ animX, animY, moving, loaded }) {
  const [explored, setExplored] = useState(() => new Set());
  const exploredRef = useRef(new Set());
  const saveTimer = useRef(null);

  // Chargement initial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FOG_KEY);
        if (cancelled || !raw) return;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const s = new Set(arr);
          exploredRef.current = s;
          setExplored(s);
        }
      } catch (e) {
        if (__DEV__) console.warn('[fog] load failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const revealAt = (px, py) => {
    const keys = getTilesInRadius(px, py, FOG_REVEAL_RADIUS);
    let changed = false;
    for (const k of keys) {
      if (!exploredRef.current.has(k)) {
        exploredRef.current.add(k);
        changed = true;
      }
    }
    if (!changed) return;
    setExplored(new Set(exploredRef.current));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(
        FOG_KEY,
        JSON.stringify([...exploredRef.current])
      ).catch((e) => __DEV__ && console.warn('[fog] save failed', e));
    }, SAVE_DEBOUNCE_MS);
  };

  // Reveal continu pendant le déplacement
  useEffect(() => {
    if (!moving) {
      revealAt(animX.__getValue(), animY.__getValue());
      return;
    }
    const id = setInterval(() => {
      revealAt(animX.__getValue(), animY.__getValue());
    }, REVEAL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [moving]);

  // Reveal au chargement initial
  useEffect(() => {
    if (loaded) revealAt(animX.__getValue(), animY.__getValue());
  }, [loaded]);

  // Cleanup global : flush en cas d'unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        AsyncStorage.setItem(
          FOG_KEY,
          JSON.stringify([...exploredRef.current])
        ).catch(() => {});
      }
    };
  }, []);

  return { explored, revealAt };
}
