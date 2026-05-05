// ============================================================
// chunkManager.test.js — Tests complets du système de chunks
// ============================================================

import {
  chunkKey,
  parseChunkKey,
  pixelToChunk,
  chunkOriginPx,
  getVisibleChunkRange,
  isChunkOutOfRange,
  generateTerrainSlice,
  generateChunk,
  createChunkRegistry,
  CHUNK_CELLS,
  CHUNK_PX,
  CHUNKS_PER_AXIS,
  CHUNK_LOAD_RADIUS,
} from '../chunkManager';

// ── Helpers ─────────────────────────────────────────────────

describe('chunkKey / parseChunkKey', () => {
  test('format attendu', () => {
    expect(chunkKey(0, 0)).toBe('0_0');
    expect(chunkKey(3, 7)).toBe('3_7');
    expect(chunkKey(10, 99)).toBe('10_99');
  });

  test('round-trip', () => {
    const key = chunkKey(5, 12);
    expect(parseChunkKey(key)).toEqual({ cx: 5, cy: 12 });
  });

  test('valeurs négatives encodées/décodées', () => {
    // edge case : chunk hors map (pas utilisé en prod, mais robustesse)
    const key = chunkKey(-1, -2);
    expect(parseChunkKey(key)).toEqual({ cx: -1, cy: -2 });
  });
});

// ── Conversions pixel ↔ chunk ────────────────────────────────

describe('pixelToChunk', () => {
  test('coin supérieur-gauche → chunk (0,0)', () => {
    expect(pixelToChunk(0, 0)).toEqual({ cx: 0, cy: 0 });
  });

  test('pixel juste avant la frontière droite reste dans le chunk', () => {
    const { cx } = pixelToChunk(CHUNK_PX - 1, 0);
    expect(cx).toBe(0);
  });

  test('pixel exactement sur la frontière passe au chunk suivant', () => {
    const { cx } = pixelToChunk(CHUNK_PX, 0);
    expect(cx).toBe(1);
  });

  test('cohérence avec chunkOriginPx', () => {
    const cx = 3, cy = 4;
    const origin = chunkOriginPx(cx, cy);
    expect(pixelToChunk(origin.x, origin.y)).toEqual({ cx, cy });
  });
});

describe('chunkOriginPx', () => {
  test('origine chunk (0,0) = (0,0)', () => {
    expect(chunkOriginPx(0, 0)).toEqual({ x: 0, y: 0 });
  });

  test('origine chunk (1,0)', () => {
    expect(chunkOriginPx(1, 0)).toEqual({ x: CHUNK_PX, y: 0 });
  });

  test('origine chunk (2,3)', () => {
    expect(chunkOriginPx(2, 3)).toEqual({ x: 2 * CHUNK_PX, y: 3 * CHUNK_PX });
  });
});

// ── Plage de chunks visibles ─────────────────────────────────

describe('getVisibleChunkRange', () => {
  const VIEW_W = 400;
  const VIEW_H = 600;

  test('caméra en (0,0) : inclut le chunk (0,0)', () => {
    const range = getVisibleChunkRange(0, 0, VIEW_W, VIEW_H);
    expect(range.minCx).toBe(0);
    expect(range.minCy).toBe(0);
  });

  test('minCx/minCy ne descend pas sous 0', () => {
    // Caméra très à gauche → pas de chunk négatif
    const range = getVisibleChunkRange(-999, -999, VIEW_W, VIEW_H);
    expect(range.minCx).toBe(0);
    expect(range.minCy).toBe(0);
  });

  test('maxCx/maxCy ne dépasse pas CHUNKS_PER_AXIS - 1', () => {
    const range = getVisibleChunkRange(999999, 999999, VIEW_W, VIEW_H);
    expect(range.maxCx).toBe(CHUNKS_PER_AXIS - 1);
    expect(range.maxCy).toBe(CHUNKS_PER_AXIS - 1);
  });

  test('radius=0 couvre au minimum le chunk de la caméra', () => {
    const range = getVisibleChunkRange(0, 0, 1, 1, 0);
    expect(range.minCx).toBe(0);
    expect(range.maxCx).toBe(0);
  });

  test('radius=2 élargit la plage de 2 dans chaque direction', () => {
    // Caméra centrée sur un chunk intérieur
    const cx = 4, cy = 4;
    const camX = cx * CHUNK_PX;
    const camY = cy * CHUNK_PX;
    const range = getVisibleChunkRange(camX, camY, 1, 1, 2);
    expect(range.minCx).toBe(cx - 2);
    expect(range.minCy).toBe(cy - 2);
  });
});

