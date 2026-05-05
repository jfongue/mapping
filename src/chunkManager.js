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
export const CHUNK_CELLS      = 10;   // cellules par côté
export const CHUNK_PX         = CHUNK_CELLS * GRID_STEP;   // 500 px
export const CHUNKS_PER_AXIS  = Math.ceil(MAP_SIZE / CHUNK_PX); // 40
export const CHUNK_LOAD_RADIUS = 2;   // chunks chargés autour du viewport

// Types terrain
const T_GRASS    = 'grass';
const T_WATER    = 'water';
const T_MOUNTAIN = 'mountain';
const T_BRIDGE   = 'bridge';

const TERRAIN_SEED = 42;

// ── Helpers ─────────────────────────────────────────────────

export function chunkKey(cx, cy)      { return `${cx}_${cy}`; }
export function parseChunkKey(key)    { const [cx, cy] = key.split('_').map(Number); return { cx, cy }; }
export function pixelToChunk(px, py)  { return { cx: Math.floor(px / CHUNK_PX), cy: Math.floor(py / CHUNK_PX) }; }
export function chunkOriginPx(cx, cy) { return { x: cx * CHUNK_PX, y: cy * CHUNK_PX }; }

export function getVisibleChunkRange(camX, camY, viewW, viewH, radius = CHUNK_LOAD_RADIUS) {
  const minCx = Math.max(0, Math.floor(camX / CHUNK_PX) - radius);
  const maxCx = Math.min(CHUNKS_PER_AXIS - 1, Math.floor((camX + viewW) / CHUNK_PX) + radius);
  const minCy = Math.max(0, Math.floor(camY / CHUNK_PX) - radius);
  const maxCy = Math.min(CHUNKS_PER_AXIS - 1, Math.floor((camY + viewH) / CHUNK_PX) + radius);
  return { minCx, maxCx, minCy, maxCy };
}

export function isChunkOutOfRange(cx, cy, range, extra = 1) {
  return (
    cx < range.minCx - extra || cx > range.maxCx + extra ||
    cy < range.minCy - extra || cy > range.maxCy + extra
  );
}

// ── Génération terrain ──────────────────────────────────────

/**
 * Génère le terrain d'une tranche de grille de façon déterministe.
 * Retourne string[][] (CHUNK_CELLS × CHUNK_CELLS).
 */
export function generateTerrainSlice(startCellX, startCellY, size, seed = TERRAIN_SEED) {
  const noise = valueNoise(seed);
  const SCALE = 0.12;  // plus grand scale → biomes plus vastes sur 400×400
  const grid = [];

  for (let row = 0; row < size; row++) {
    grid[row] = [];
    for (let col = 0; col < size; col++) {
      const gx = startCellX + col;
      const gy = startCellY + row;
      // Bruit principal (relief)
      const n = noise(gx * SCALE + 100, gy * SCALE + 100);
      // Bruit secondaire (forêt)
      const n2 = noise(gx * SCALE * 0.7 + 500, gy * SCALE * 0.7 + 500);
      // Gradient circulaire doux centré sur la map (île centrale)
      const cx = (gx - CHUNKS_PER_AXIS * CHUNK_CELLS / 2) / (CHUNKS_PER_AXIS * CHUNK_CELLS / 2);
      const cy = (gy - CHUNKS_PER_AXIS * CHUNK_CELLS / 2) / (CHUNKS_PER_AXIS * CHUNK_CELLS / 2);
      const dist = Math.sqrt(cx * cx + cy * cy);
      const elevation = n - dist * 0.45;

      let type;
      if (elevation < 0.1)       type = T_WATER;
      else if (elevation < 0.22) type = T_GRASS;    // plage/lisière
      else if (elevation > 0.72) type = T_MOUNTAIN;
      else if (n2 > 0.62)        type = T_GRASS;    // forêt traitée comme herbe (coloration différente côté rendu)
      else                       type = T_GRASS;

      grid[row][col] = type;
    }
  }

  paintRiverSlice(grid, startCellX, startCellY, size, seed);
  paintBridgeSlice(grid, startCellX, startCellY, size, seed);

  return grid;
}

