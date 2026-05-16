// Wrapper AsyncStorage : try/catch + JSON parse safe + warn dev.
//
// Pattern : tous les hooks/composants doivent passer par ces helpers
// pour eviter les .catch(() => {}) dispersés et garantir un log
// minimal en mode dev.

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Lit une cle, parse en JSON. Renvoie fallback si manquant / corrompu. */
export async function safeGetJSON(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    if (__DEV__) console.warn(`[storage] get(${key}) failed`, e);
    return fallback;
  }
}

/** Lit une cle en string brute. */
export async function safeGet(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : raw;
  } catch (e) {
    if (__DEV__) console.warn(`[storage] get(${key}) failed`, e);
    return fallback;
  }
}

/** Stringifie + ecrit. Ne throw jamais. */
export function safeSetJSON(key, value) {
  return AsyncStorage.setItem(key, JSON.stringify(value))
    .catch((e) => { if (__DEV__) console.warn(`[storage] set(${key}) failed`, e); });
}

/** Ecrit une string brute. Ne throw jamais. */
export function safeSet(key, value) {
  return AsyncStorage.setItem(key, String(value))
    .catch((e) => { if (__DEV__) console.warn(`[storage] set(${key}) failed`, e); });
}
