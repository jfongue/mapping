// Constantes globales de l'app — une seule source de vérité.
import { Platform, StatusBar as RNStatusBar } from 'react-native';

// === Map & gameplay ===
// MAP_SIZE : taille en pixels de la map complète.
// Avec CHUNK_CELLS=10, TILE_PX=50, CHUNK_PX=500, CHUNKS_PER_AXIS=40 → 40×40 chunks.
export const MAP_SIZE    = 20000;  // 400 tiles × 50px
export const GRID_STEP   = 50;    // taille d'une cellule en px (== TILE_PX)
export const SPEED_PX_PER_SEC = 80;
export const MIN_DURATION_MS  = 5 * 1000;
export const MAX_DURATION_MS  = 60 * 1000;
export const PX_PER_METER = 10;

// === Caméra ===
export const MIN_SCALE = 0.1;   // zoom out élargi pour la grande map
export const MAX_SCALE = 2.5;

// === Multi ===
export const ONLINE_THRESHOLD_MS = 30 * 1000;
export const TAP_PLAYER_RADIUS   = 30;
export const SPEED_LEVELS = [1, 2, 4, 8, 15, 30];

// === Layout ===
export const TOP_SAFE =
  (Platform.OS === 'android' ? RNStatusBar.currentHeight || 24 : 44) + 12;

// === Profil ===
export const PLAYER_COLORS = [
  '#ff6b6b', '#ff9f43', '#feca57', '#ffd93d', '#c8e15a', '#5dca8b',
  '#1abc9c', '#48dbfb', '#3d8acf', '#5f5cff', '#9b6dbd', '#a55eea',
  '#e85f8a', '#fd79a8', '#e17055', '#d35400', '#b8860b', '#7f8c8d',
  '#34495e', '#2c3e50', '#16a085', '#27ae60', '#2980b9', '#8e44ad',
  '#c0392b', '#e74c3c', '#f39c12', '#d4a017', '#52be80', '#5dade2',
];
export const ANIMAL_NAMES = [
  'Renard', 'Loup', 'Aigle', 'Hibou', 'Cerf',
  'Lynx', 'Faucon', 'Chouette', 'Lièvre', 'Castor',
];

// === Storage keys ===
// v4 : map 400×400 → coords antérieures invalides, on reset au spawn central
export const SAVE_KEY    = '@treasureProto.pos.v4';
export const PROFILE_KEY = '@treasureProto.profile.v1';

// === Spawn ===
export const SPAWN = { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
