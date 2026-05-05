/**
 * La Botaniste Rebelle — joueur simulé déterministe.
 *
 * Principe : la carte de ses déplacements est entièrement calculable
 * à partir du timestamp courant. Il n'est PAS nécessaire de faire
 * tourner ce script en continu.
 *
 * Ce script :
 *   1. Calcule le « segment » courant (tranche de temps fixe)
 *   2. Dérive la position de départ et d'arrivée via un PRNG seedé
 *      par le numéro de segment → même seed = même trajet
 *   3. Écrit dans Firebase :
 *        /players/botaniste_rebelle = {
 *          id, name, color,
 *          x, y (position réelle au moment du write),
 *          target: { fromX, fromY, toX, toY, startTs, durationMs },
 *          lastSeen
 *        }
 *   4. S'arrête — le client interpole la position via lerpFromTarget()
 *
 * Usage : node scripts/botaniste.js
 * Env   : FIREBASE_DB_URL (optionnel, sinon utilise l'URL hard-codée)
 *
 * GitHub Actions relance ce script toutes les ~20 min, soit bien
 * avant l'expiration d'un segment (MAX_SEGMENT_MS = 55 000 ms).
 */

const { initializeApp, deleteApp } = require('firebase/app');
const { getDatabase, ref, update } = require('firebase/database');

// ─── Config Firebase (même que firebase.js) ──────────────────────────────────
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

// ─── Constantes carte (doit rester cohérent avec tilemap.js) ─────────────────
const MAP_W = 40;
const MAP_H = 40;
const TILE_PX = 50;
const SPEED_PX_PER_SEC = 80;

// Durée d'un segment = le temps qu'on accorde à La Botaniste pour aller
// d'un waypoint au suivant. On choisit 50 s pour rester sous MAX_DURATION_MS.
const SEGMENT_MS = 50_000;

// ID fixe — toujours le même nœud dans Firebase
const BOTANISTE_ID = 'botaniste_rebelle';

// Couleur signature : vert mousse
const BOTANISTE_COLOR = '#5dca8b';

// ─── Tiles walkables (doit rester cohérent avec tilemap.js) ──────────────────
// On re-génère la même map que buildDemoMap() pour choisir des waypoints
// uniquement sur des tiles marchables.

const WALKABLE = { 1: true, 2: true, 3: true }; // beach, plain, forest

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

// Reproduit buildDemoMap() de tilemap.js pour identifier les tiles marchables.
function buildMap() {
  const TILES = { WATER: 0, BEACH: 1, PLAIN: 2, FOREST: 3, ROCK: 4, VOLCANO: 5 };
  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  const maxR = Math.min(MAP_W, MAP_H) / 2;

  function makeLcg(seed) {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  function smoothedNoise(W, H, scale, rand) {
    const lowW = Math.ceil(W / scale) + 2;
    const lowH = Math.ceil(H / scale) + 2;
    const low = new Float32Array(lowW * lowH);
    for (let i = 0; i < low.length; i++) low[i] = rand();
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const fx = x / scale, fy = y / scale;
        const ix = Math.floor(fx), iy = Math.floor(fy);
        const tx2 = fx - ix, ty2 = fy - iy;
        const a = low[iy * lowW + ix];
        const b = low[iy * lowW + (ix + 1)];
        const c = low[(iy + 1) * lowW + ix];
        const d = low[(iy + 1) * lowW + (ix + 1)];
        const sx = tx2 * tx2 * (3 - 2 * tx2);
        const sy = ty2 * ty2 * (3 - 2 * ty2);
        out[y * W + x] = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
      }
    }
    return out;
  }

  const tiles = new Uint8Array(MAP_W * MAP_H);
  const noiseElev = smoothedNoise(MAP_W, MAP_H, 8, makeLcg(1234));
  const noiseBiome = smoothedNoise(MAP_W, MAP_H, 6, makeLcg(5678));

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const ndx = (x - cx) / maxR;
      const ndy = (y - cy) / maxR;
      const d = Math.sqrt(ndx * ndx + ndy * ndy);
      const ne = noiseElev[y * MAP_W + x];
      const nb = noiseBiome[y * MAP_W + x];
      const elevation = 1 - d + (ne - 0.5) * 0.5;
      let t;
      if (elevation < -0.02) t = TILES.WATER;
      else if (elevation < 0.1) t = TILES.BEACH;
      else if (elevation > 0.55 && nb > 0.55) t = TILES.ROCK;
      else if (nb > 0.62 && elevation > 0.2) t = TILES.FOREST;
      else t = TILES.PLAIN;
      tiles[y * MAP_W + x] = t;
    }
  }

  // 2 passes majority filter (identique à tilemap.js)
  const tmp = new Uint8Array(MAP_W * MAP_H);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const counts = {};
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
            const tt = tiles[ny * MAP_W + nx];
            counts[tt] = (counts[tt] || 0) + 1;
          }
        }
        let best = tiles[y * MAP_W + x], bestCount = 0;
        for (const k in counts) {
          if (counts[k] > bestCount) { bestCount = counts[k]; best = +k; }
        }
        tmp[y * MAP_W + x] = best;
      }
    }
    tiles.set(tmp);
  }

  // Spawn central garanti
  const sx = Math.floor(MAP_W / 2);
  const sy = Math.floor(MAP_H / 2);
  for (let oy = -2; oy <= 2; oy++) {
    for (let ox = -2; ox <= 2; ox++) {
      tiles[(sy + oy) * MAP_W + (sx + ox)] = TILES.PLAIN;
    }
  }

  return tiles;
}

