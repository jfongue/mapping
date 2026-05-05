// Système de tiles : map 128×128 procédurale + pathfinding A*.

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

export const WALK_COST = {
  1: 1.0,
  2: 1.0,
  3: 1.33,
};

export const SPEED_MUL_TILE = {
  1: 1.0,
  2: 1.0,
  3: 0.75,
};

export const TILE_COLORS = {
  0: '#bce0e8', // water
  1: '#faead0', // beach
  2: '#e0eaa8', // plain
  3: '#9ec99e', // forest
  4: '#bcb6b0', // rock
  5: '#8a7a7e', // volcano
};

export const TILE_PX = 50;
export const MAP_W = 128;
export const MAP_H = 128;

// PRNG seedé déterministe (LCG)
function makeRand(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Bruit lissé par interpolation bilinéaire (smooth)
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

  // Étape 1 : tout en plain par défaut
  tiles.fill(TILES.PLAIN);

  // Étape 2 : eau en bordure (3 cells tout autour)
  const BORDER = 3;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (x < BORDER || x >= MAP_W - BORDER || y < BORDER || y >= MAP_H - BORDER) {
        tiles[y * MAP_W + x] = TILES.WATER;
      }
    }
  }

  // Étape 3 : clusters de ROCK (montagnes) — petits groupes irréguliers
  {
    const rand = makeRand(4321);
    const noiseMtn = smoothedNoise(MAP_W, MAP_H, MAP_W / 14, makeRand(9999));
    const NUM_CLUSTERS = 10;
    const MAX_R = 5;
    const MARGIN = BORDER + 2;
    for (let c = 0; c < NUM_CLUSTERS; c++) {
      const cx = MARGIN + Math.floor(rand() * (MAP_W - MARGIN * 2));
      const cy = MARGIN + Math.floor(rand() * (MAP_H - MARGIN * 2));
      const clusterR = 2 + Math.floor(rand() * (MAX_R - 2));
      for (let dy = -clusterR; dy <= clusterR; dy++) {
        for (let dx = -clusterR; dx <= clusterR; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < MARGIN || y < MARGIN || x >= MAP_W - MARGIN || y >= MAP_H - MARGIN) continue;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const n = noiseMtn[y * MAP_W + x];
          if (dist <= clusterR * (0.5 + n * 0.6)) {
            tiles[y * MAP_W + x] = TILES.ROCK;
          }
        }
      }
    }
    // 2 volcans — clusters très petits
    for (let v = 0; v < 2; v++) {
      const cx = MARGIN + Math.floor(rand() * (MAP_W - MARGIN * 2));
      const cy = MARGIN + Math.floor(rand() * (MAP_H - MARGIN * 2));
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < MARGIN || y < MARGIN || x >= MAP_W - MARGIN || y >= MAP_H - MARGIN) continue;
          if (Math.sqrt(dx * dx + dy * dy) <= 2) tiles[y * MAP_W + x] = TILES.VOLCANO;
        }
      }
    }
  }

  // Étape 4 : clusters de FOREST — plus nombreux, plus petits
  {
    const rand = makeRand(7777);
    const noiseFor = smoothedNoise(MAP_W, MAP_H, MAP_W / 16, makeRand(3333));
    const NUM_CLUSTERS = 16;
    const MAX_R = 4;
    const MARGIN = BORDER + 2;
    for (let c = 0; c < NUM_CLUSTERS; c++) {
      const cx = MARGIN + Math.floor(rand() * (MAP_W - MARGIN * 2));
      const cy = MARGIN + Math.floor(rand() * (MAP_H - MARGIN * 2));
      const clusterR = 2 + Math.floor(rand() * (MAX_R - 2));
      for (let dy = -clusterR; dy <= clusterR; dy++) {
        for (let dx = -clusterR; dx <= clusterR; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < MARGIN || y < MARGIN || x >= MAP_W - MARGIN || y >= MAP_H - MARGIN) continue;
          // Ne pas écraser l'eau ou les rochers
          const t = tiles[y * MAP_W + x];
          if (t === TILES.WATER || t === TILES.ROCK || t === TILES.VOLCANO) continue;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const n = noiseFor[y * MAP_W + x];
          if (dist <= clusterR * (0.5 + n * 0.6)) {
            tiles[y * MAP_W + x] = TILES.FOREST;
          }
        }
      }
    }
  }

  // Étape 5 : lacs intérieurs (zones d'eau isolées, loin des bords)
  {
    const noiseLake = smoothedNoise(MAP_W, MAP_H, MAP_W / 10, makeRand(6543));
    const LAKE_MARGIN = BORDER + 6;
    for (let y = LAKE_MARGIN; y < MAP_H - LAKE_MARGIN; y++) {
      for (let x = LAKE_MARGIN; x < MAP_W - LAKE_MARGIN; x++) {
        if (noiseLake[y * MAP_W + x] > 0.78) {
          tiles[y * MAP_W + x] = TILES.WATER;
        }
      }
    }
  }

  // Étape 6 : rivières sinueuses (de l'intérieur vers un bord)
  {
    const rand = makeRand(1122);
    const noiseRiv = smoothedNoise(MAP_W, MAP_H, MAP_W / 12, makeRand(8888));
    const NUM_RIVERS = 3;
    const MARGIN = BORDER + 4;

    for (let i = 0; i < NUM_RIVERS; i++) {
      const sx = MARGIN + Math.floor(rand() * (MAP_W - MARGIN * 2));
      const sy = MARGIN + Math.floor(rand() * (MAP_H - MARGIN * 2));
      const side = Math.floor(rand() * 4);
      let ex, ey;
      switch (side) {
        case 0: ex = Math.floor(rand() * MAP_W); ey = 0; break;
        case 1: ex = Math.floor(rand() * MAP_W); ey = MAP_H - 1; break;
        case 2: ex = 0; ey = Math.floor(rand() * MAP_H); break;
        default: ex = MAP_W - 1; ey = Math.floor(rand() * MAP_H); break;
      }

      const steps = MAP_W;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const baseX = sx + (ex - sx) * t;
        const baseY = sy + (ey - sy) * t;
        const ddx = ex - sx, ddy = ey - sy;
        const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        const off = (noiseRiv[Math.min(MAP_W * MAP_H - 1, Math.floor(baseY) * MAP_W + Math.floor(baseX))] - 0.5) * 8;
        const px = Math.round(Math.max(0, Math.min(MAP_W - 1, baseX + off * (-ddy / len))));
        const py = Math.round(Math.max(0, Math.min(MAP_H - 1, baseY + off * (ddx / len))));
        // Épaisseur 1 (croix 4-connexe)
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (Math.abs(ox) + Math.abs(oy) > 1) continue;
            const nx = px + ox, ny = py + oy;
            if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
            tiles[ny * MAP_W + nx] = TILES.WATER;
          }
        }
      }
    }
  }

  // Étape 7 : majority filter (2 passes) pour lisser les frontières
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

  // Étape 8 : rétablir la bordure eau après le lissage
  const BORDER_FINAL = 2;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (x < BORDER_FINAL || x >= MAP_W - BORDER_FINAL || y < BORDER_FINAL || y >= MAP_H - BORDER_FINAL) {
        tiles[y * MAP_W + x] = TILES.WATER;
      }
    }
  }

  // Étape 9 : spawn central garanti en PLAIN
  const spawnX = Math.floor(MAP_W / 2);
  const spawnY = Math.floor(MAP_H / 2);
  const spawnR = Math.max(3, Math.floor(MAP_W / 50));
  for (let oy = -spawnR; oy <= spawnR; oy++) {
    for (let ox = -spawnR; ox <= spawnR; ox++) {
      const xx = spawnX + ox, yy = spawnY + oy;
      if (xx < 0 || xx >= MAP_W || yy < 0 || yy >= MAP_H) continue;
      tiles[yy * MAP_W + xx] = TILES.PLAIN;
    }
  }

  return tiles;
}

export const TILES_DATA = buildDemoMap();

// === Pathfinding A* + tas binaire ===
function octile(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
}

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
      const ddx = dirs[d][0], ddy = dirs[d][1];
      const nx = x + ddx, ny = y + ddy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const ni = ny * W + nx;
      if (closed[ni]) continue;
      const tt = tiles[ni];
      if (!WALKABLE[tt]) continue;
      if (ddx !== 0 && ddy !== 0) {
        if (!WALKABLE[tiles[y * W + nx]] || !WALKABLE[tiles[ny * W + x]]) continue;
      }
      const stepDist = (ddx !== 0 && ddy !== 0) ? Math.SQRT2 : 1;
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
