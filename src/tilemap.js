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

// Map de démo 128×128 (~10× plus grande en surface, 3.2× en longueur) :
// île centrale, eau autour, forêts, montagnes.
// 128*50 = 6400 px : reste sous les limites texture GPU (iOS ~8192 px).
export const MAP_W = 128;
export const MAP_H = 128;

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
  // Bruit doux : grosse échelle = grosses zones cohérentes (échelle proportionnelle à la map)
  const noiseElev = smoothedNoise(MAP_W, MAP_H, MAP_W / 5, rand);
  const noiseBiome = smoothedNoise(MAP_W, MAP_H, MAP_W / 7, makeRand(5678));

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
  // Counts en typed array (6 types fixes) : pas d'allocation d'objet par tile.
  const tmp = new Uint8Array(MAP_W * MAP_H);
  const counts = new Uint8Array(6);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        counts.fill(0);
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
            counts[tiles[ny * MAP_W + nx]]++;
          }
        }
        let best = tiles[y * MAP_W + x], bestCount = 0;
        for (let k = 0; k < 6; k++) {
          if (counts[k] > bestCount) { bestCount = counts[k]; best = k; }
        }
        tmp[y * MAP_W + x] = best;
      }
    }
    tiles.set(tmp);
  }

  // Spawn central garanti (zone large, proportionnelle à la map)
  const sx = Math.floor(MAP_W / 2);
  const sy = Math.floor(MAP_H / 2);
  const spawnR = Math.max(3, Math.floor(MAP_W / 50));
  for (let oy = -spawnR; oy <= spawnR; oy++) {
    for (let ox = -spawnR; ox <= spawnR; ox++) {
      const xx = sx + ox, yy = sy + oy;
      if (xx < 0 || xx >= MAP_W || yy < 0 || yy >= MAP_H) continue;
      tiles[yy * MAP_W + xx] = TILES.PLAIN;
    }
  }

  return tiles;
}

export const TILES_DATA = buildDemoMap();

// === Pathfinding A* + tas binaire (scalable jusqu'à grandes maps) ===
// Heuristique : distance octile (admissible avec déplacements diagonaux).
function octile(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
}

// Tas binaire min, items = [priority, idx]
class MinHeap {
  constructor() { this.a = []; }
  push(item) {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[i][0] < a[p][0]) { const t = a[i]; a[i] = a[p]; a[p] = t; i = p; } else break;
    }
  }
  pop() {
    const a = this.a;
    if (a.length === 0) return null;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0, n = a.length;
      while (true) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let best = i;
        if (l < n && a[l][0] < a[best][0]) best = l;
        if (r < n && a[r][0] < a[best][0]) best = r;
        if (best !== i) { const t = a[i]; a[i] = a[best]; a[best] = t; i = best; } else break;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

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

  const N = W * H;
  const gScore = new Float32Array(N);
  for (let i = 0; i < N; i++) gScore[i] = Infinity;
  const prev = new Int32Array(N); prev.fill(-1);
  const closed = new Uint8Array(N);

  const startIdx = sy * W + sx;
  const targetIdx = ty * W + tx;
  gScore[startIdx] = 0;
  const open = new MinHeap();
  open.push([octile(sx, sy, tx, ty), startIdx]);

  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
  let found = false;

  while (open.size > 0) {
    const [, idx] = open.pop();
    if (closed[idx]) continue;
    if (idx === targetIdx) { found = true; break; }
    closed[idx] = 1;

    const x = idx % W, y = (idx / W) | 0;
    const gCur = gScore[idx];
    for (let d = 0; d < 8; d++) {
      const dx = dirs[d][0], dy = dirs[d][1];
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const ni = ny * W + nx;
      if (closed[ni]) continue;
      const tt = tiles[ni];
      if (!WALKABLE[tt]) continue;
      if (dx !== 0 && dy !== 0) {
        if (!WALKABLE[tiles[y * W + nx]] || !WALKABLE[tiles[ny * W + x]]) continue;
      }
      const stepDist = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
      const cost = stepDist * (WALK_COST[tt] || 1);
      const ng = gCur + cost;
      if (ng < gScore[ni]) {
        gScore[ni] = ng;
        prev[ni] = idx;
        const f = ng + octile(nx, ny, tx, ty);
        open.push([f, ni]);
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
  return path;
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
