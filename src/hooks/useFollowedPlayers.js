// useFollowedPlayers — gère le Set de playerIds suivis, persisté en AsyncStorage.
//
// Retourne : { followed, toggle, isFollowed }

import { useEffect, useState, useCallback } from 'react';
import { FOLLOWED_PLAYERS_KEY } from '../constants';
import { safeGetJSON, safeSetJSON } from '../storage';

export function useFollowedPlayers() {
  const [followed, setFollowed] = useState(() => new Set());

  // Chargement initial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const arr = await safeGetJSON(FOLLOWED_PLAYERS_KEY, []);
      if (cancelled) return;
      if (Array.isArray(arr)) setFollowed(new Set(arr));
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback((playerId) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      safeSetJSON(FOLLOWED_PLAYERS_KEY, [...next]);
      return next;
    });
  }, []);

  const isFollowed = useCallback((playerId) => followed.has(playerId), [followed]);

  return { followed, toggle, isFollowed };
}
