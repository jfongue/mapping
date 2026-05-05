import {
  MAP_TILES, SEED,
  T_GRASS, T_WATER, T_MOUNTAIN, T_BRIDGE, T_FOREST,
} from './constants';
import { rng, valueNoise } from './random';

// Génère le terrain complet :
//   - Eau tout autour (bordure 2 cells)
//   - Lacs via bruit au centre
//   - Clusters de montagnes (germes + flood-fill bruit)
//   - Clusters de forêts (même approche, bruit différent)
//   - Rivières sinueuses depuis les montagnes
//   - Ponts espacés sur chaque rivière
export function generateTerrain(seed = SEED) {
  const noiseM = valueNoise(seed);          // bruit montagnes
  const noiseF = valueNoise(seed + 1337);   // bruit forêts
  const noiseL = valueNoise(seed + 4242);   // bruit lacs
  const grid = Array.from({ length: MAP_TILES }, () => new Array(MAP_TILES).fill(T_GRASS));

  paintBorder(grid);
  paintLakes(grid, noiseL);
  paintMountainClusters(grid, noiseM, seed);
  paintForestClusters(grid, noiseF, seed);
  const rivers = paintRivers(grid, seed, noiseM);
  paintBridges(grid, rivers, seed);
  ensureSpawnArea(grid);

  return { grid, visGrid: grid };
}

// --- Bordure eau (2 cells tout autour) ---
function paintBorder(grid) {
  const B = 2;
  for (let y = 0; y < MAP_TILES; y++) {
    for (let x = 0; x < MAP_TILES; x++) {
      if (x < B || x >= MAP_TILES - B || y < B || y >= MAP_TILES - B) {
        grid[y][x] = T_WATER;
      }
    }
  }
}

// --- Lacs intérieurs via bruit (zones isolées, éloignées des bords) ---
function paintLakes(grid, noise) {
  const SCALE = 0.09;
  const MARGIN = 6;
  for (let y = MARGIN; y < MAP_TILES - MARGIN; y++) {
    for (let x = MARGIN; x < MAP_TILES - MARGIN; x++) {
      const n = noise(x * SCALE + 200, y * SCALE + 200);
      if (n > 0.82) grid[y][x] = T_WATER;
    }
  }
}

// --- Clusters de montagnes (petits groupes cohérents) ---
function paintMountainClusters(grid, noise, seed) {
  const r = rng(seed + 111);
  const SCALE = 0.18;
  const NUM_CLUSTERS = 8;
  const CLUSTER_RADIUS = 4;   // rayon max d'un cluster (cells)
  const MARGIN = 5;

  for (let c = 0; c < NUM_CLUSTERS; c++) {
    const cx = MARGIN + Math.floor(r() * (MAP_TILES - MARGIN * 2));
    const cy = MARGIN + Math.floor(r() * (MAP_TILES - MARGIN * 2));

    for (let dy = -CLUSTER_RADIUS; dy <= CLUSTER_RADIUS; dy++) {
      for (let dx = -CLUSTER_RADIUS; dx <= CLUSTER_RADIUS; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < MARGIN || y < MARGIN || x >= MAP_TILES - MARGIN || y >= MAP_TILES - MARGIN) continue;
        if (grid[y][x] === T_WATER) continue;
        // Bruit local pour rendre le cluster irrégulier
        const localN = noise(x * SCALE + 100, y * SCALE + 100);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= CLUSTER_RADIUS * localN * 1.4) {
          grid[y][x] = T_MOUNTAIN;
        }
      }
    }
  }
}

// --- Clusters de forêts (plus nombreux, plus petits) ---
function paintForestClusters(grid, noise, seed) {
  const r = rng(seed + 555);
  const SCALE = 0.20;
  const NUM_CLUSTERS = 14;
  const CLUSTER_RADIUS = 3;
  const MARGIN = 4;

  for (let c = 0; c < NUM_CLUSTERS; c++) {
    const cx = MARGIN + Math.floor(r() * (MAP_TILES - MARGIN * 2));
    const cy = MARGIN + Math.floor(r() * (MAP_TILES - MARGIN * 2));

    for (let dy = -CLUSTER_RADIUS; dy <= CLUSTER_RADIUS; dy++) {
      for (let dx = -CLUSTER_RADIUS; dx <= CLUSTER_RADIUS; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < MARGIN || y < MARGIN || x >= MAP_TILES - MARGIN || y >= MAP_TILES - MARGIN) continue;
        if (grid[y][x] === T_WATER || grid[y][x] === T_MOUNTAIN) continue;
        const localN = noise(x * SCALE + 300, y * SCALE + 300);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= CLUSTER_RADIUS * localN * 1.5) {
          grid[y][x] = T_FOREST;
        }
      }
    }
  }
}

// --- Rivières sinueuses (partent d'un point intérieur, coulent vers un bord) ---
function paintRivers(grid, seed, noise) {
  const r = rng(seed + 999);
  const rivers = [];
  const NUM_RIVERS = 4;
  const MARGIN = 4;

  for (let i = 0; i < NUM_RIVERS; i++) {
    // Point de départ intérieur, point d'arrivée sur un bord
    const sx = MARGIN + Math.floor(r() * (MAP_TILES - MARGIN * 2));
    const sy = MARGIN + Math.floor(r() * (MAP_TILES - MARGIN * 2));
    const side = Math.floor(r() * 4); // 0=haut 1=bas 2=gauche 3=droite
    let ex, ey;
    switch (side) {
      case 0: ex = Math.floor(r() * MAP_TILES); ey = 0; break;
      case 1: ex = Math.floor(r() * MAP_TILES); ey = MAP_TILES - 1; break;
      case 2: ex = 0; ey = Math.floor(r() * MAP_TILES); break;
      default: ex = MAP_TILES - 1; ey = Math.floor(r() * MAP_TILES); break;
    }

    const path = [];
    const steps = MAP_TILES;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const baseX = sx + (ex - sx) * t;
      const baseY = sy + (ey - sy) * t;
      const off = (noise(s * 0.13 + i * 50, i * 17) - 0.5) * 7;
      const dx = ex - sx, dy2 = ey - sy;
      const len = Math.sqrt(dx * dx + dy2 * dy2) || 1;
      // Perpendiculaire au chemin pour l'offset
      path.push({
        x: Math.round(Math.max(0, Math.min(MAP_TILES - 1, baseX + off * (-dy2 / len)))),
        y: Math.round(Math.max(0, Math.min(MAP_TILES - 1, baseY + off * (dx / len)))),
      });
    }
    rivers.push(path);

    // Peindre rivière (épaisseur 2, en croix)
    for (const p of path) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let ddx = -1; ddx <= 1; ddx++) {
          if (Math.abs(ddx) + Math.abs(dy) > 1) continue;
          const nx = p.x + ddx, ny = p.y + dy;
          if (nx < 0 || ny < 0 || nx >= MAP_TILES || ny >= MAP_TILES) continue;
          grid[ny][nx] = T_WATER;
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

// Cellule passable = herbe, forêt ou pont.
export function isPassable(grid, x, y) {
  if (x < 0 || y < 0 || x >= MAP_TILES || y >= MAP_TILES) return false;
  const t = grid[y][x];
  return t === T_GRASS || t === T_BRIDGE || t === T_FOREST;
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
