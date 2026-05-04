import { TILE, MAP_TILES } from './constants';
import { isPassable } from './terrain';

// A* sur grille. start/end = { x, y } en coordonnées cellule.
// Renvoie un tableau de cellules ou null si pas de chemin.
export function aStar(grid, start, end) {
  const key = (x, y) => x + ',' + y;
  const open = new Map();
  const closed = new Set();
  const gScore = new Map();
  const fScore = new Map();
  const came = new Map();
  const h = (x, y) => Math.hypot(x - end.x, y - end.y);

  const startK = key(start.x, start.y);
  gScore.set(startK, 0);
  fScore.set(startK, h(start.x, start.y));
  open.set(startK, start);

  while (open.size > 0) {
    let bestK = null, bestF = Infinity;
    for (const [k] of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < bestF) { bestF = f; bestK = k; }
    }
    const cur = open.get(bestK);

    if (cur.x === end.x && cur.y === end.y) {
      return reconstructPath(came, bestK, cur);
    }
    open.delete(bestK);
    closed.add(bestK);

    for (const [dx, dy] of NEIGHBORS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!isPassable(grid, nx, ny)) continue;
      // Pas de coupe diagonale à travers obstacle
      if (dx !== 0 && dy !== 0) {
        if (!isPassable(grid, cur.x + dx, cur.y) || !isPassable(grid, cur.x, cur.y + dy)) continue;
      }
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const step = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
      const tentative = (gScore.get(bestK) ?? Infinity) + step;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        came.set(nk, bestK);
        gScore.set(nk, tentative);
        fScore.set(nk, tentative + h(nx, ny));
        if (!open.has(nk)) open.set(nk, { x: nx, y: ny });
      }
    }
  }
  return null;
}

const NEIGHBORS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function reconstructPath(came, endK, endCell) {
  const path = [{ x: endCell.x, y: endCell.y }];
  let ck = endK;
  while (came.has(ck)) {
    ck = came.get(ck);
    const [px, py] = ck.split(',').map(Number);
    path.unshift({ x: px, y: py });
  }
  return path;
}

// Convertit cells → points (centre cell) puis simplifie via line-of-sight.
export function pathToPoints(path, grid) {
  if (!path || path.length === 0) return [];
  const pts = path.map((c) => ({ x: c.x * TILE + TILE / 2, y: c.y * TILE + TILE / 2 }));
  const result = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !losClear(pts[i], pts[j], grid)) j--;
    result.push(pts[j]);
    i = j;
  }
  return result;
}

function losClear(a, b, grid) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 20);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (!isPassable(grid, Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}
