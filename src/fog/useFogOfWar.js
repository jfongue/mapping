import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTilesToReveal, getTileOpacity as computeOpacity } from './fogUtils';

const STORAGE_KEY = '@fog_of_war_tiles';

/**
 * Hook principal du Brouillard de Guerre.
 *
 * Expose :
 *   - tiles          : { [tileKey]: { firstSeen, lastSeen } }
 *   - revealPosition : (latitude, longitude) => void  — appeler à chaque update GPS
 *   - getOpacity     : (tileKey) => number [0..1]
 *   - isLoaded       : bool — true une fois AsyncStorage lu
 */
const useFogOfWar = () => {
  const [tiles, setTiles]     = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  // ─── Chargement initial depuis AsyncStorage ─────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setTiles(JSON.parse(raw));
        }
      } catch (e) {
        console.warn('[FogOfWar] Erreur chargement AsyncStorage :', e);
      } finally {
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  // ─── Sauvegarde automatique dès que tiles change ────────────────────────
  useEffect(() => {
    if (!isLoaded) return; // ne pas écraser avant la lecture initiale
    const save = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tiles));
      } catch (e) {
        console.warn('[FogOfWar] Erreur sauvegarde AsyncStorage :', e);
      }
    };
    save();
  }, [tiles, isLoaded]);

  // ─── Révéler les tuiles autour d'une position GPS ────────────────────────
  const revealPosition = useCallback((latitude, longitude) => {
    const now = Date.now();
    const keysToReveal = getTilesToReveal(latitude, longitude);

    setTiles((prev) => {
      const next = { ...prev };
      keysToReveal.forEach((key) => {
        next[key] = {
          firstSeen: prev[key]?.firstSeen ?? now,
          lastSeen:  now,
        };
      });
      return next;
    });
  }, []);

  // ─── Opacité d'une tuile donnée ─────────────────────────────────────────
  const getOpacity = useCallback((tileKey) => {
    return computeOpacity(tiles[tileKey]);
  }, [tiles]);

  // ─── Reset complet (utile pour les tests / debug) ──────────────────────
  const resetFog = useCallback(async () => {
    setTiles({});
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return { tiles, revealPosition, getOpacity, isLoaded, resetFog };
};

export default useFogOfWar;
