// ============================================================
// chunkManager.js — Système de chargement par chunks
// ============================================================
// Un chunk = CHUNK_CELLS × CHUNK_CELLS cellules de terrain.
// Seuls les chunks dans le rayon visible + marge sont gardés
// en mémoire ; les autres sont purgés.
// La génération est déterministe : même seed → même chunk.
// ============================================================

import { MAP_SIZE, GRID_STEP } from './constants';
import { rng, valueNoise } from './random';

// ── Constantes chunk ────────────────────────────────────────
export const CHUNK_CELLS   = 10;   // cellules par côté d'un chunk
export const CHUNK_PX      = CHUNK_CELLS * GRID_STEP;  // taille en px
export const CHUNKS_PER_AXIS = Math.ceil(MAP_SIZE / CHUNK_PX);
export const CHUNK_LOAD_RADIUS = 2; // chunks chargés autour du viewport

// Types terrain (cohérents avec terrain.js)
const T_GRASS    = 'grass';
const T_WATER    = 'water';
const T_MOUNTAIN = 'mountain';
const T_BRIDGE   = 'bridge';

const TERRAIN_SEED = 42;

// ── Helpers ─────────────────────────────────────────────────

/** Clé unique string pour un chunk (cx, cy). */
export function chunkKey(cx, cy) {
  return `${cx}_${cy}`;
}

/** Décode une clé en {cx, cy}. */
export function parseChunkKey(key) {
  const [cx, cy] = key.split('_').map(Number);
  return { cx, cy };
}

/**
 * Coordonnées pixel → coordonnées chunk.
 * @param {number} px  position X en pixels
 * @param {number} py  position Y en pixels
 * @returns {{ cx: number, cy: number }}
 */
export function pixelToChunk(px, py) {
  return {
    cx: Math.floor(px / CHUNK_PX),
    cy: Math.floor(py / CHUNK_PX),
  };
}

/**
 * Coordonnées chunk → coin supérieur-gauche en pixels.
 */
export function chunkOriginPx(cx, cy) {
  return { x: cx * CHUNK_PX, y: cy * CHUNK_PX };
}

/**
 * Calcule la plage de chunks à charger pour un viewport donné.
 * @param {number} camX   coin gauche de la caméra (px)
 * @param {number} camY   coin haut de la caméra (px)
 * @param {number} viewW  largeur du viewport (px)
 * @param {number} viewH  hauteur du viewport (px)
 * @param {number} [radius=CHUNK_LOAD_RADIUS]
 * @returns {{ minCx, maxCx, minCy, maxCy }}
 */
export function getVisibleChunkRange(camX, camY, viewW, viewH, radius = CHUNK_LOAD_RADIUS) {
  const minCx = Math.max(0, Math.floor(camX / CHUNK_PX) - radius);
  const maxCx = Math.min(CHUNKS_PER_AXIS - 1, Math.floor((camX + viewW) / CHUNK_PX) + radius);
  const minCy = Math.max(0, Math.floor(camY / CHUNK_PX) - radius);
  const maxCy = Math.min(CHUNKS_PER_AXIS - 1, Math.floor((camY + viewH) / CHUNK_PX) + radius);
  return { minCx, maxCx, minCy, maxCy };
}

/**
 * Retourne true si le chunk (cx, cy) est hors de la plage
 * élargie par `extra` chunks.
 */
export function isChunkOutOfRange(cx, cy, range, extra = 1) {
  return (
    cx < range.minCx - extra ||
    cx > range.maxCx + extra ||
    cy < range.minCy - extra ||
    cy > range.maxCy + extra
  );
}

// ── Génération terrain ──────────────────────────────────────

/**
 * Génère le terrain d'une tranche de grille.
 * Fonctionne pour n'importe quel offset → déterministe par seed.
 *
 * @param {number} startCellX  colonne de départ (index cellule global)
 * @param {number} startCellY  ligne de départ
 * @param {number} size        nombre de cellules par côté
 * @param {number} [seed]
 * @returns {string[][]}  grille [row][col] de types terrain
 */
export function generateTerrainSlice(startCellX, startCellY, size, seed = TERRAIN_SEED) {
  const noise = valueNoise(seed);
  const SCALE = 0.15;
  const grid = [];

  for (let row = 0; row < size; row++) {
    grid[row] = [];
    for (let col = 0; col < size; col++) {
      const gx = startCellX + col;
      const gy = startCellY + row;
      const n = noise(gx * SCALE + 100, gy * SCALE + 100);
      grid[row][col] = n > 0.7 ? T_MOUNTAIN : T_GRASS;
    }
  }

  paintRiverSlice(grid, startCellX, startCellY, size, seed);
  paintBridgeSlice(grid, startCellX, startCellY, size, seed);

  return grid;
}

