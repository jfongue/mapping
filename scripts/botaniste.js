/**
 * La Botaniste Rebelle — joueur simulé déterministe.
 *
 * Ce script tourne EN CONTINU (setInterval 5 s).
 * Il est la SEULE source de vérité pour la position de la botaniste.
 *
 * Principe :
 *   - Les 3 sommets du triangle sont définis en tiles, puis convertis en px.
 *   - buildMap() (identique à tilemap.js) génère la vraie carte → on vérifie
 *     que chaque sommet et chaque segment sont sur des cellules walkables.
 *   - Toutes les REFRESH_MS, on recalcule la position exacte depuis `now`
 *     et on écrit dans Firebase. Le client interpole via lerpFromTarget().
 *
 * Usage : node scripts/botaniste.js
 * Env   : FIREBASE_DB_URL (optionnel)
 */

const { initializeApp, deleteApp } = require('firebase/app');
const { getDatabase, ref, update }  = require('firebase/database');

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

// ─── Constantes ────────────────────────────────────────────────────────────
const MAP_W          = 40;
const MAP_H          = 40;
const TILE_PX        = 50;
const SPEED_PX_PER_SEC = 80;   // identique à App.js
const REFRESH_MS     = 5_000;  // fréquence d'écriture Firebase

const BOTANISTE_ID    = 'botaniste_rebelle';
const BOTANISTE_COLOR = '#5dca8b';

// ─── Génération de la map (identique à tilemap.js) ────────────────────────
const WALKABLE = { 1: true, 2: true, 3: true };

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
      const tx = fx - ix, ty = fy - iy;
      const a = low[iy * lowW + ix], b = low[iy * lowW + ix + 1];
      const c = low[(iy + 1) * lowW + ix], d = low[(iy + 1) * lowW + ix + 1];
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      out[y * W + x] = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
    }
  }
  return out;
}

function buildMap() {
  const cx = MAP_W / 2, cy = MAP_H / 2, maxR = Math.min(MAP_W, MAP_H) / 2;
  const noiseElev  = smoothedNoise(MAP_W, MAP_H, 8, makeLcg(1234));
  const noiseBiome = smoothedNoise(MAP_W, MAP_H, 6, makeLcg(5678));
  const tiles = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const ndx = (x - cx) / maxR, ndy = (y - cy) / maxR;
      const d   = Math.sqrt(ndx * ndx + ndy * ndy);
      const ne  = noiseElev[y * MAP_W + x], nb = noiseBiome[y * MAP_W + x];
      const elev = 1 - d + (ne - 0.5) * 0.5;
      let t;
      if      (elev < -0.02)                t = 0;
      else if (elev < 0.1)                  t = 1;
      else if (elev > 0.55 && nb > 0.55)    t = 4;
      else if (nb   > 0.62 && elev > 0.2)   t = 3;
      else                                  t = 2;
      tiles[y * MAP_W + x] = t;
    }
  }
  const tmp = new Uint8Array(MAP_W * MAP_H);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const counts = {};
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox, ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
          const tt = tiles[ny * MAP_W + nx]; counts[tt] = (counts[tt] || 0) + 1;
        }
        let best = tiles[y * MAP_W + x], bc = 0;
        for (const k in counts) if (counts[k] > bc) { bc = counts[k]; best = +k; }
        tmp[y * MAP_W + x] = best;
      }
    }
    tiles.set(tmp);
  }
  const sx = Math.floor(MAP_W / 2), sy = Math.floor(MAP_H / 2);
  for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) tiles[(sy + oy) * MAP_W + (sx + ox)] = 2;
  return tiles;
}

const MAP_TILES = buildMap();

function tileAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 0;
  return MAP_TILES[ty * MAP_W + tx];
}

function isWalkablePx(px, py) {
  return !!WALKABLE[tileAt(Math.floor(px / TILE_PX), Math.floor(py / TILE_PX))];
}

