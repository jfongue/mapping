// biomeDecor — génère une liste BORNÉE et DÉTERMINISTE de décorations à poser
// par-dessus la map (arbres, herbes, rochers, écume de plage, halo de lave, vagues).
//
// Module logique pure (aucun import react-native) → testable sous jest.
// Le rendu (Views/SVG) est fait dans components/TileLayer.js.
//
// Sortie : { left, top, w, h, type, color, variant, op } en pixels carte.

function makeRand(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Hash déterministe par tuile → graine locale (pas de RNG global partagé,
// donc l'ordre de parcours n'influe pas sur le visuel d'une tuile donnée).
function tileSeed(tx, ty, salt) {
  return ((tx * 73856093) ^ (ty * 19349663) ^ (salt * 83492791)) & 0x7fffffff;
}

const TILES = { WATER: 0, BEACH: 1, PLAIN: 2, FOREST: 3, ROCK: 4, VOLCANO: 5 };

/**
 * @param {object} o
 * @param {Uint8Array|number[]} o.tiles
 * @param {number} o.W, o.H, o.tilePx
 * @param {number} [o.density=1]  - 0..1, fraction de tuiles décorées par biome
 * @param {number} [o.maxItems=9000] - plafond dur (perf)
 * @returns {Array} décorations
 */
export function generateDecor(o) {
  const { tiles, W, H, tilePx, density = 1, maxItems = 9000 } = o || {};
  if (!tiles || !W || !H || !tilePx) return [];
  const out = [];

  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : tiles[y * W + x]);

  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      if (out.length >= maxItems) return out;
      const t = tiles[ty * W + tx];
      const ox = tx * tilePx, oy = ty * tilePx;
      const r = makeRand(tileSeed(tx, ty, t + 1));

      if (t === TILES.FOREST) {
        // 1 à 2 arbres par tuile forêt
        if (r() < 0.92 * density) {
          const n = 1 + (r() < 0.5 ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const s = tilePx * (0.34 + r() * 0.18);
            out.push({
              type: 'tree',
              left: ox + tilePx * (0.18 + r() * 0.5),
              top: oy + tilePx * (0.14 + r() * 0.45),
              w: s, h: s * 1.15,
              variant: r() < 0.5 ? 0 : 1,
              color: r() < 0.5 ? '#5f9e63' : '#4f8f57',
            });
          }
        }
      } else if (t === TILES.PLAIN) {
        // touffes d'herbe clairsemées
        if (r() < 0.4 * density) {
          out.push({
            type: 'grass',
            left: ox + tilePx * (0.2 + r() * 0.55),
            top: oy + tilePx * (0.3 + r() * 0.5),
            w: tilePx * 0.22, h: tilePx * 0.16,
            variant: 0,
            color: '#bcd06a',
          });
        }
      } else if (t === TILES.ROCK) {
        if (r() < 0.7 * density) {
          const s = tilePx * (0.28 + r() * 0.22);
          out.push({
            type: 'rock',
            left: ox + tilePx * (0.22 + r() * 0.4),
            top: oy + tilePx * (0.28 + r() * 0.4),
            w: s, h: s * 0.8,
            variant: 0,
            color: r() < 0.5 ? '#a39c95' : '#8f8881',
          });
        }
      } else if (t === TILES.VOLCANO) {
        // halo de lave + cœur incandescent
        out.push({
          type: 'lavaGlow',
          left: ox + tilePx * 0.12, top: oy + tilePx * 0.12,
          w: tilePx * 0.76, h: tilePx * 0.76, variant: 0, color: '#ff6a2b', op: 0.5,
        });
        out.push({
          type: 'lavaCore',
          left: ox + tilePx * 0.3, top: oy + tilePx * 0.3,
          w: tilePx * 0.4, h: tilePx * 0.4, variant: 0, color: '#ffcf3a', op: 0.95,
        });
      } else if (t === TILES.WATER) {
        // petites vagues éparses
        if (r() < 0.18 * density) {
          out.push({
            type: 'wave',
            left: ox + tilePx * (0.15 + r() * 0.5),
            top: oy + tilePx * (0.35 + r() * 0.4),
            w: tilePx * 0.4, h: Math.max(2, tilePx * 0.06),
            variant: 0,
            color: 'rgba(255,255,255,0.45)',
          });
        }
      } else if (t === TILES.BEACH) {
        // écume : si une tuile d'eau est adjacente, liseré clair sur ce bord
        const edges = [];
        if (at(tx, ty - 1) === TILES.WATER) edges.push('top');
        if (at(tx, ty + 1) === TILES.WATER) edges.push('bottom');
        if (at(tx - 1, ty) === TILES.WATER) edges.push('left');
        if (at(tx + 1, ty) === TILES.WATER) edges.push('right');
        for (const e of edges) {
          out.push({
            type: 'foam',
            left: e === 'right' ? ox + tilePx * 0.82 : ox,
            top: e === 'bottom' ? oy + tilePx * 0.82 : oy,
            w: (e === 'left' || e === 'right') ? tilePx * 0.18 : tilePx,
            h: (e === 'top' || e === 'bottom') ? tilePx * 0.18 : tilePx,
            variant: 0,
            color: 'rgba(255,255,255,0.5)',
          });
        }
      }
    }
  }
  return out;
}