/** Peint les pixels de rivière qui tombent dans cette tranche. */
function paintRiverSlice(grid, startX, startY, size, seed) {
  const noise = valueNoise(seed);
  const r = rng(seed + 999);
  const TOTAL = Math.ceil(MAP_SIZE / GRID_STEP);
  const NUM_RIVERS = 3;

  for (let i = 0; i < NUM_RIVERS; i++) {
    const horizontal = r() > 0.5;
    let sx, sy, ex, ey;
    if (horizontal) {
      sx = 0; ex = TOTAL - 1;
      sy = 5 + Math.floor(r() * (TOTAL - 10));
      ey = 5 + Math.floor(r() * (TOTAL - 10));
    } else {
      sy = 0; ey = TOTAL - 1;
      sx = 5 + Math.floor(r() * (TOTAL - 10));
      ex = 5 + Math.floor(r() * (TOTAL - 10));
    }

    for (let s = 0; s < TOTAL; s++) {
      const t = s / (TOTAL - 1);
      const baseX = sx + (ex - sx) * t;
      const baseY = sy + (ey - sy) * t;
      const off = (noise(s * 0.15 + i * 50, i * 17) - 0.5) * 6;
      const gx = Math.round(horizontal ? baseX : baseX + off);
      const gy = Math.round(horizontal ? baseY + off : baseY);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 1) continue;
          const wx = gx + dx - startX;
          const wy = gy + dy - startY;
          if (wx < 0 || wy < 0 || wx >= size || wy >= size) continue;
          if (grid[wy][wx] !== T_MOUNTAIN) grid[wy][wx] = T_WATER;
        }
      }
    }
  }
}

/** Peint les ponts qui tombent dans cette tranche. */
function paintBridgeSlice(grid, startX, startY, size, seed) {
  const noise = valueNoise(seed);
  const r = rng(seed + 999);
  const TOTAL = Math.ceil(MAP_SIZE / GRID_STEP);
  const NUM_RIVERS = 3;

  for (let i = 0; i < NUM_RIVERS; i++) {
    const horizontal = r() > 0.5;
    let sx, sy, ex, ey;
    if (horizontal) {
      sx = 0; ex = TOTAL - 1;
      sy = 5 + Math.floor(r() * (TOTAL - 10));
      ey = 5 + Math.floor(r() * (TOTAL - 10));
    } else {
      sy = 0; ey = TOTAL - 1;
      sx = 5 + Math.floor(r() * (TOTAL - 10));
      ex = 5 + Math.floor(r() * (TOTAL - 10));
    }

    const path = [];
    for (let s = 0; s < TOTAL; s++) {
      const t = s / (TOTAL - 1);
      const baseX = sx + (ex - sx) * t;
      const baseY = sy + (ey - sy) * t;
      const off = (noise(s * 0.15 + i * 50, i * 17) - 0.5) * 6;
      path.push({
        x: Math.round(horizontal ? baseX : baseX + off),
        y: Math.round(horizontal ? baseY + off : baseY),
      });
    }

    for (let idx = 8; idx < path.length; idx += 10 + Math.floor(rng(seed + idx)() * 5)) {
      const p = path[idx];
      const lx = p.x - startX;
      const ly = p.y - startY;
      if (lx < 0 || ly < 0 || lx >= size || ly >= size) continue;
      grid[ly][lx] = T_BRIDGE;
    }
  }
}

// ── Génération d'un chunk complet ───────────────────────────

/**
 * Génère et retourne un objet chunk complet.
 * @param {number} cx  index chunk horizontal
 * @param {number} cy  index chunk vertical
 * @returns {{ key, cx, cy, originPx, grid }}
 */
export function generateChunk(cx, cy) {
  const startCellX = cx * CHUNK_CELLS;
  const startCellY = cy * CHUNK_CELLS;
  const grid = generateTerrainSlice(startCellX, startCellY, CHUNK_CELLS);
  const origin = chunkOriginPx(cx, cy);

  return {
    key: chunkKey(cx, cy),
    cx,
    cy,
    originPx: origin,
    grid,   // string[CHUNK_CELLS][CHUNK_CELLS]
  };
}

// ── ChunkRegistry ───────────────────────────────────────────

/**
 * Gère la Map des chunks chargés.
 * Usage :
 *   const reg = createChunkRegistry();
 *   const loaded = reg.update(camX, camY, viewW, viewH);
 *   // loaded : Map<string, chunk>
 */
export function createChunkRegistry() {
  let loaded = new Map();

  return {
    /**
     * Met à jour les chunks en fonction de la position caméra.
     * Charge les nouveaux, purge les lointains.
     * @returns {Map<string, object>} la Map mise à jour (référence stable)
     */
    update(camX, camY, viewW, viewH) {
      const range = getVisibleChunkRange(camX, camY, viewW, viewH);

      // Charger les manquants
      for (let cy = range.minCy; cy <= range.maxCy; cy++) {
        for (let cx = range.minCx; cx <= range.maxCx; cx++) {
          const key = chunkKey(cx, cy);
          if (!loaded.has(key)) {
            loaded.set(key, generateChunk(cx, cy));
          }
        }
      }

      // Purger les chunks trop loin (marge de 1)
      for (const [key, chunk] of loaded) {
        if (isChunkOutOfRange(chunk.cx, chunk.cy, range, 1)) {
          loaded.delete(key);
        }
      }

      return loaded;
    },

    /** Chunk à la position pixel (x, y), ou undefined. */
    getChunkAt(px, py) {
      const { cx, cy } = pixelToChunk(px, py);
      return loaded.get(chunkKey(cx, cy));
    },

    /** Terrain type à la position pixel exacte. */
    getTileAt(px, py) {
      const chunk = this.getChunkAt(px, py);
      if (!chunk) return null;
      const localCol = Math.floor((px - chunk.originPx.x) / GRID_STEP);
      const localRow = Math.floor((py - chunk.originPx.y) / GRID_STEP);
      return chunk.grid[localRow]?.[localCol] ?? null;
    },

    /** Snapshot de la Map courante (lecture seule). */
    getAll() {
      return loaded;
    },

    /** Vide le registre (utile pour les tests). */
    clear() {
      loaded = new Map();
    },
  };
}
