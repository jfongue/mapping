import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTilesToReveal, getTileOpacity as computeOpacity } from './fogUtils';

const STORAGE_KEY = '@fog_of_war_tiles';
const SAVE_DEBOUNCE_MS = 3000; // sauvegarde max toutes les 3s
const REVEAL_THROTTLE_MS = 500; // révélation max toutes les 500ms

const useFogOfWar = () => {
  const [tiles, setTiles]       = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  const saveTimerRef    = useRef(null);
  const lastRevealRef   = useRef(0);
  const lastTileKeyRef  = useRef('');

  // ─── Chargement initial ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setTiles(JSON.parse(raw));
      } catch (e) {
        console.warn('[FogOfWar] Erreur chargement AsyncStorage :', e);
      } finally {
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  // ─── Sauvegarde debouncée (max 1x toutes les 3s) ──────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tiles));
      } catch (e) {
        console.warn('[FogOfWar] Erreur sauvegarde AsyncStorage :', e);
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tiles, isLoaded]);

  // ─── Révéler les tuiles — throttlé + dédupliqué ───────────────────────
  const revealPosition = useCallback((latitude, longitude) => {
    const now = Date.now();

    // Throttle : max 1 reveal toutes les 500ms
    if (now - lastRevealRef.current < REVEAL_THROTTLE_MS) return;

    // Déduplication : même tuile centrale = inutile de recalculer
    const centerKey = `${Math.floor(latitude)}_${Math.floor(longitude)}`;
    if (centerKey === lastTileKeyRef.current) return;

    lastRevealRef.current  = now;
    lastTileKeyRef.current = centerKey;

    const keysToReveal = getTilesToReveal(latitude, longitude);

    setTiles((prev) => {
      let changed = false;
      const next = { ...prev };
      keysToReveal.forEach((key) => {
        const existing = prev[key];
        // Ne mettre à jour que si la tuile n'existe pas ou si lastSeen est vieux (>1min)
        if (!existing || now - existing.lastSeen > 60_000) {
          next[key] = {
            firstSeen: existing?.firstSeen ?? now,
            lastSeen:  now,
          };
          changed = true;
        }
      });
      return changed ? next : prev; // évite re-render si rien n'a changé
    });
  }, []);

  // ─── Opacité d'une tuile ────────────────────────────────────────────────
  const getOpacity = useCallback((tileKey) => {
    return computeOpacity(tiles[tileKey]);
  }, [tiles]);

  // ─── Reset complet ──────────────────────────────────────────────────────
  const resetFog = useCallback(async () => {
    setTiles({});
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }, []);

  return { tiles, revealPosition, getOpacity, isLoaded, resetFog };
};

export default useFogOfWar;
