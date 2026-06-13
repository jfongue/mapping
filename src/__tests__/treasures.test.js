const {
  generateTreasures, treasureNearPoint, treasuresWithin, sumTreasureXp, TREASURE_TIERS,
} = require('../treasures');

// Mini-carte de test : 20×20, anneau d'eau (non sélectionnable) + terre.
const W = 20, H = 20, TILE = 50;
const SELECTABLE = { 0: false, 1: true, 2: true, 3: true, 4: false, 5: false };
function makeTiles() {
  const t = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      t[y * W + x] = (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? 0 : 2;
  return t;
}

describe('generateTreasures', () => {
  const base = { tiles: makeTiles(), W, H, tilePx: TILE, selectable: SELECTABLE };

  test('déterministe pour une même graine', () => {
    const a = generateTreasures({ ...base, seed: 42, count: 15 });
    const b = generateTreasures({ ...base, seed: 42, count: 15 });
    expect(a).toEqual(b);
  });

  test('change avec la graine', () => {
    const a = generateTreasures({ ...base, seed: 1, count: 15 });
    const b = generateTreasures({ ...base, seed: 2, count: 15 });
    expect(a).not.toEqual(b);
  });

  test('respecte le nombre cible (borné)', () => {
    const list = generateTreasures({ ...base, count: 10, minDistTiles: 2 });
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(10);
  });

  test('uniquement sur tuiles sélectionnables', () => {
    const tiles = base.tiles;
    for (const t of generateTreasures({ ...base, count: 30, minDistTiles: 2 })) {
      expect(SELECTABLE[tiles[t.ty * W + t.tx]]).toBe(true);
    }
  });

  test('respecte l’espacement minimum', () => {
    const minDistTiles = 4;
    const list = generateTreasures({ ...base, count: 30, minDistTiles });
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const d = Math.hypot(list[i].tx - list[j].tx, list[i].ty - list[j].ty);
        expect(d).toBeGreaterThanOrEqual(minDistTiles);
      }
  });

  test('chaque coffre a un tier valide et une position px cohérente', () => {
    for (const t of generateTreasures({ ...base, count: 10, minDistTiles: 2 })) {
      expect(TREASURE_TIERS[t.tier]).toBeDefined();
      expect(t.xp).toBe(TREASURE_TIERS[t.tier].xp);
      expect(t.x).toBeCloseTo(t.tx * TILE + TILE / 2);
      expect(t.y).toBeCloseTo(t.ty * TILE + TILE / 2);
      expect(typeof t.id).toBe('string');
      expect(typeof t.name).toBe('string');
    }
  });

  test('ids uniques', () => {
    const list = generateTreasures({ ...base, count: 30, minDistTiles: 2 });
    expect(new Set(list.map((t) => t.id)).size).toBe(list.length);
  });

  test('entrées invalides → []', () => {
    expect(generateTreasures()).toEqual([]);
    expect(generateTreasures({ W, H, tilePx: TILE, selectable: SELECTABLE })).toEqual([]);
  });
});

describe('helpers de proximité', () => {
  const treasures = [
    { id: 'a', x: 100, y: 100, xp: 1000 },
    { id: 'b', x: 500, y: 500, xp: 2000 },
  ];

  test('treasureNearPoint trouve le plus proche dans le rayon', () => {
    expect(treasureNearPoint(treasures, 110, 110, 50).id).toBe('a');
    expect(treasureNearPoint(treasures, 1000, 1000, 50)).toBe(null);
  });

  test('treasureNearPoint ignore les collectés', () => {
    const collected = new Set(['a']);
    expect(treasureNearPoint(treasures, 110, 110, 50, collected)).toBe(null);
  });

  test('treasuresWithin renvoie tous ceux dans le rayon', () => {
    expect(treasuresWithin(treasures, 100, 100, 30).map((t) => t.id)).toEqual(['a']);
    expect(treasuresWithin(treasures, 300, 300, 1000).length).toBe(2);
  });

  test('sumTreasureXp additionne', () => {
    expect(sumTreasureXp(treasures)).toBe(3000);
    expect(sumTreasureXp([])).toBe(0);
    expect(sumTreasureXp()).toBe(0);
  });
});