// Vérifie que le segment (ax,ay)→(bx,by) reste sur des tiles walkables
function segmentOk(ax, ay, bx, by, steps = 30) {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!isWalkablePx(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

// ─── Triangle (défini en tiles, converti en px centre-de-tile) ────────────
//
// Tiles choisis dans la zone herbe/forêt confirmée par buildMap() :
//   A = tile (28, 10)  →  px (1425, 525)
//   B = tile (30, 29)  →  px (1525, 1475)
//   C = tile (16, 26)  →  px (825,  1325)
//
function tilePx(tx, ty) {
  return { x: tx * TILE_PX + TILE_PX / 2, y: ty * TILE_PX + TILE_PX / 2 };
}

const TRIANGLE_TILES = [
  { tx: 28, ty: 10 },  // A — haut-droite
  { tx: 30, ty: 29 },  // B — bas-droite
  { tx: 16, ty: 26 },  // C — bas-gauche
];

// Validation au démarrage
for (const { tx, ty } of TRIANGLE_TILES) {
  const t = tileAt(tx, ty);
  if (!WALKABLE[t]) {
    console.error(`❌ Sommet (${tx},${ty}) n'est pas walkable (tile=${t}) !`);
    process.exit(1);
  }
}

const [A, B, C] = TRIANGLE_TILES.map(({ tx, ty }) => tilePx(tx, ty));

for (const [p1, p2, name] of [[A, B, 'A→B'], [B, C, 'B→C'], [C, A, 'C→A']]) {
  if (!segmentOk(p1.x, p1.y, p2.x, p2.y)) {
    console.warn(`⚠️  Segment ${name} passe par de l'eau — ajuste les sommets si nécessaire.`);
  }
}

const DIST_AB    = Math.hypot(B.x - A.x, B.y - A.y);
const DIST_BC    = Math.hypot(C.x - B.x, C.y - B.y);
const DIST_CA    = Math.hypot(A.x - C.x, A.y - C.y);
const DIST_TOTAL = DIST_AB + DIST_BC + DIST_CA;
const CYCLE_MS   = Math.round((DIST_TOTAL / SPEED_PX_PER_SEC) * 1000);
const FRAC_AB    = DIST_AB / DIST_TOTAL;
const FRAC_BC    = DIST_BC / DIST_TOTAL;

const SEGMENTS = [
  { from: A, to: B, dist: DIST_AB, name: 'A→B', fracStart: 0,              fracEnd: FRAC_AB           },
  { from: B, to: C, dist: DIST_BC, name: 'B→C', fracStart: FRAC_AB,        fracEnd: FRAC_AB + FRAC_BC },
  { from: C, to: A, dist: DIST_CA, name: 'C→A', fracStart: FRAC_AB + FRAC_BC, fracEnd: 1             },
];

console.log('🌿 Triangle validé :');
console.log(`   A = px(${A.x}, ${A.y})  tile(28,10)`);
console.log(`   B = px(${B.x}, ${B.y})  tile(30,29)`);
console.log(`   C = px(${C.x}, ${C.y})  tile(16,26)`);
console.log(`   Cycle : ${(CYCLE_MS / 1000).toFixed(1)} s`);

// ─── Calcul déterministe ───────────────────────────────────────────────────
function computeState(now) {
  const cycleStart = Math.floor(now / CYCLE_MS) * CYCLE_MS;
  const phase      = (now - cycleStart) / CYCLE_MS;

  const seg       = SEGMENTS.find((s) => phase < s.fracEnd) || SEGMENTS[SEGMENTS.length - 1];
  const fracInSeg = Math.min(1, (phase - seg.fracStart) / (seg.fracEnd - seg.fracStart));

  const x = seg.from.x + (seg.to.x - seg.from.x) * fracInSeg;
  const y = seg.from.y + (seg.to.y - seg.from.y) * fracInSeg;

  const durationMs = Math.round((seg.dist / SPEED_PX_PER_SEC) * 1000);
  // startTs recalé → frac côté client = fracInSeg ∈ [0,1) → animation immédiate
  const startTs  = now - Math.round(fracInSeg * durationMs);
  const remainMs = Math.round((1 - fracInSeg) * durationMs);

  return {
    x, y,
    target: {
      fromX: seg.from.x, fromY: seg.from.y,
      toX:   seg.to.x,   toY:   seg.to.y,
      startTs,
      durationMs,
    },
    lastSeen: now + remainMs,
    seg,
    fracInSeg,
    remainMs,
  };
}

// ─── Écriture Firebase ────────────────────────────────────────────────────
let db = null;

async function writeToFirebase() {
  const now   = Date.now();
  const state = computeState(now);

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

  console.log(
    `[${new Date().toISOString()}] ${state.seg.name}` +
    `  ${(state.fracInSeg * 100).toFixed(1)}%` +
    `  pos=(${state.x.toFixed(0)},${state.y.toFixed(0)})` +
    `  reste=${(state.remainMs / 1000).toFixed(1)}s`
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const app = initializeApp(FIREBASE_CONFIG);
  db = getDatabase(app);

  // Premier write immédiat
  await writeToFirebase();

  // Puis toutes les REFRESH_MS
  setInterval(writeToFirebase, REFRESH_MS);

  console.log(`✅ Botaniste en cours — refresh toutes les ${REFRESH_MS / 1000}s. Ctrl+C pour arrêter.`);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
