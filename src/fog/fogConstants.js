// ─── Fog of War – Configuration ───────────────────────────────────────────

/** Taille d'une tuile en degrés de latitude/longitude (~50 m à nos latitudes) */
export const TILE_SIZE_DEG = 0.0005;

/** Nb de jours avant le début de l'estompage de la couleur */
export const FADE_START_DAYS = 7;

/** Nb de jours avant la péremption totale (retour au brouillard complet) */
export const EXPIRY_DAYS = 30;

/** Couleur du brouillard total (zones jamais explorées) */
export const FOG_COLOR = '#1a1a2e';

/** Opacité max du brouillard (1 = totalement opaque) */
export const FOG_MAX_OPACITY = 0.92;

/** Opacité min après exploration récente (0 = carte 100 % visible) */
export const FOG_MIN_OPACITY = 0;

/** Rayon de révélation autour de la position GPS (en tuiles) */
export const REVEAL_RADIUS_TILES = 3;
