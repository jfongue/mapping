// Helpers purs liés à la tilemap : conversion pixel↔tile,
// recherche de tile walkable la plus proche, échantillonnage de path.

import { TILES_DATA, MAP_W, MAP_H, TILE_PX, WALKABLE } from './tilemap';

/**
 * Renvoie une position pixel walkable :
 * - si la tile sous (px,py) est walkable → retourne (px,py)
 * - sinon cherche en spirale jusqu'à r=20 la tile walkable la plus proche
 * - fallback : centre de la map
 */
export function safePixelPos(px, py) {
  const tx = Math.floor(px / TILE_PX);
  const ty = Math.floor(py / TILE_PX);
  const tileIdx = ty * MAP_W + tx;
  if (
    tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H &&
    WALKABLE[TILES_DATA[tileIdx]]
  ) {
    return { x: px, y: py };
  }
  for (let r = 1; r <= 20; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
        if (WALKABLE[TILES_DATA[ny * MAP_W + nx]]) {
          return {
            x: nx * TILE_PX + TILE_PX / 2,
            y: ny * TILE_PX + TILE_PX / 2,
          };
        }
      }
    }
  }
  return { x: (MAP_W / 2) * TILE_PX, y: (MAP_H / 2) * TILE_PX };
}

/**
 * Convertit un cellPath (liste de cellules {x,y}) en samples pixels (centres de tiles).
 * Si startPx fourni, remplace le premier waypoint par la position pixel exacte.
 * Retourne { samples, length } — length en pixels.
 */
export function buildStraightPath(cellPath, startPx) {
  const wps = cellPath.map((c) => ({
    x: c.x * TILE_PX + TILE_PX / 2,
    y: c.y * TILE_PX + TILE_PX / 2,
  }));
  if (startPx) wps[0] = { x: startPx.x, y: startPx.y };
  let length = 0;
  for (let i = 1; i < wps.length; i++) {
    length += Math.hypot(wps[i].x - wps[i - 1].x, wps[i].y - wps[i - 1].y);
  }
  return { samples: wps, length };
}

/** Calcule les clés "col,row" des tiles dans le rayon (en cellules) autour d'un point px. */
export function getTilesInRadius(px, py, radiusCells) {
  const cx = Math.floor(px / TILE_PX);
  const cy = Math.floor(py / TILE_PX);
  const r = Math.ceil(radiusCells);
  const keys = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (Math.hypot(dx, dy) <= radiusCells) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
          keys.push(`${nx},${ny}`);
        }
      }
    }
  }
  return keys;
}
