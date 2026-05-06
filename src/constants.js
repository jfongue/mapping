// Constantes globales de l'app — une seule source de vérité.
import { Platform, StatusBar as RNStatusBar } from 'react-native';

// === Map & gameplay ===
export const MAP_SIZE = 2000;
export const GRID_STEP = 200;

// Vitesse de déplacement de base : 8 px/s
// → trajet (68,16)→(109,38) ≈ 2325 px ≈ 5 min
// Les équipements futurs (bottes, montures…) multiplieront cette valeur
// via un facteur transmis à movementDuration().
export const SPEED_PX_PER_SEC = 8;

// Durée min : 10 s (évite les téléportations sur tap accidentel)
// Durée max : 30 min (sécurité contre les trajets aberrants)
export const MIN_DURATION_MS = 10 * 1000;
export const MAX_DURATION_MS = 30 * 60 * 1000;

export const PX_PER_METER = 10;

// === Caméra ===
export const MIN_SCALE = 0.4;
export const MAX_SCALE = 2.5;

// === Multi ===
export const ONLINE_THRESHOLD_MS = 30 * 1000;
export const TAP_PLAYER_RADIUS = 30;
// Niveaux de boost debug : x1 (normal) → x100
export const SPEED_LEVELS = [1, 2, 5, 10, 20, 50, 100];

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
// v3 : map 128×128 → coords antérieures invalides, on reset au spawn central
export const SAVE_KEY = '@treasureProto.pos.v3';
export const PROFILE_KEY = '@treasureProto.profile.v1';

// === Spawn ===
export const SPAWN = { x: 29, y: 29 };
