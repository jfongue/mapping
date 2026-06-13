const { generateDecor } = require('../biomeDecor');

const W = 12, H = 12, TILE = 50;
// Carte de test couvrant tous les biomes.
function makeTiles() {
  const t = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (y < 2) t[y * W + x] = 0;        // water
      else if (y < 4) t[y * W + x] = 1;   // beach (adjacent à l'eau)
      else if (y < 7) t[y * W + x] = 2;   // plain
      else if (y < 9) t[y * W + x] = 3;   // forest
      else if (y < 11) t[y * W + x] = 4;  // rock
      else t[y * W + x] = 5;              // volcano
    }
  return t;
}

describe('generateDecor', () => {
  const base = { tiles: makeTiles(), W, H, tilePx: TILE };

  test('déterministe', () => {
    expect(generateDecor(base)).toEqual(generateDecor(base));
  });

  test('produit des décorations', () => {
    expect(generateDecor(base).length).toBeGreaterThan(0);
  });

  test('respecte le plafond maxItems', () => {
    const d = generateDecor({ ...base, maxItems: 5 });
    expect(d.length).toBeLessThanOrEqual(5);
  });

  test('toutes les décos sont dans les bornes de la carte', () => {
    for (const it of generateDecor(base)) {
      expect(it.left).toBeGreaterThanOrEqual(0);
      expect(it.top).toBeGreaterThanOrEqual(0);
      expect(it.left).toBeLessThanOrEqual(W * TILE);
      expect(it.top).toBeLessThanOrEqual(H * TILE);
      expect(it.w).toBeGreaterThan(0);
      expect(it.h).toBeGreaterThan(0);
      expect(typeof it.type).toBe('string');
    }
  });

  test('le volcan produit lave+cœur', () => {
    const types = new Set(generateDecor(base).map((d) => d.type));
    expect(types.has('lavaGlow')).toBe(true);
    expect(types.has('lavaCore')).toBe(true);
    expect(types.has('tree')).toBe(true);
    expect(types.has('foam')).toBe(true);
  });

  test('density=0 supprime les décos aléatoires', () => {
    // À density 0, plus d'arbres/herbe/rochers/vagues (tirages < 0), mais
    // lave (toujours posée) et écume (déterministe par adjacence) restent.
    const types = new Set(generateDecor({ ...base, density: 0 }).map((d) => d.type));
    expect(types.has('tree')).toBe(false);
    expect(types.has('grass')).toBe(false);
    expect(types.has('lavaCore')).toBe(true);
  });

  test('entrées invalides → []', () => {
    expect(generateDecor()).toEqual([]);
    expect(generateDecor({ W, H, tilePx: TILE })).toEqual([]);
  });
});
