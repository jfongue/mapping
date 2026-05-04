import {
  MAP_TILES, MAP_SIZE, TILE, SEED,
  T_GRASS, T_WATER, T_MOUNTAIN, T_BRIDGE,
  ZONE_W, ZONE_H,
} from './constants';
import { rng, valueNoise } from './random';

// Génère le terrain complet :
//   - Montagnes via bruit haut
//   - 3 rivières sinueuses traversant la map
//   - Ponts espacés sur chaque rivière
// Renvoie { grid, visGrid } (visGrid = grid pour l'instant, séparé pour future différenciation).
export function generateTerrain(seed = SEED) {
  const noise = valueNoise(seed);
  const grid = Array.from({ length: MAP_TILES }, () => new Array(MAP_TILES).fill(T_GRASS));

  paintMountains(grid, noise);
  const rivers = paintRivers(grid, seed, noise);
  paintBridges(grid, rivers, seed);
  ensureSpawnArea(grid);

  return { grid, visGrid: grid };
}

function paintMountains(grid, noise) {
  const SCALE = 0.15;
  for (let y = 0; y < MAP_TILES; y++) {
    for (let x = 0; x < MAP_TILES; x++) {
      if (noise(x * SCALE + 100, y * SCALE + 100) > 0.7) {
        grid[y][x] = T_MOUNTAIN;
      }
    }
  }
}

function paintRivers(grid, seed, noise) {
  const r = rng(seed + 999);
  const rivers = [];
  const NUM_RIVERS = 3;

  for (let i = 0; i < NUM_RIVERS; i++) {
    const horizontal = r() > 0.5;
    let sx, sy, ex, ey;
    if (horizontal) {
      sx = 0; ex = MAP_TILES - 1;
      sy = 5 + Math.floor(r() * (MAP_TILES - 10));
      ey = 5 + Math.floor(r() * (MAP_TILES - 10));
    } else {
      sy = 0; ey = MAP_TILES - 1;
      sx = 5 + Math.floor(r() * (MAP_TILES - 10));
      ex = 5 + Math.floor(r() * (MAP_TILES - 10));
    }

    const path = [];
    for (let s = 0; s < MAP_TILES; s++) {
      const t = s / (MAP_TILES - 1);
      const baseX = sx + (ex - sx) * t;
      const baseY = sy + (ey - sy) * t;
      const off = (noise(s * 0.15 + i * 50, i * 17) - 0.5) * 6;
      path.push({
        x: Math.round(horizontal ? baseX : baseX + off),
        y: Math.round(horizontal ? baseY + off : baseY),
      });
    }
    rivers.push(path);

    // Peindre rivière (épaisseur 2)
    for (const p of path) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 1) continue;
          const nx = p.x + dx, ny = p.y + dy;
          if (nx < 0 || ny < 0 || nx >= MAP_TILES || ny >= MAP_TILES) continue;
          if (grid[ny][nx] !== T_MOUNTAIN) grid[ny][nx] = T_WATER;
        }
      }
    }
  }
  return rivers;
}

function paintBridges(grid, rivers, seed) {
  for (const river of rivers) {
    for (let i = 8; i < river.length; i += 10 + Math.floor(rng(seed + i)() * 5)) {
      const p = river[i];
      if (p.x < 1 || p.y < 1 || p.x >= MAP_TILES - 1 || p.y >= MAP_TILES - 1) continue;
      grid[p.y][p.x] = T_BRIDGE;
    }
  }
}

function ensureSpawnArea(grid) {
  const cx = Math.floor(MAP_TILES / 2);
  const cy = Math.floor(MAP_TILES / 2);
  for (let y = cy - 2; y <= cy + 2; y++) {
    for (let x = cx - 2; x <= cx + 2; x++) {
      if (y >= 0 && y < MAP_TILES && x >= 0 && x < MAP_TILES) grid[y][x] = T_GRASS;
    }
  }
}

// Cellule passable = herbe ou pont.
export function isPassable(grid, x, y) {
  if (x < 0 || y < 0 || x >= MAP_TILES || y >= MAP_TILES) return false;
  const t = grid[y][x];
  return t === T_GRASS || t === T_BRIDGE;
}

// Trouve la cellule passable la plus proche d'une cible (recherche en spirale).
export function nearestPassable(grid, tx, ty, maxRadius = 8) {
  if (isPassable(grid, tx, ty)) return { x: tx, y: ty };
  for (let r = 1; r < maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isPassable(grid, tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy };
      }
    }
  }
  return null;
}
