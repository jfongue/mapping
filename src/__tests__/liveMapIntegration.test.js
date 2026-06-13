// Intégration sur la VRAIE carte générée (src/tilemap.js) : garantit que les
// trésors et le décor produisent un résultat cohérent et borné en conditions réelles.
const { TILES_DATA, MAP_W, MAP_H, TILE_PX, SELECTABLE } = require('../tilemap');
const { generateTreasures } = require('../treasures');
const { generateDecor } = require('../biomeDecor');

describe('intégration carte réelle', () => {
  test('les trésors se posent sur des tuiles sélectionnables, espacés et variés', () => {
    const tr = generateTreasures({
      tiles: TILES_DATA, W: MAP_W, H: MAP_H, tilePx: TILE_PX,
      selectable: SELECTABLE, count: 60, minDistTiles: 7,
    });
    expect(tr.length).toBeGreaterThan(20);
    expect(tr.every((t) => SELECTABLE[TILES_DATA[t.ty * MAP_W + t.tx]])).toBe(true);
    // au moins deux raretés présentes
    expect(new Set(tr.map((t) => t.tier)).size).toBeGreaterThanOrEqual(2);
    // espacement minimum respecté
    for (let i = 0; i < tr.length; i++)
      for (let j = i + 1; j < tr.length; j++)
        expect(Math.hypot(tr[i].tx - tr[j].tx, tr[i].ty - tr[j].ty)).toBeGreaterThanOrEqual(7);
  });

  test('le décor est produit et plafonné', () => {
    const dec = generateDecor({
      tiles: TILES_DATA, W: MAP_W, H: MAP_H, tilePx: TILE_PX,
      density: 0.6, maxItems: 3000,
    });
    expect(dec.length).toBeGreaterThan(100);
    expect(dec.length).toBeLessThanOrEqual(3000);
    const types = new Set(dec.map((d) => d.type));
    expect(types.has('tree')).toBe(true);
  });
});
