// Tests Jest — toggleFollow, getFollowedPlayers (logique pure, sans React).

describe('followedPlayers logic', () => {
  function makeStore(initial = []) {
    let state = [...initial];
    const setState = (fn) => { state = fn(state); };
    const isFollowed = (id) => state.some((p) => p.id === id);
    const toggleFollow = (player) => {
      setState((prev) =>
        prev.some((p) => p.id === player.id)
          ? prev.filter((p) => p.id !== player.id)
          : [...prev, { id: player.id, name: player.name, color: player.color }]
      );
    };
    const getFollowedPlayers = () => state;
    return { isFollowed, toggleFollow, getFollowedPlayers };
  }

  const mockPlayer = { id: 'player-1', name: 'Théo', color: '#5dca8b', x: 1000, y: 1200 };
  const mockPlayer2 = { id: 'player-2', name: 'Léa', color: '#9b6dbd', x: 1500, y: 1500 };

  test('toggleFollow adds a player to followedPlayers', () => {
    const store = makeStore();
    expect(store.isFollowed('player-1')).toBe(false);
    store.toggleFollow(mockPlayer);
    expect(store.isFollowed('player-1')).toBe(true);
    expect(store.getFollowedPlayers()).toHaveLength(1);
    expect(store.getFollowedPlayers()[0]).toMatchObject({ id: 'player-1', name: 'Théo', color: '#5dca8b' });
  });

  test('toggleFollow removes a player already followed', () => {
    const store = makeStore([{ id: 'player-1', name: 'Théo', color: '#5dca8b' }]);
    expect(store.isFollowed('player-1')).toBe(true);
    store.toggleFollow(mockPlayer);
    expect(store.isFollowed('player-1')).toBe(false);
    expect(store.getFollowedPlayers()).toHaveLength(0);
  });

  test('getFollowedPlayers returns all followed players', () => {
    const store = makeStore();
    store.toggleFollow(mockPlayer);
    store.toggleFollow(mockPlayer2);
    const result = store.getFollowedPlayers();
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(['player-1', 'player-2']);
  });
});
