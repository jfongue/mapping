/**
 * La Botaniste Rebelle — joueur simulé déterministe.
 *
 * Principe : la carte de ses déplacements est entièrement calculable
 * à partir du timestamp courant. Il n'est PAS nécessaire de faire
 * tourner ce script en continu.
 *
 * Ce script :
 *   1. Calcule le « segment » courant (tranche de 20 min)
 *   2. Dérive la position de départ et d'arrivée via un PRNG seedé
 *      par le numéro de segment → même seed = même trajet
 *      La distance est garantie entre MIN_TRIP_PX et MAX_TRIP_PX,
 *      ce qui assure des gros déplacements continus.
 *   3. La durée du segment est proportionnelle à la distance parcourue
 *      (distance / SPEED_PX_PER_SEC), ce qui garantit une vitesse constante
 *      et une apparence de mouvement permanent.
 *   4. Écrit dans Firebase :
 *        /players/botaniste_rebelle = {
 *          id, name, color,
 *          x, y (position réelle au moment du write),
 *          target: { fromX, fromY, toX, toY, startTs, durationMs },
 *          lastSeen  (= fin du segment, pas now — voir ci-dessous)
 *        }
 *   5. S'arrête — le client interpole la position via lerpFromTarget()
 *
 * Pourquoi lastSeen = fin du segment ?
 *   ONLINE_THRESHOLD_MS = 30 000 ms. Si on écrit lastSeen = now,
 *   la Botaniste passe offline 30s après le write. En écrivant
 *   lastSeen = startTs + durationMs (fin du segment), elle reste
 *   "online" pendant toute la durée du voyage. Le prochain run du
 *   cron (dans 20 min max) écrira le segment suivant avant expiration.
 *
 * Usage : node scripts/botaniste.js
 * Env   : FIREBASE_DB_URL (optionnel)
 */

const { initializeApp, deleteApp } = require('firebase/app');
const { getDatabase, ref, update } = require('firebase/database');

// ─── Config Firebase ───────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC63kxXSMBKycCMedL4mGl3rB6atk4TstE',
  authDomain: 'treasure-quest-proto.firebaseapp.com',
  databaseURL:
    process.env.FIREBASE_DB_URL ||
    'https://treasure-quest-proto-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'treasure-quest-proto',
  storageBucket: 'treasure-quest-proto.firebasestorage.app',
  messagingSenderId: '176526916404',
  appId: '1:176526916404:web:2dab74b18dd293aff2c361',
};

// ─── Constantes ───────────────────────────────────────────────────────────────────
const MAP_W = 40;
const MAP_H = 40;
const TILE_PX = 50;

// 20 min = cron cadence. Le client recevra TOUJOURS un target en cours.
// Cohérent avec MAX_DURATION_MS = 60 000 — on envoie durationMs = SEGMENT_MS
// mais le client ignore MAX_DURATION_MS pour les joueurs autres (il utilise
// directement target.durationMs).
const SEGMENT_MS = 20 * 60 * 1000; // 1 200 000 ms

const BOTANISTE_ID    = 'botaniste_rebelle';
const BOTANISTE_COLOR = '#5dca8b';

// ─── Map walkable (identique à tilemap.js) ───────────────────────────────────
const WALKABLE = { 1: true, 2: true, 3: true };

function makeRandSeeded(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return function () {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    s = s >>> 0;
    return s / 0xffffffff;
  };
}

