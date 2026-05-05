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
let latestPlayers = null; // dernier snapshot connu, pour replay au subscribe
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
  // À la déconnexion : juste maj lastSeen, on garde la trace
  // serverTimestamp() est interdit dans onDisconnect (SDK web v9).
  // On utilise un timestamp client suffisamment passé pour déclencher le seuil offline.
  onDisconnect(myRef).update({ lastSeen: Date.now() - 60_000 });

  // Subscribe à tous les joueurs
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

// Annonce un trajet : les autres clients pourront afficher la trajectoire
export function announceMove({ from, to, startTs, durationMs }) {
  if (!myRef) return;
  update(myRef, {
    target: { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, startTs, durationMs },
    lastSeen: Date.now(),
  }).catch(() => {});
}

export function updateMyProfile({ name, color }) {
  if (!myRef) return;
  const patch = { lastSeen: Date.now() };
  if (name !== undefined) patch.name = name;
  if (color !== undefined) patch.color = color;
  update(myRef, patch).catch(() => {});
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
  // Replay du dernier snapshot pour éviter la race entre onValue (1er fire)
  // et l'ajout du listener côté composant.
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

// Détruit une lettre (appelé après lecture).
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
    // On ne supprime PAS le nœud : remove() + joinMultiplayer() en race condition
    // provoque des états fantômes. On marque simplement lastSeen dans le passé
    // pour que les autres clients considèrent ce joueur comme offline.
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