// Collecte toutes les cellules marchables sur la vraie map
const MAP_TILES = buildMap();
const WALKABLE_CELLS = [];
for (let y = 0; y < MAP_H; y++) {
  for (let x = 0; x < MAP_W; x++) {
    if (WALKABLE[MAP_TILES[y * MAP_W + x]]) {
      WALKABLE_CELLS.push({ x, y });
    }
  }
}

/**
 * Choisit un waypoint (centre de tile en px) à partir d'un index de segment
 * et d'un offset (0 = départ, 1 = arrivée).
 * Totalement déterministe : même segmentIdx → même waypoint.
 */
function waypointForSegment(segmentIdx, offset) {
  const rng = makeRandSeeded(segmentIdx * 1000 + offset);
  const i = Math.floor(rng() * WALKABLE_CELLS.length);
  const cell = WALKABLE_CELLS[i];
  return {
    x: cell.x * TILE_PX + TILE_PX / 2,
    y: cell.y * TILE_PX + TILE_PX / 2,
  };
}

/**
 * Calcule l'état courant de La Botaniste en fonction de now.
 *
 * On découpe le temps en segments de SEGMENT_MS.
 * Le segment N va de  N*SEGMENT_MS  à  (N+1)*SEGMENT_MS.
 *  - waypoint de départ  = waypointForSegment(N, 0)
 *  - waypoint d'arrivée  = waypointForSegment(N, 1)
 *  - startTs             = N * SEGMENT_MS
 *  - durationMs          = SEGMENT_MS
 *
 * La position réelle au moment du write :
 *   t = (now - startTs) / durationMs
 *   pos = lerp(from, to, t)
 */
function computeState(now) {
  const segmentIdx = Math.floor(now / SEGMENT_MS);
  const startTs = segmentIdx * SEGMENT_MS;
  const durationMs = SEGMENT_MS;
  const from = waypointForSegment(segmentIdx, 0);
  const to   = waypointForSegment(segmentIdx, 1);

  // Position interpolée au moment du write (pour x,y « snapshot »)
  const t = Math.min(1, (now - startTs) / durationMs);
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;

  return {
    x, y,
    target: {
      fromX: from.x,
      fromY: from.y,
      toX:   to.x,
      toY:   to.y,
      startTs,
      durationMs,
    },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const now = Date.now();
  const state = computeState(now);

  console.log('🌿 La Botaniste Rebelle');
  console.log(`   segment  : ${Math.floor(now / SEGMENT_MS)}`);
  console.log(`   position : (${state.x.toFixed(1)}, ${state.y.toFixed(1)})`);
  console.log(`   → vers   : (${state.target.toX.toFixed(1)}, ${state.target.toY.toFixed(1)})`);
  console.log(`   reste    : ${((state.target.startTs + state.target.durationMs - now) / 1000).toFixed(1)}s`);

  const app = initializeApp(FIREBASE_CONFIG);
  const db = getDatabase(app);
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
    lastSeen: now,
  });

  console.log('✅ Firebase mis à jour.');
  await deleteApp(app);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
