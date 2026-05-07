// Hook persistance followedPlayers : AsyncStorage + sync Firebase optionnel.
import { useCallback, useEffect, useRef } from 'react';
import usePersistedState from './usePersistedState';
import { updateMyProfile } from '../../firebase';

const FOLLOWED_KEY = '@treasureProto.followedPlayers.v1';
const SYNC_THROTTLE_MS = 2000;

export default function useFollowed() {
  const [followedPlayers, setFollowedPlayers, loaded] = usePersistedState(FOLLOWED_KEY, []);
  const lastSyncRef = useRef(0);

  // Sync Firebase throttlée
  const syncToFirebase = useCallback((list) => {
    const now = Date.now();
    if (now - lastSyncRef.current < SYNC_THROTTLE_MS) return;
    lastSyncRef.current = now;
    updateMyProfile({ followedPlayers: list }).catch(() => {});
  }, []);

  const isFollowed = useCallback(
    (playerId) => followedPlayers.some((p) => p.id === playerId),
    [followedPlayers]
  );

  const toggleFollow = useCallback(
    (player) => {
      setFollowedPlayers((prev) => {
        const exists = prev.some((p) => p.id === player.id);
        const next = exists
          ? prev.filter((p) => p.id !== player.id)
          : [...prev, { id: player.id, name: player.name, color: player.color }];
        syncToFirebase(next);
        return next;
      });
    },
    [setFollowedPlayers, syncToFirebase]
  );

  return { followedPlayers, isFollowed, toggleFollow, followedLoaded: loaded };
}
