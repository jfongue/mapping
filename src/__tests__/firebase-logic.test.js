// Tests de la logique de filtre Firebase (sans connexion réelle).
// On simule un snapshot et on vérifie le filtrage.

describe('Firebase data filtering logic', () => {
  // Fonction extraite de firebase.js : filtre les autres joueurs
  const filterOthers = (data, myId) =>
    Object.values(data || {}).filter((p) => p && p.id !== myId);

  test('renvoie tous sauf moi', () => {
    const data = {
      a: { id: 'a' }, b: { id: 'b' }, c: { id: 'c' },
    };
    expect(filterOthers(data, 'b').map((p) => p.id)).toEqual(['a', 'c']);
  });

  test('data null → vide', () => {
    expect(filterOthers(null, 'me')).toEqual([]);
  });

  test('data {} → vide', () => {
    expect(filterOthers({}, 'me')).toEqual([]);
  });

  test('filtre les entrées null', () => {
    const data = { a: { id: 'a' }, b: null, c: { id: 'c' } };
    expect(filterOthers(data, 'me').map((p) => p.id)).toEqual(['a', 'c']);
  });

  test('moi seul → vide', () => {
    expect(filterOthers({ me: { id: 'me' } }, 'me')).toEqual([]);
  });
});