function buildMap() {
  const cx = MAP_W / 2, cy = MAP_H / 2;
  const maxR = Math.min(MAP_W, MAP_H) / 2;

  function makeLcg(seed) {
    let s = seed;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  function smoothedNoise(W, H, scale, rand) {
    const lowW = Math.ceil(W / scale) + 2, lowH = Math.ceil(H / scale) + 2;
    const low = new Float32Array(lowW * lowH);
    for (let i = 0; i < low.length; i++) low[i] = rand();
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const fx = x / scale, fy = y / scale;
        const ix = Math.floor(fx), iy = Math.floor(fy);
        const tx2 = fx - ix, ty2 = fy - iy;
        const a = low[iy * lowW + ix], b = low[iy * lowW + (ix+1)];
        const c = low[(iy+1) * lowW + ix], d = low[(iy+1) * lowW + (ix+1)];
        const sx = tx2*tx2*(3-2*tx2), sy = ty2*ty2*(3-2*ty2);
        out[y*W+x] = (a*(1-sx)+b*sx)*(1-sy)+(c*(1-sx)+d*sx)*sy;
      }
    }
    return out;
  }

  const tiles = new Uint8Array(MAP_W * MAP_H);
  const noiseElev = smoothedNoise(MAP_W, MAP_H, 8, makeLcg(1234));
  const noiseBiome = smoothedNoise(MAP_W, MAP_H, 6, makeLcg(5678));

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const ndx = (x-cx)/maxR, ndy = (y-cy)/maxR;
      const d = Math.sqrt(ndx*ndx+ndy*ndy);
      const ne = noiseElev[y*MAP_W+x], nb = noiseBiome[y*MAP_W+x];
      const elev = 1 - d + (ne-0.5)*0.5;
      let t;
      if      (elev < -0.02)                  t = 0;
      else if (elev < 0.1)                    t = 1;
      else if (elev > 0.55 && nb > 0.55)      t = 4;
      else if (nb > 0.62 && elev > 0.2)       t = 3;
      else                                    t = 2;
      tiles[y*MAP_W+x] = t;
    }
  }
  const tmp = new Uint8Array(MAP_W * MAP_H);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const counts = {};
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const nx = x+ox, ny = y+oy;
          if (nx<0||ny<0||nx>=MAP_W||ny>=MAP_H) continue;
          const tt = tiles[ny*MAP_W+nx]; counts[tt]=(counts[tt]||0)+1;
        }
        let best = tiles[y*MAP_W+x], bc = 0;
        for (const k in counts) if (counts[k]>bc) { bc=counts[k]; best=+k; }
        tmp[y*MAP_W+x] = best;
      }
    }
    tiles.set(tmp);
  }
  const sx = Math.floor(MAP_W/2), sy = Math.floor(MAP_H/2);
  for (let oy=-2;oy<=2;oy++) for (let ox=-2;ox<=2;ox++) tiles[(sy+oy)*MAP_W+(sx+ox)]=2;
  return tiles;
}

const MAP_TILES = buildMap();
const WALKABLE_CELLS = [];
for (let y = 0; y < MAP_H; y++)
  for (let x = 0; x < MAP_W; x++)
    if (WALKABLE[MAP_TILES[y*MAP_W+x]]) WALKABLE_CELLS.push({ x, y });

function waypointForSegment(segmentIdx, offset) {
  const rng = makeRandSeeded(segmentIdx * 1000 + offset);
  const i = Math.floor(rng() * WALKABLE_CELLS.length);
  const cell = WALKABLE_CELLS[i];
  return { x: cell.x * TILE_PX + TILE_PX/2, y: cell.y * TILE_PX + TILE_PX/2 };
}

function computeState(now) {
  const segmentIdx = Math.floor(now / SEGMENT_MS);
  const startTs    = segmentIdx * SEGMENT_MS;
  const durationMs = SEGMENT_MS;
  const from = waypointForSegment(segmentIdx, 0);
  const to   = waypointForSegment(segmentIdx, 1);

  const t = Math.min(1, (now - startTs) / durationMs);
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;

  return {
    x, y,
    segmentEndTs: startTs + durationMs,
    target: {
      fromX: from.x, fromY: from.y,
      toX: to.x,     toY: to.y,
      startTs,
      durationMs,
    },
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const now   = Date.now();
  const state = computeState(now);
  const remainSec = ((state.segmentEndTs - now) / 1000).toFixed(1);

  console.log('🌿 La Botaniste Rebelle');
  console.log(`   segment   : ${Math.floor(now / SEGMENT_MS)}`);
  console.log(`   position  : (${state.x.toFixed(1)}, ${state.y.toFixed(1)})`);
  console.log(`   → vers    : (${state.target.toX.toFixed(1)}, ${state.target.toY.toFixed(1)})`);
  console.log(`   reste     : ${remainSec}s`);
  console.log(`   lastSeen  : fin du segment (dans ${remainSec}s)`);

  const app = initializeApp(FIREBASE_CONFIG);
  const db  = getDatabase(app);
  const playerRef = ref(db, `players/${BOTANISTE_ID}`);

  await update(playerRef, {
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
    // lastSeen = fin du segment : la Botaniste reste online
    // (seuil ONLINE_THRESHOLD_MS = 30s) pendant tout le voyage.
    // Le cron suivant (dans 20min max) écrira avant expiration.
    lastSeen: state.segmentEndTs,
  });

  console.log('✅ Firebase mis à jour.');
  await deleteApp(app);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
