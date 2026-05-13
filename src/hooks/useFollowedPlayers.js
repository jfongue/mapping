// useFollowedPlayers — gère le Set de playerIds suivis, persisté en AsyncStorage.
//
// Retourne : { followed, toggle, isFollowed }

import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FOLLOWED_PLAYERS_KEY } from '../constants';

export function useFollowedPlayers() {
  const [followed, setFollowed] = useState(() => new Set());

  // Chargement initial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FOLLOWED_PLAYERS_KEY);
        if (cancelled || !raw) return;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setFollowed(new Set(arr));
      } catch (e) {
        if (__DEV__) console.warn('[followed] load failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback((playerId) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      AsyncStorage.setItem(
        FOLLOWED_PLAYERS_KEY,
        JSON.stringify([...next])
      ).catch((e) => __DEV__ && console.warn('[followed] save failed', e));
      return next;
    });
  }, []);

  const isFollowed = useCallback((playerId) => followed.has(playerId), [followed]);

  return { followed, toggle, isFollowed };
}
