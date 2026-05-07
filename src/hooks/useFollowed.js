// Hook logique suivi joueurs — persistance AsyncStorage + sync Firebase.
import { useCallback } from 'react';
import usePersistedState from './usePersistedState';
import { updateMyProfile } from '../../firebase';

export const FOLLOWED_KEY = '@treasureProto.followedPlayers.v1';

export default function useFollowed() {
  const [followedPlayers, setFollowedPlayers, loaded] = usePersistedState(FOLLOWED_KEY, []);

  const isFollowed = useCallback(
    (playerId) => followedPlayers.some((p) => p.id === playerId),
    [followedPlayers]
  );

  const toggleFollow = useCallback(
    (player) => {
      setFollowedPlayers((prev) => {
        let next;
        if (prev.some((p) => p.id === player.id)) {
          next = prev.filter((p) => p.id !== player.id);
        } else {
          next = [...prev, { id: player.id, name: player.name, color: player.color }];
        }
        // Sync Firebase (best-effort)
        try {
          updateMyProfile({ followedPlayers: next });
        } catch (e) {}
        return next;
      });
    },
    [setFollowedPlayers]
  );

  const getFollowedPlayers = useCallback(() => followedPlayers, [followedPlayers]);

  return { followedPlayers, isFollowed, toggleFollow, getFollowedPlayers, loaded };
}
