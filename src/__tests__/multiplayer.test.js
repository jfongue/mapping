// Tests Jest : MockMultiplayer + logique follow
import { MockMultiplayer } from '../multiplayer';

describe('MockMultiplayer — base', () => {
  let mp;
  beforeEach(async () => {
    mp = new MockMultiplayer();
    await mp.init({ playerId: 'me', name: 'Test', color: '#fff' });
  });
  afterEach(() => mp.dispose());

  it('subscribePlayers retourne les 3 faux joueurs', (done) => {
    const unsub = mp.subscribePlayers((list) => {
      expect(list).toHaveLength(3);
      expect(list[0]).toHaveProperty('id');
      unsub();
      done();
    });
  });

  it('tick met à jour les positions', () => {
    const before = { x: mp.fakePlayers[0].x, y: mp.fakePlayers[0].y };
    mp.tick();
    const after = { x: mp.fakePlayers[0].x, y: mp.fakePlayers[0].y };
    expect(after.x).not.toEqual(before.x);
  });

  it('getAllPlayers inclut me + fakePlayers', () => {
    const all = mp.getAllPlayers();
    expect(all.length).toBe(4);
    expect(all.find((p) => p.id === 'me')).toBeTruthy();
  });
});

describe('toggleFollow / getFollowedPlayers', () => {
  let mp;
  beforeEach(async () => {
    mp = new MockMultiplayer();
    await mp.init({ playerId: 'me', name: 'Test', color: '#fff' });
  });
  afterEach(() => mp.dispose());

  it('toggleFollow ajoute un joueur au premier appel', () => {
    const player = { id: 'mock-1', name: 'Théo', color: '#5dca8b' };
    mp.toggleFollow(player);
    expect(mp.getFollowedPlayers()).toEqual([player]);
  });

  it('toggleFollow retire le joueur au deuxième appel (toggle off)', () => {
    const player = { id: 'mock-2', name: 'Léa', color: '#9b6dbd' };
    mp.toggleFollow(player);
    mp.toggleFollow(player);
    expect(mp.getFollowedPlayers()).toHaveLength(0);
  });

  it('getFollowedPlayers retourne [] par défaut', () => {
    expect(mp.getFollowedPlayers()).toEqual([]);
  });
});