// ── isChunkOutOfRange ────────────────────────────────────────

describe('isChunkOutOfRange', () => {
  const range = { minCx: 2, maxCx: 5, minCy: 1, maxCy: 4 };

  test('chunk dans la plage → false', () => {
    expect(isChunkOutOfRange(3, 2, range, 0)).toBe(false);
  });

  test('chunk pile sur le bord → false', () => {
    expect(isChunkOutOfRange(2, 1, range, 0)).toBe(false);
    expect(isChunkOutOfRange(5, 4, range, 0)).toBe(false);
  });

  test('chunk hors plage → true', () => {
    expect(isChunkOutOfRange(1, 2, range, 0)).toBe(true);
    expect(isChunkOutOfRange(6, 2, range, 0)).toBe(true);
  });

  test('extra=1 laisse passer le bord + 1', () => {
    expect(isChunkOutOfRange(1, 2, range, 1)).toBe(false); // 1 == minCx - 1
    expect(isChunkOutOfRange(0, 2, range, 1)).toBe(true);  // 0 < minCx - 1
  });
});

// ── generateTerrainSlice ─────────────────────────────────────

describe('generateTerrainSlice', () => {
  const TYPES = new Set(['grass', 'water', 'mountain', 'bridge']);

  test('renvoie une grille size×size', () => {
    const grid = generateTerrainSlice(0, 0, 4);
    expect(grid).toHaveLength(4);
    grid.forEach(row => expect(row).toHaveLength(4));
  });

  test('toutes les valeurs sont des types valides', () => {
    const grid = generateTerrainSlice(0, 0, CHUNK_CELLS);
    grid.forEach(row => row.forEach(cell => expect(TYPES.has(cell)).toBe(true)));
  });

  test('déterminisme : même seed → même résultat', () => {
    const g1 = generateTerrainSlice(5, 3, CHUNK_CELLS, 42);
    const g2 = generateTerrainSlice(5, 3, CHUNK_CELLS, 42);
    expect(g1).toEqual(g2);
  });

  test('seeds différentes → résultats différents (probabilistiquement)', () => {
    const g1 = generateTerrainSlice(0, 0, CHUNK_CELLS, 1);
    const g2 = generateTerrainSlice(0, 0, CHUNK_CELLS, 9999);
    // Très peu probable que les deux soient identiques
    const flat1 = g1.flat().join(',');
    const flat2 = g2.flat().join(',');
    expect(flat1).not.toBe(flat2);
  });

  test('chunks adjacents différents (cohérence spatiale)', () => {
    const g1 = generateTerrainSlice(0, 0, CHUNK_CELLS);
    const g2 = generateTerrainSlice(CHUNK_CELLS, 0, CHUNK_CELLS);
    // Pas forcément différents cellule par cellule, mais le contenu global doit varier
    expect(g1.flat().join(',')).not.toBe(g2.flat().join(','));
  });

  test('zone 1×1', () => {
    const grid = generateTerrainSlice(0, 0, 1);
    expect(grid).toHaveLength(1);
    expect(grid[0]).toHaveLength(1);
    expect(TYPES.has(grid[0][0])).toBe(true);
  });
});

// ── generateChunk ────────────────────────────────────────────

describe('generateChunk', () => {
  test('structure du chunk', () => {
    const chunk = generateChunk(0, 0);
    expect(chunk).toHaveProperty('key');
    expect(chunk).toHaveProperty('cx', 0);
    expect(chunk).toHaveProperty('cy', 0);
    expect(chunk).toHaveProperty('originPx');
    expect(chunk).toHaveProperty('grid');
  });

  test('key cohérente avec (cx, cy)', () => {
    const chunk = generateChunk(3, 5);
    expect(chunk.key).toBe(chunkKey(3, 5));
  });

  test('originPx cohérente', () => {
    const chunk = generateChunk(2, 1);
    expect(chunk.originPx).toEqual(chunkOriginPx(2, 1));
  });

  test('grid CHUNK_CELLS × CHUNK_CELLS', () => {
    const chunk = generateChunk(1, 1);
    expect(chunk.grid).toHaveLength(CHUNK_CELLS);
    chunk.grid.forEach(row => expect(row).toHaveLength(CHUNK_CELLS));
  });

  test('déterminisme', () => {
    const c1 = generateChunk(2, 3);
    const c2 = generateChunk(2, 3);
    expect(c1.grid).toEqual(c2.grid);
  });

  test('deux chunks distincts → grilles a priori différentes', () => {
    const c1 = generateChunk(0, 0);
    const c2 = generateChunk(5, 5);
    expect(c1.grid.flat().join(',')).not.toBe(c2.grid.flat().join(','));
  });
});

