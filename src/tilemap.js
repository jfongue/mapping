// Système de tiles : types, pathfinding A*, accès lazy par chunk.
// TILES_DATA n'est plus un tableau global — on lit le terrain via getChunkTile()
// ou directement via le ChunkRegistry (voir chunkManager.js).

export const TILES = {
  WATER:   0,
  BEACH:   1,
  PLAIN:   2,
  FOREST:  3,
  ROCK:    4,
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
export const MAP_W   = 400;
export const MAP_H   = 400;

// ─── Accès lazy au terrain via ChunkRegistry ─────────────────────────────────
// Le registre est injecté depuis App.js via setChunkRegistry().
// findPath() l'utilise pour lire les tiles à la demande (pas de tableau global).
let _registry = null;
export function setChunkRegistry(reg) { _registry = reg; }

/**
 * Retourne le type de tile (TILES.*) à la position cellule (cx, cy).
 * Retourne TILES.WATER si le chunk n'est pas encore chargé.
 */
export function getTileAt(cellX, cellY) {
  if (!_registry) return TILES.WATER;
  const px = cellX * TILE_PX + TILE_PX / 2;
  const py = cellY * TILE_PX + TILE_PX / 2;
  const type = _registry.getTileAt(px, py);
  // chunkManager retourne un string ('grass','water','mountain','bridge')
  // on mappe vers les constantes numériques TILES.*
  return stringToTile(type);
}

function stringToTile(s) {
  switch (s) {
    case 'water':    return TILES.WATER;
    case 'bridge':   return TILES.BEACH;   // bridge = traversable comme beach
    case 'mountain': return TILES.ROCK;
    case 'grass':    return TILES.PLAIN;
    default:         return TILES.WATER;   // chunk pas encore chargé → bloquant
  }
}

// TILES_DATA conservé comme shim vide pour éviter d'éventuels imports restants.
// Ne l'utilise plus pour le rendu ou le pathfinding.
export const TILES_DATA = null;

// === Pathfinding A* lazy (lit le terrain via getTileAt) ===
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

/**
 * Pathfinding A* sur une grille virtuelle (lecture lazy via getTileAt).
 * Limité à une zone de recherche de MAX_SEARCH cellules pour éviter les
 * calculs trop longs sur une map de 400×400.
 */
const MAX_SEARCH = 3000; // max nœuds explorés

export function findPath(tiles, W, H, sx, sy, tx, ty) {
  // tiles peut être null (mode chunk) — on utilise getTileAt() dans ce cas
  const useLazy = (tiles === null);

  sx = Math.round(sx); sy = Math.round(sy);
  tx = Math.round(tx); ty = Math.round(ty);
  if (sx === tx && sy === ty) return [{ x: tx, y: ty }];
  if (tx < 0 || tx >= W || ty < 0 || ty >= H) return null;

  const readTile = useLazy
    ? (x, y) => getTileAt(x, y)
    : (x, y) => tiles[y * W + x];

  // Redirige vers la tile walkable la plus proche si la cible est bloquée
  if (!WALKABLE[readTile(tx, ty)]) {
    let best = null, bestD = Infinity;
    for (let r = 1; r < 6; r++) {
      for (let yy = ty - r; yy <= ty + r; yy++) {
        for (let xx = tx - r; xx <= tx + r; xx++) {
          if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
          if (WALKABLE[readTile(xx, yy)]) {
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

  // On utilise un Map sparse plutôt que Float32Array(N) pour éviter
  // d'allouer 400×400×4 bytes = 640KB à chaque appel.
  const gScore = new Map();
  const prev = new Map();
  const closed = new Set();

  const key = (x, y) => y * W + x;
  const startKey = key(sx, sy);
  const targetKey = key(tx, ty);

  gScore.set(startKey, 0);
  const open = new MinHeap();
  open.push([octile(sx, sy, tx, ty), startKey]);

  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
  let found = false;
  let explored = 0;

  while (open.size > 0 && explored < MAX_SEARCH) {
    const [, idx] = open.pop();
    if (closed.has(idx)) continue;
    if (idx === targetKey) { found = true; break; }
    closed.add(idx);
    explored++;

    const x = idx % W, y = (idx / W) | 0;
    const gCur = gScore.get(idx) ?? Infinity;

    for (let d = 0; d < 8; d++) {
      const dx = dirs[d][0], dy = dirs[d][1];
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const ni = key(nx, ny);
      if (closed.has(ni)) continue;
      const tt = readTile(nx, ny);
      if (!WALKABLE[tt]) continue;
      if (dx !== 0 && dy !== 0) {
        if (!WALKABLE[readTile(x, ny)] || !WALKABLE[readTile(nx, y)]) continue;
      }
      const stepDist = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
      const cost = stepDist * (WALK_COST[tt] || 1);
      const ng = gCur + cost;
      const prevG = gScore.get(ni) ?? Infinity;
      if (ng < prevG) {
        gScore.set(ni, ng);
        prev.set(ni, idx);
        const f = ng + octile(nx, ny, tx, ty);
        open.push([f, ni]);
      }
    }
  }

  if (!found) return null;

  const path = [];
  let cur = targetKey;
  while (cur !== undefined && cur !== null) {
    path.push({ x: cur % W, y: (cur / W) | 0 });
    const p = prev.get(cur);
    if (p === undefined) break;
    cur = p;
  }
  path.reverse();
  return path;
}
