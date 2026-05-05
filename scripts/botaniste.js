/**
 * La Botaniste Rebelle — joueur simulé déterministe.
 *
 * Déplacement en grand triangle périodique sur la map :
 *
 *   A (haut-gauche) → B (haut-droite) → C (bas-milieu) → A → ...
 *
 * Principe :
 *   1. On définit trois coins A, B, C couvrant la quasi-totalité de la map.
 *   2. Le temps est découpé en cycles de TRIANGLE_CYCLE_MS.
 *      Chaque cycle = un tour complet du triangle A→B→C→A.
 *   3. À partir de `now`, on détermine :
 *        - le segment courant (A→B, B→C ou C→A)
 *        - la position exacte par interpolation linéaire
 *        - durationMs = distance / SPEED_PX_PER_SEC (même logique qu'App.js)
 *   4. Écrit dans Firebase :
 *        /players/botaniste_rebelle = {
 *          id, name, color, outfit, skin, hair, hat,
 *          x, y,
 *          target: { fromX, fromY, toX, toY, startTs, durationMs },
 *          lastSeen (= début du segment + durationMs)
 *        }
 *   5. S'arrête — le client interpole via son Animated.timing.
 *
 * Usage : node scripts/botaniste.js
 * Env   : FIREBASE_DB_URL (optionnel)
 */

const { initializeApp, deleteApp } = require('firebase/app');
const { getDatabase, ref, update } = require('firebase/database');

// ─── Config Firebase ───────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyC63kxXSMBKycCMedL4mGl3rB6atk4TstE',
  authDomain:        'treasure-quest-proto.firebaseapp.com',
  databaseURL:       process.env.FIREBASE_DB_URL ||
                     'https://treasure-quest-proto-default-rtdb.europe-west1.firebasedatabase.app',
  projectId:         'treasure-quest-proto',
  storageBucket:     'treasure-quest-proto.firebasestorage.app',
  messagingSenderId: '176526916404',
  appId:             '1:176526916404:web:2dab74b18dd293aff2c361',
};

// ─── Constantes map ───────────────────────────────────────────────────────────────────
const MAP_W       = 40;
const MAP_H       = 40;
const TILE_PX     = 50;
const MAP_W_PX    = MAP_W * TILE_PX;  // 2000 px
const MAP_H_PX    = MAP_H * TILE_PX;  // 2000 px

// Vitesse identique à celle des vrais joueurs (voir App.js)
const SPEED_PX_PER_SEC = 80;

// ─── Triangle ───────────────────────────────────────────────────────────────────────────
const A = { x: 0.1 * MAP_W_PX, y: 0.1 * MAP_H_PX }; // haut-gauche  (200, 200)
const B = { x: 0.9 * MAP_W_PX, y: 0.1 * MAP_H_PX }; // haut-droite  (1800, 200)
const C = { x: 0.5 * MAP_W_PX, y: 0.9 * MAP_H_PX }; // bas-milieu   (1000, 1800)

// Distances de chaque côté
const DIST_AB = Math.hypot(B.x - A.x, B.y - A.y);
const DIST_BC = Math.hypot(C.x - B.x, C.y - B.y);
const DIST_CA = Math.hypot(A.x - C.x, A.y - C.y);
const DIST_TOTAL = DIST_AB + DIST_BC + DIST_CA;

// Durée d'un cycle complet (1 tour du triangle) en ms
// Calculé automatiquement à partir de la distance totale et de la vitesse.
const TRIANGLE_CYCLE_MS = Math.round((DIST_TOTAL / SPEED_PX_PER_SEC) * 1000);

// 3 segments du triangle avec leurs bornes temporelles relatives [0, 1]
const FRAC_AB = DIST_AB / DIST_TOTAL;
const FRAC_BC = DIST_BC / DIST_TOTAL;
// FRAC_CA = 1 - FRAC_AB - FRAC_BC

const SEGMENTS = [
  { from: A, to: B, dist: DIST_AB, fracStart: 0,                   fracEnd: FRAC_AB            },
  { from: B, to: C, dist: DIST_BC, fracStart: FRAC_AB,             fracEnd: FRAC_AB + FRAC_BC  },
  { from: C, to: A, dist: DIST_CA, fracStart: FRAC_AB + FRAC_BC,  fracEnd: 1                  },
];

const BOTANISTE_ID    = 'botaniste_rebelle';
const BOTANISTE_COLOR = '#5dca8b';

// ─── Calcul déterministe de l'état courant ───────────────────────────────────────
function computeState(now) {
  // Phase dans le cycle courant [0, 1)
  const cycleStart = Math.floor(now / TRIANGLE_CYCLE_MS) * TRIANGLE_CYCLE_MS;
  const phase      = (now - cycleStart) / TRIANGLE_CYCLE_MS;

  // Trouver le segment courant
  const seg = SEGMENTS.find((s) => phase < s.fracEnd) || SEGMENTS[SEGMENTS.length - 1];

  // Fraction dans le segment courant [0, 1]
  const fracInSeg  = (phase - seg.fracStart) / (seg.fracEnd - seg.fracStart);

  // Position interpolée
  const x = seg.from.x + (seg.to.x - seg.from.x) * fracInSeg;
  const y = seg.from.y + (seg.to.y - seg.from.y) * fracInSeg;

  // Timestamps du segment courant
  const segStartTs = cycleStart + seg.fracStart * TRIANGLE_CYCLE_MS;
  const durationMs = Math.round((seg.dist / SPEED_PX_PER_SEC) * 1000);

  return {
    x, y,
    seg,
    target: {
      fromX: seg.from.x, fromY: seg.from.y,
      toX:   seg.to.x,   toY:   seg.to.y,
      startTs:    segStartTs,
      durationMs,
    },
    // lastSeen = fin du segment → elle reste online tout le trajet
    lastSeen: segStartTs + durationMs,
  };
}

// ─── Noms lisibles pour les segments (pour les logs) ──────────────────────────
const SEG_NAMES = ['A → B', 'B → C', 'C → A'];

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const now    = Date.now();
  const state  = computeState(now);
  const segIdx = SEGMENTS.indexOf(state.seg);
  const remain = Math.max(0, state.lastSeen - now);

  console.log('🌿 La Botaniste Rebelle');
  console.log(`   cycle     : ${(TRIANGLE_CYCLE_MS / 1000).toFixed(0)} s total`);
  console.log(`   segment   : ${SEG_NAMES[segIdx]}  (${state.seg.dist.toFixed(0)} px • ${(state.target.durationMs / 1000).toFixed(1)} s)`);
  console.log(`   position  : (${state.x.toFixed(1)}, ${state.y.toFixed(1)})`);
  console.log(`   → vers    : (${state.target.toX.toFixed(1)}, ${state.target.toY.toFixed(1)})`);
  console.log(`   reste     : ${(remain / 1000).toFixed(1)} s`);

  const app = initializeApp(FIREBASE_CONFIG);
  const db  = getDatabase(app);

  await update(ref(db, `players/${BOTANISTE_ID}`), {
    id:       BOTANISTE_ID,
    name:     'La Botaniste Rebelle',
    color:    BOTANISTE_COLOR,
    outfit:   'green',
    skin:     'light',
    hair:     'black',
    hat:      'none',
    x:        state.x,
    y:        state.y,
    target:   state.target,
    lastSeen: state.lastSeen,
  });

  console.log('✅ Firebase mis à jour.');
  await deleteApp(app);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