// ── ChunkRegistry ────────────────────────────────────────────

describe('createChunkRegistry', () => {
  const VIEW_W = 400;
  const VIEW_H = 400;

  test('registre vide au départ', () => {
    const reg = createChunkRegistry();
    expect(reg.getAll().size).toBe(0);
  });

  test('update() charge des chunks', () => {
    const reg = createChunkRegistry();
    reg.update(0, 0, VIEW_W, VIEW_H);
    expect(reg.getAll().size).toBeGreaterThan(0);
  });

  test('update() idempotent : pas de duplicats', () => {
    const reg = createChunkRegistry();
    reg.update(0, 0, VIEW_W, VIEW_H);
    const size1 = reg.getAll().size;
    reg.update(0, 0, VIEW_W, VIEW_H);
    const size2 = reg.getAll().size;
    expect(size1).toBe(size2);
  });

  test('chunk au centre est présent après update', () => {
    const reg = createChunkRegistry();
    reg.update(0, 0, VIEW_W, VIEW_H);
    const chunk = reg.getChunkAt(0, 0);
    expect(chunk).toBeDefined();
    expect(chunk.cx).toBe(0);
    expect(chunk.cy).toBe(0);
  });

  test('getTileAt renvoie un type valide dans la zone chargée', () => {
    const TYPES = ['grass', 'water', 'mountain', 'bridge'];
    const reg = createChunkRegistry();
    reg.update(0, 0, VIEW_W, VIEW_H);
    const tile = reg.getTileAt(10, 10);
    expect(TYPES).toContain(tile);
  });

  test('getTileAt hors zone chargée renvoie null', () => {
    const reg = createChunkRegistry();
    // Pas d'update → rien de chargé
    expect(reg.getTileAt(100, 100)).toBeNull();
  });

  test('déplacement caméra : anciens chunks purgés, nouveaux chargés', () => {
    const reg = createChunkRegistry();
    // Position initiale — coins
    reg.update(0, 0, VIEW_W, VIEW_H);
    const before = new Set(reg.getAll().keys());

    // Déplacement très loin
    const farX = (CHUNKS_PER_AXIS - 1) * CHUNK_PX;
    const farY = (CHUNKS_PER_AXIS - 1) * CHUNK_PX;
    reg.update(farX, farY, VIEW_W, VIEW_H);
    const after = new Set(reg.getAll().keys());

    // Au moins une clé différente (de nouveaux chunks ont été chargés)
    const newChunks = [...after].filter(k => !before.has(k));
    expect(newChunks.length).toBeGreaterThan(0);
  });

  test('clear() vide le registre', () => {
    const reg = createChunkRegistry();
    reg.update(0, 0, VIEW_W, VIEW_H);
    reg.clear();
    expect(reg.getAll().size).toBe(0);
  });

  test('chunks chargés couvrent le viewport + rayon', () => {
    const reg = createChunkRegistry();
    const camX = 2 * CHUNK_PX;
    const camY = 2 * CHUNK_PX;
    reg.update(camX, camY, VIEW_W, VIEW_H);

    // Le chunk de la caméra doit être présent
    const { cx, cy } = pixelToChunk(camX, camY);
    expect(reg.getAll().has(chunkKey(cx, cy))).toBe(true);

    // Les chunks à ±radius autour doivent aussi être présents
    for (let dcx = -CHUNK_LOAD_RADIUS; dcx <= CHUNK_LOAD_RADIUS; dcx++) {
      for (let dcy = -CHUNK_LOAD_RADIUS; dcy <= CHUNK_LOAD_RADIUS; dcy++) {
        const tcx = cx + dcx;
        const tcy = cy + dcy;
        if (tcx < 0 || tcy < 0 || tcx >= CHUNKS_PER_AXIS || tcy >= CHUNKS_PER_AXIS) continue;
        expect(reg.getAll().has(chunkKey(tcx, tcy))).toBe(true);
      }
    }
  });
});
