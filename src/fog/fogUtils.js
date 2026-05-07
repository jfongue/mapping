import { TILE_SIZE_DEG, FADE_START_DAYS, EXPIRY_DAYS, FOG_MAX_OPACITY, FOG_MIN_OPACITY, REVEAL_RADIUS_TILES } from './fogConstants';

// ─── Conversion coordonnées → clé de tuile ─────────────────────────────────

/**
 * Retourne la clé unique d'une tuile GPS sous forme "lat_lon"
 * en arrondissant à TILE_SIZE_DEG près.
 */
export const coordToTileKey = (latitude, longitude) => {
  const tileX = Math.floor(longitude / TILE_SIZE_DEG);
  const tileY = Math.floor(latitude / TILE_SIZE_DEG);
  return `${tileY}_${tileX}`;
};

/**
 * Retourne les coordonnées du coin haut-gauche d'une tuile à partir de sa clé.
 */
export const tileKeyToCoord = (key) => {
  const [tileY, tileX] = key.split('_').map(Number);
  return {
    latitude:  tileY * TILE_SIZE_DEG,
    longitude: tileX * TILE_SIZE_DEG,
  };
};

// ─── Calcul de l'opacité (péremption) ──────────────────────────────────────

/**
 * Calcule l'opacité du brouillard sur une tuile selon son lastSeen.
 * 0   → zone récente, carte pleinement visible
 * 0→1 → zone en cours d'estompage (fade)
 * 1   → brouillard total (jamais vue ou expirée)
 */
export const getTileOpacity = (tileData) => {
  if (!tileData) return FOG_MAX_OPACITY; // jamais explorée

  const now = Date.now();
  const ageMs = now - tileData.lastSeen;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays < FADE_START_DAYS) return FOG_MIN_OPACITY;
  if (ageDays >= EXPIRY_DAYS)    return FOG_MAX_OPACITY;

  // Interpolation linéaire entre FADE_START et EXPIRY
  const progress = (ageDays - FADE_START_DAYS) / (EXPIRY_DAYS - FADE_START_DAYS);
  return FOG_MIN_OPACITY + progress * (FOG_MAX_OPACITY - FOG_MIN_OPACITY);
};

// ─── Génération des tuiles à révéler autour d'un point ─────────────────────

/**
 * Retourne toutes les clés de tuiles dans un rayon REVEAL_RADIUS_TILES
 * autour d'une position GPS donnée.
 */
export const getTilesToReveal = (latitude, longitude) => {
  const centerTileX = Math.floor(longitude / TILE_SIZE_DEG);
  const centerTileY = Math.floor(latitude  / TILE_SIZE_DEG);
  const keys = [];

  for (let dy = -REVEAL_RADIUS_TILES; dy <= REVEAL_RADIUS_TILES; dy++) {
    for (let dx = -REVEAL_RADIUS_TILES; dx <= REVEAL_RADIUS_TILES; dx++) {
      // Forme circulaire plutôt que carrée
      if (dx * dx + dy * dy <= REVEAL_RADIUS_TILES * REVEAL_RADIUS_TILES) {
        keys.push(`${centerTileY + dy}_${centerTileX + dx}`);
      }
    }
  }
  return keys;
};
