// Service multijoueur Firebase Realtime Database
// Schéma RTDB :
//   /players/{playerId} = { id, name, color, x, y, target?: {x,y, startTs, durationMs}, lastSeen }
//
// updatePosition(): écrit la position courante (throttled 250ms)
// announceMove(target, durationMs): écrit le trajet en cours pour que les autres voient la trajectoire
// subscribePlayers(cb): callback avec la liste de tous les joueurs sauf moi

import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, set, update, remove, push,
  onValue, onDisconnect, serverTimestamp,
} from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyC63kxXSMBKycCMedL4mGl3rB6atk4TstE',
  authDomain: 'treasure-quest-proto.firebaseapp.com',
  databaseURL: 'https://treasure-quest-proto-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'treasure-quest-proto',
  storageBucket: 'treasure-quest-proto.firebasestorage.app',
  messagingSenderId: '176526916404',
  appId: '1:176526916404:web:2dab74b18dd293aff2c361',
};

let app = null;
let db = null;
let myId = null;
let myRef = null;
let listeners = new Set();
let unsubAll = null;
let lastPush = 0;
let latestPlayers = null;
const PUSH_THROTTLE_MS = 250;

function ensureInit() {
  if (app) return;
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

// ─── La Botaniste Rebelle — injection déterministe ─────────────────────────────
//
// Triangle centré sur la zone terrestre (1000, 1000), rayon ~600 px :
//
//            A (1000, 400)
//           /              \
//          /                \
//   C (480, 1300)  ────  B (1520, 1300)
//
const _B_SPEED = 80; // px/s, identique à SPEED_PX_PER_SEC

const _B_A = { x: 1000, y:  400 }; // haut-centre
const _B_B = { x: 1520, y: 1300 }; // bas-droite
const _B_C = { x:  480, y: 1300 }; // bas-gauche

const _B_DIST_AB    = Math.hypot(_B_B.x - _B_A.x, _B_B.y - _B_A.y);
const _B_DIST_BC    = Math.hypot(_B_C.x - _B_B.x, _B_C.y - _B_B.y);
const _B_DIST_CA    = Math.hypot(_B_A.x - _B_C.x, _B_A.y - _B_C.y);
const _B_DIST_TOTAL = _B_DIST_AB + _B_DIST_BC + _B_DIST_CA;
const _B_CYCLE_MS   = Math.round((_B_DIST_TOTAL / _B_SPEED) * 1000);
const _B_FRAC_AB    = _B_DIST_AB / _B_DIST_TOTAL;
const _B_FRAC_BC    = _B_DIST_BC / _B_DIST_TOTAL;

const _B_SEGMENTS = [
  { from: _B_A, to: _B_B, dist: _B_DIST_AB, fracStart: 0,                       fracEnd: _B_FRAC_AB                },
  { from: _B_B, to: _B_C, dist: _B_DIST_BC, fracStart: _B_FRAC_AB,              fracEnd: _B_FRAC_AB + _B_FRAC_BC  },
  { from: _B_C, to: _B_A, dist: _B_DIST_CA, fracStart: _B_FRAC_AB + _B_FRAC_BC, fracEnd: 1                        },
];

function _botaniste_computeState(now) {
  const cycleStart = Math.floor(now / _B_CYCLE_MS) * _B_CYCLE_MS;
  const phase      = (now - cycleStart) / _B_CYCLE_MS;

  const seg = _B_SEGMENTS.find((s) => phase < s.fracEnd) || _B_SEGMENTS[_B_SEGMENTS.length - 1];

  const fracInSeg  = (phase - seg.fracStart) / (seg.fracEnd - seg.fracStart);
  const x          = seg.from.x + (seg.to.x - seg.from.x) * fracInSeg;
  const y          = seg.from.y + (seg.to.y - seg.from.y) * fracInSeg;

  const durationMs = Math.round((seg.dist / _B_SPEED) * 1000);
  const startTs    = now - Math.round(fracInSeg * durationMs);
  const remainMs   = Math.round((1 - fracInSeg) * durationMs);

  return {
    x, y,
    target: {
      fromX: seg.from.x, fromY: seg.from.y,
      toX:   seg.to.x,   toY:   seg.to.y,
      startTs,
      durationMs,
    },
    lastSeen: now + remainMs,
  };
}

async function injectBotaniste() {
  const now   = Date.now();
  const state = _botaniste_computeState(now);
  await update(ref(db, 'players/botaniste_rebelle'), {
    id:       'botaniste_rebelle',
    name:     'La Botaniste Rebelle',
    color:    '#5dca8b',
    outfit:   'green',
    skin:     'light',
    hair:     'black',
    hat:      'none',
    x:        state.x,
    y:        state.y,
    target:   state.target,
    lastSeen: state.lastSeen,
  }).catch(() => {});
}

// ──────────────────────────────────────────────────────────────────────────────────────

export async function joinMultiplayer({ playerId, name, color, x, y, outfit, skin, hair, hat }) {
  ensureInit();
  myId = playerId;
  myRef = ref(db, `players/${playerId}`);
  await update(myRef, {
    id: playerId, name, color,
    x, y,
    outfit: outfit ?? 'gray',
    skin:   skin   ?? 'light',
    hair:   hair   ?? 'brown',
    hat:    hat    ?? 'none',
    lastSeen: Date.now(),
  });
  onDisconnect(myRef).update({ lastSeen: Date.now() - 60_000 });

  // Injection de la Botaniste (reset + position exacte sur le triangle)
  await injectBotaniste();

  const allRef = ref(db, 'players');
  unsubAll = onValue(allRef, (snap) => {
    const data = snap.val() || {};
    const list = Object.values(data).filter((p) => p && p.id !== playerId);
    latestPlayers = list;
    for (const cb of listeners) cb(list);
  });
}

export function updateMyPosition(x, y) {
  if (!myRef) return;
  const now = Date.now();
  if (now - lastPush < PUSH_THROTTLE_MS) return;
  lastPush = now;
  update(myRef, { x, y, lastSeen: Date.now() }).catch(() => {});
}

export function announceMove({ from, to, startTs, durationMs }) {
  if (!myRef) return;
  update(myRef, {
    target: { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, startTs, durationMs },
    lastSeen: Date.now(),
  }).catch(() => {});
}

export function updateMyProfile(patch) {
  if (!myRef) return;
  update(myRef, { ...patch, lastSeen: Date.now() }).catch(() => {});
}

export function clearMyMove(finalX, finalY) {
  if (!myRef) return;
  const patch = { target: null, lastSeen: Date.now() };
  if (typeof finalX === 'number') patch.x = finalX;
  if (typeof finalY === 'number') patch.y = finalY;
  update(myRef, patch).catch(() => {});
}

export function subscribePlayers(cb) {
  listeners.add(cb);
  if (latestPlayers) cb(latestPlayers);
  return () => listeners.delete(cb);
}

// ===== Letters =====
let unsubLetters = null;
let lettersListeners = new Set();

export async function dropLetter({ authorId, authorName, authorColor, x, y, text }) {
  ensureInit();
  const lettersRef = ref(db, 'letters');
  const newRef = push(lettersRef);
  await set(newRef, {
    id: newRef.key,
    authorId, authorName, authorColor,
    x, y,
    text: String(text || '').slice(0, 200),
    createdAt: serverTimestamp(),
  });
  return newRef.key;
}

export async function consumeLetter(letterId) {
  ensureInit();
  await remove(ref(db, `letters/${letterId}`)).catch(() => {});
}

export function subscribeLetters(cb) {
  ensureInit();
  lettersListeners.add(cb);
  if (!unsubLetters) {
    const lettersRef = ref(db, 'letters');
    unsubLetters = onValue(lettersRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.values(data).filter(Boolean);
      for (const fn of lettersListeners) fn(list);
    });
  }
  return () => {
    lettersListeners.delete(cb);
    if (lettersListeners.size === 0 && unsubLetters) {
      unsubLetters();
      unsubLetters = null;
    }
  };
}

export async function leaveMultiplayer() {
  if (myRef) {
    await update(myRef, { lastSeen: Date.now() - 60_000 }).catch(() => {});
    myRef = null;
  }
  if (unsubAll) {
    unsubAll();
    unsubAll = null;
  }
  listeners.clear();
  latestPlayers = null;
}
