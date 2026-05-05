// NOTE: Ce fichier est la source de vérité pour MockMultiplayer et FirebaseMultiplayer.
// App.js n'utilise PAS ce module directement — il passe par firebase.js (service RTDB actif).
// src/multiplayer.js est utilisé par les tests Jest (__tests__/multiplayer.test.js).
// À terme, fusionner firebase.js ici ou adopter une couche d'abstraction commune.

// Service multijoueur — abstraction pour brancher Firebase ou autre backend.
//
// Pour activer Firebase :
//   1. crée un projet sur https://console.firebase.google.com
//   2. active Realtime Database (mode test)
//   3. remplis FIREBASE_CONFIG ci-dessous
//   4. mets USE_FIREBASE = true

const USE_FIREBASE = false;

const FIREBASE_CONFIG = {
  apiKey: 'PASTE_YOUR_KEY',
  authDomain: 'YOUR_APP.firebaseapp.com',
  databaseURL: 'https://YOUR_APP-default-rtdb.firebaseio.com',
  projectId: 'YOUR_APP',
  storageBucket: 'YOUR_APP.appspot.com',
  messagingSenderId: '',
  appId: '',
};

// === MOCK : 3 joueurs simulés ===
export class MockMultiplayer {
  constructor() {
    this.listeners = new Set();
    this.me = null;
    this.fakePlayers = [
      { id: 'mock-1', name: 'Théo', color: '#5dca8b', x: 1900, y: 1200, vx: 8, vy: 4 },
      { id: 'mock-2', name: 'Léa', color: '#9b6dbd', x: 1000, y: 1700, vx: -6, vy: 9 },
      { id: 'mock-3', name: 'Max', color: '#3d8acf', x: 1700, y: 1800, vx: 5, vy: -7 },
    ];
    this.tickHandle = null;
  }

  async init({ playerId, name, color }) {
    this.me = { id: playerId, name, color, x: 1500, y: 1500 };
    if (!this.tickHandle && typeof setInterval === 'function') {
      this.tickHandle = setInterval(() => this.tick(), 1500);
    }
  }

  // Avance les positions d'un pas (exposé pour test).
  tick() {
    for (const p of this.fakePlayers) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 200 || p.x > 2800) p.vx = -p.vx;
      if (p.y < 200 || p.y > 2800) p.vy = -p.vy;
    }
    this._emit();
  }

  updatePosition({ x, y }) {
    if (this.me) { this.me.x = x; this.me.y = y; }
  }

  subscribePlayers(cb) {
    this.listeners.add(cb);
    cb(this._snapshot());
    return () => this.listeners.delete(cb);
  }

  _snapshot() {
    return this.fakePlayers.map((p) => ({ ...p }));
  }

  _emit() {
    const snap = this._snapshot();
    for (const cb of this.listeners) cb(snap);
  }

  dispose() {
    if (this.tickHandle) { clearInterval(this.tickHandle); this.tickHandle = null; }
    this.listeners.clear();
  }
}

// === FIREBASE ===
export class FirebaseMultiplayer {
  constructor() {
    this.listeners = new Set();
    this.me = null;
    this.app = null;
    this.db = null;
    this.unsubFn = null;
    this._lastPush = 0;
  }

  async init({ playerId, name, color }) {
    const { initializeApp } = await import('firebase/app');
    const { getDatabase, ref, set, onValue, onDisconnect, serverTimestamp } = await import('firebase/database');
    this.app = initializeApp(FIREBASE_CONFIG);
    this.db = getDatabase(this.app);
    this.me = { id: playerId, name, color, x: 1500, y: 1500 };
    const myRef = ref(this.db, `players/${playerId}`);
    await set(myRef, { ...this.me, lastSeen: serverTimestamp() });
    onDisconnect(myRef).remove();

    const allRef = ref(this.db, 'players');
    this.unsubFn = onValue(allRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.values(data).filter((p) => p && p.id !== playerId);
      for (const cb of this.listeners) cb(list);
    });

    this._refs = { ref, set, myRef, serverTimestamp };
  }

  updatePosition({ x, y }) {
    if (!this.me || !this._refs) return;
    this.me.x = x; this.me.y = y;
    const now = Date.now();
    if (now - this._lastPush < 250) return;
    this._lastPush = now;
    const { set, myRef, serverTimestamp } = this._refs;
    set(myRef, { ...this.me, lastSeen: serverTimestamp() }).catch(() => {});
  }

  subscribePlayers(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  dispose() {
    if (this.unsubFn) { try { this.unsubFn(); } catch (e) {} this.unsubFn = null; }
    this.listeners.clear();
  }
}

export const multiplayer = USE_FIREBASE ? new FirebaseMultiplayer() : new MockMultiplayer();
export const isFirebaseEnabled = USE_FIREBASE;
