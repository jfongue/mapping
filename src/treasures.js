// Trésors — placement déterministe de coffres sur la carte + helpers de collecte.
//
// Module 100% logique pure (aucun import react-native) pour être testable sous jest.
// La carte est passée en paramètre (tiles/W/H/tilePx/selectable) pour rester découplé
// de src/tilemap.js.

// PRNG LCG seedé — même famille que tilemap.js (reproductible).
function makeRand(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Paliers de rareté. weight = poids de tirage, xp = récompense en "px" d'XP
// (homogène avec totalDistancePx pour réutiliser la XPBar existante).
export const TREASURE_TIERS = {
  common: { key: 'common', label: 'Coffre commun', color: '#b8763a', glow: '#e8a45c', xp: 1200, weight: 60 },
  rare: { key: 'rare', label: 'Coffre rare', color: '#3d8acf', glow: '#7ec8ff', xp: 4000, weight: 28 },
  epic: { key: 'epic', label: 'Coffre légendaire', color: '#9b6dbd', glow: '#e0b3ff', xp: 12000, weight: 12 },
};

const NAME_PREFIX = ['Coffre', 'Cache', 'Trésor', 'Butin', 'Relique'];
const NAME_SUFFIX = [
  'du Corsaire', 'oublié', 'des Sables', 'du Vieux Loup', 'englouti',
  'des Cimes', 'du Sylvain', 'maudit', 'du Marchand', 'des Anciens',
];

function pickTier(rand) {
  const total = Object.values(TREASURE_TIERS).reduce((a, t) => a + t.weight, 0);
  let r = rand() * total;
  for (const t of Object.values(TREASURE_TIERS)) {
    if (r < t.weight) return t.key;
    r -= t.weight;
  }
  return 'common';
}

/**
 * Génère un set déterministe de coffres répartis sur la carte.
 *
 * @param {object} o
 * @param {Uint8Array|number[]} o.tiles   - données de tuiles (index = ty*W+tx)
 * @param {number} o.W, o.H               - dimensions en tuiles
 * @param {number} o.tilePx               - taille d'une tuile en px
 * @param {Object<number,boolean>} o.selectable - tuiles où un coffre peut reposer
 * @param {number} [o.count=40]           - nombre cible de coffres
 * @param {number} [o.minDistTiles=6]     - espacement minimum (en tuiles)
 * @param {number} [o.seed=20260613]      - graine
 * @returns {Array<{id,tx,ty,x,y,tier,xp,name,color,glow}>}
 */
export function generateTreasures(o) {
  const {
    tiles, W, H, tilePx,
    selectable,
    count = 40,
    minDistTiles = 6,
    seed = 20260613,
  } = o || {};
  if (!tiles || !W || !H || !tilePx) return [];

  const rand = makeRand(seed);

  // Tuiles candidates (sélectionnables), avec une marge de bord.
  const MARGIN = 4;
  const candidates = [];
  for (let ty = MARGIN; ty < H - MARGIN; ty++) {
    for (let tx = MARGIN; tx < W - MARGIN; tx++) {
      const t = tiles[ty * W + tx];
      if (selectable[t]) candidates.push([tx, ty]);
    }
  }
  if (candidates.length === 0) return [];

  // Mélange Fisher-Yates seedé puis sélection avec contrainte d'espacement.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = candidates[i]; candidates[i] = candidates[j]; candidates[j] = tmp;
  }

  const minD2 = minDistTiles * minDistTiles;
  const placed = [];
  for (let i = 0; i < candidates.length && placed.length < count; i++) {
    const [tx, ty] = candidates[i];
    let ok = true;
    for (const p of placed) {
      const ddx = p.tx - tx, ddy = p.ty - ty;
      if (ddx * ddx + ddy * ddy < minD2) { ok = false; break; }
    }
    if (!ok) continue;

    const tierKey = pickTier(rand);
    const tier = TREASURE_TIERS[tierKey];
    const name = `${NAME_PREFIX[Math.floor(rand() * NAME_PREFIX.length)]} ${NAME_SUFFIX[Math.floor(rand() * NAME_SUFFIX.length)]}`;
    placed.push({
      id: `t_${tx}_${ty}`,
      tx, ty,
      x: tx * tilePx + tilePx / 2,
      y: ty * tilePx + tilePx / 2,
      tier: tierKey,
      xp: tier.xp,
      name,
      color: tier.color,
      glow: tier.glow,
    });
  }
  return placed;
}

/** Coffre non-collecté le plus proche d'un point, dans un rayon (px). */
export function treasureNearPoint(treasures, px, py, radius, collected) {
  let best = null, bestD = radius;
  if (!treasures) return null;
  for (const t of treasures) {
    if (collected && collected.has && collected.has(t.id)) continue;
    const d = Math.hypot(t.x - px, t.y - py);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

/** Tous les coffres non-collectés dans un rayon (px) — pour collecte à l'arrivée. */
export function treasuresWithin(treasures, px, py, radius, collected) {
  const out = [];
  if (!treasures) return out;
  for (const t of treasures) {
    if (collected && collected.has && collected.has(t.id)) continue;
    if (Math.hypot(t.x - px, t.y - py) <= radius) out.push(t);
  }
  return out;
}

/** Total d'XP d'une liste de coffres. */
export function sumTreasureXp(list) {
  return (list || []).reduce((a, t) => a + (t.xp || 0), 0);
}