function paintRiverSlice(grid, startX, startY, size, seed) {
  const noise = valueNoise(seed);
  const r = rng(seed + 999);
  const TOTAL = Math.ceil(MAP_SIZE / GRID_STEP); // 400 cellules
  const NUM_RIVERS = 6; // plus de rivières sur une grande map

  for (let i = 0; i < NUM_RIVERS; i++) {
    const horizontal = r() > 0.5;
    let sx, sy, ex, ey;
    if (horizontal) {
      sx = 0; ex = TOTAL - 1;
      sy = 10 + Math.floor(r() * (TOTAL - 20));
      ey = 10 + Math.floor(r() * (TOTAL - 20));
    } else {
      sy = 0; ey = TOTAL - 1;
      sx = 10 + Math.floor(r() * (TOTAL - 20));
      ex = 10 + Math.floor(r() * (TOTAL - 20));
    }

    for (let s = 0; s < TOTAL; s++) {
      const t = s / (TOTAL - 1);
      const baseX = sx + (ex - sx) * t;
      const baseY = sy + (ey - sy) * t;
      const off = (noise(s * 0.12 + i * 50, i * 17) - 0.5) * 8;
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

function paintBridgeSlice(grid, startX, startY, size, seed) {
  const noise = valueNoise(seed);
  const r = rng(seed + 999);
  const TOTAL = Math.ceil(MAP_SIZE / GRID_STEP);
  const NUM_RIVERS = 6;

  for (let i = 0; i < NUM_RIVERS; i++) {
    const horizontal = r() > 0.5;
    let sx, sy, ex, ey;
    if (horizontal) {
      sx = 0; ex = TOTAL - 1;
      sy = 10 + Math.floor(r() * (TOTAL - 20));
      ey = 10 + Math.floor(r() * (TOTAL - 20));
    } else {
      sy = 0; ey = TOTAL - 1;
      sx = 10 + Math.floor(r() * (TOTAL - 20));
      ex = 10 + Math.floor(r() * (TOTAL - 20));
    }

    const path = [];
    for (let s = 0; s < TOTAL; s++) {
      const t = s / (TOTAL - 1);
      const baseX = sx + (ex - sx) * t;
      const baseY = sy + (ey - sy) * t;
      const off = (noise(s * 0.12 + i * 50, i * 17) - 0.5) * 8;
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

export function generateChunk(cx, cy) {
  const startCellX = cx * CHUNK_CELLS;
  const startCellY = cy * CHUNK_CELLS;
  const grid = generateTerrainSlice(startCellX, startCellY, CHUNK_CELLS);
  const origin = chunkOriginPx(cx, cy);
  return { key: chunkKey(cx, cy), cx, cy, originPx: origin, grid };
}

// ── ChunkRegistry ───────────────────────────────────────────

export function createChunkRegistry() {
  let loaded = new Map();

  return {
    update(camX, camY, viewW, viewH) {
      const range = getVisibleChunkRange(camX, camY, viewW, viewH);
      for (let cy = range.minCy; cy <= range.maxCy; cy++) {
        for (let cx = range.minCx; cx <= range.maxCx; cx++) {
          const key = chunkKey(cx, cy);
          if (!loaded.has(key)) loaded.set(key, generateChunk(cx, cy));
        }
      }
      for (const [key, chunk] of loaded) {
        if (isChunkOutOfRange(chunk.cx, chunk.cy, range, 1)) loaded.delete(key);
      }
      return loaded;
    },

    getChunkAt(px, py) {
      const { cx, cy } = pixelToChunk(px, py);
      return loaded.get(chunkKey(cx, cy));
    },

    getTileAt(px, py) {
      const chunk = this.getChunkAt(px, py);
      if (!chunk) return null;
      const localCol = Math.floor((px - chunk.originPx.x) / GRID_STEP);
      const localRow = Math.floor((py - chunk.originPx.y) / GRID_STEP);
      return chunk.grid[localRow]?.[localCol] ?? null;
    },

    getAll() { return loaded; },
    clear()  { loaded = new Map(); },
  };
}
