// Service multijoueur Firebase Realtime Database
// Schéma RTDB :
//   /players/{playerId} = { id, name, color, x, y, target?: {fromX,fromY,toX,toY,startTs,durationMs}, lastSeen }
//
// La Botaniste Rebelle est gérée exclusivement par scripts/botaniste.js (Node).
// Côté client elle est un joueur ordinaire, lue depuis Firebase comme les autres.

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
