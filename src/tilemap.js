// Système de tiles : map unique (data hard-codé pour l'instant) + pathfinding BFS.

export const TILES = {
  WATER: 0,
  BEACH: 1,
  PLAIN: 2,
  FOREST: 3,
  ROCK: 4,
  VOLCANO: 5,
};

export const WALKABLE = {
  0: false, // water
  1: true,  // beach
  2: true,  // plain
  3: true,  // forest
  4: false, // rock
  5: false, // volcano
};

// Coût de marche par tile (1 = normal). Forêt = 1/0.75 = 1.33 (plus lent).
export const WALK_COST = {
  1: 1.0,
  2: 1.0,
  3: 1.33, // forêt 0.75x speed
};

// Vitesse multiplicative (pour calculer la durée réelle de traversée d'une tile).
export const SPEED_MUL_TILE = {
  1: 1.0,
  2: 1.0,
  3: 0.75,
};

// Couleurs par tile (palette pastel — POC).
export const TILE_COLORS = {
  0: '#bce0e8', // water (pastel)
  1: '#faead0', // beach
  2: '#e0eaa8', // plain
  3: '#9ec99e', // forest
  4: '#bcb6b0', // rock
  5: '#8a7a7e', // volcano
};

export const TILE_PX = 50; // 1 tile = 50 px

// Map de démo 40×40 : île centrale, eau autour, forêts, montagnes au nord.
// Construction : algorithme simple basé sur distance au centre + bruit fixe.
export const MAP_W = 40;
export const MAP_H = 40;

// PRNG seedé déterministe.
function makeRand(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Bruit lissé par cellule (interpolation bilinéaire d'une grille basse résolution).
function smoothedNoise(W, H, scale, rand) {
  const lowW = Math.ceil(W / scale) + 2;
  const lowH = Math.ceil(H / scale) + 2;
  const low = new Float32Array(lowW * lowH);
  for (let i = 0; i < low.length; i++) low[i] = rand();
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = x / scale, fy = y / scale;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy;
      const a = low[iy * lowW + ix];
      const b = low[iy * lowW + (ix + 1)];
      const c = low[(iy + 1) * lowW + ix];
      const d = low[(iy + 1) * lowW + (ix + 1)];
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      out[y * W + x] = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
    }
  }
  return out;
}

function buildDemoMap() {
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  const maxR = Math.min(MAP_W, MAP_H) / 2;

  const rand = makeRand(1234);
  // Bruit doux : grosse échelle = grosses zones cohérentes
  const noiseElev = smoothedNoise(MAP_W, MAP_H, 8, rand);
  const noiseBiome = smoothedNoise(MAP_W, MAP_H, 6, makeRand(5678));

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      // FIX: renamed from dx/dy → ndx/ndy to avoid TDZ conflict with spawn-patch loop below
      const ndx = (x - cx) / maxR;
      const ndy = (y - cy) / maxR;
      const d = Math.sqrt(ndx * ndx + ndy * ndy);
      const ne = noiseElev[y * MAP_W + x];
      const nb = noiseBiome[y * MAP_W + x];
      const elevation = 1 - d + (ne - 0.5) * 0.5;

      let t;
      if (elevation < -0.02) t = TILES.WATER;
      else if (elevation < 0.1) t = TILES.BEACH;
      else if (elevation > 0.55 && nb > 0.55) t = TILES.ROCK;
      else if (nb > 0.62 && elevation > 0.2) t = TILES.FOREST;
      else t = TILES.PLAIN;

      tiles[y * MAP_W + x] = t;
    }
  }

  // 2 passes de "majority filter" : chaque tile prend le type majoritaire de ses voisins.
  // Réduit les blocs isolés → grosses zones nettes.
  const tmp = new Uint8Array(MAP_W * MAP_H);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const counts = {};
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
            const tt = tiles[ny * MAP_W + nx];
            counts[tt] = (counts[tt] || 0) + 1;
          }
        }
        let best = tiles[y * MAP_W + x], bestCount = 0;
        for (const k in counts) {
          if (counts[k] > bestCount) { bestCount = counts[k]; best = +k; }
        }
        tmp[y * MAP_W + x] = best;
      }
    }
    tiles.set(tmp);
  }

  // Spawn central garanti
  const sx = Math.floor(MAP_W / 2);
  const sy = Math.floor(MAP_H / 2);
  for (let oy = -2; oy <= 2; oy++) {
    for (let ox = -2; ox <= 2; ox++) {
      tiles[(sy + oy) * MAP_W + (sx + ox)] = TILES.PLAIN;
    }
  }

  return tiles;
}

export const TILES_DATA = buildDemoMap();

// === Pathfinding Dijkstra avec coûts (forêt = plus lente) ===
export function findPath(tiles, W, H, sx, sy, tx, ty) {
  sx = Math.round(sx); sy = Math.round(sy);
  tx = Math.round(tx); ty = Math.round(ty);
  if (sx === tx && sy === ty) return [{ x: tx, y: ty }];
  if (tx < 0 || tx >= W || ty < 0 || ty >= H) return null;

  if (!WALKABLE[tiles[ty * W + tx]]) {
    let best = null, bestD = Infinity;
    for (let r = 1; r < 6; r++) {
      for (let yy = ty - r; yy <= ty + r; yy++) {
        for (let xx = tx - r; xx <= tx + r; xx++) {
          if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
          if (WALKABLE[tiles[yy * W + xx]]) {
            const d = Math.hypot(xx - tx, yy - ty);
            if (d < bestD) { bestD = d; best = { x: xx, y: yy }; }
          }
        }
      }
      if (best) break;
    }
    if (!best) return null;
    tx = best.x; ty = best.y;
  }

  // Dijkstra simple (queue triée à chaque pop : O(n²) mais ok pour 40×40)
  const dist = new Float32Array(W * H);
  for (let i = 0; i < dist.length; i++) dist[i] = Infinity;
  const prev = new Int32Array(W * H); prev.fill(-1);
  const inQueue = new Uint8Array(W * H);

  const startIdx = sy * W + sx;
  dist[startIdx] = 0;
  const queue = new Set([startIdx]);
  inQueue[startIdx] = 1;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
  const targetIdx = ty * W + tx;
  let found = false;

  while (queue.size > 0) {
    // pop le min
    let bestIdx = -1, bestD = Infinity;
    for (const i of queue) {
      if (dist[i] < bestD) { bestD = dist[i]; bestIdx = i; }
    }
    if (bestIdx === -1) break;
    queue.delete(bestIdx);
    inQueue[bestIdx] = 0;
    if (bestIdx === targetIdx) { found = true; break; }

    const x = bestIdx % W, y = (bestIdx / W) | 0;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const ni = ny * W + nx;
      const tt = tiles[ni];
      if (!WALKABLE[tt]) continue;
      if (dx !== 0 && dy !== 0) {
        if (!WALKABLE[tiles[y * W + nx]] || !WALKABLE[tiles[ny * W + x]]) continue;
      }
      const stepDist = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
      const cost = stepDist * (WALK_COST[tt] || 1);
      const nd = dist[bestIdx] + cost;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        prev[ni] = bestIdx;
        if (!inQueue[ni]) { queue.add(ni); inQueue[ni] = 1; }
      }
    }
  }
  if (!found) return null;

  const path = [];
  let cur = targetIdx;
  while (cur !== -1) {
    path.push({ x: cur % W, y: (cur / W) | 0 });
    cur = prev[cur];
  }
  path.reverse();
  return path; // pas de simplification : on veut garder les détours autour de la forêt
}

function simplifyPath(path, tiles, W) {
  if (path.length <= 2) return path;
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    while (j > i + 1) {
      if (lineOfSight(path[i], path[j], tiles, W)) break;
      j--;
    }
    out.push(path[j]);
    i = j;
  }
  return out;
}

function lineOfSight(a, b, tiles, W) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.round(a.x + dx * t);
    const y = Math.round(a.y + dy * t);
    if (!WALKABLE[tiles[y * W + x]]) return false;
  }
  return true;
}
