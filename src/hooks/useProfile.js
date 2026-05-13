// useProfile — charge/génère/persiste le profil joueur en AsyncStorage,
// + gère le brouillon de nom (input settings) et la sauvegarde par patch.
//
// Retourne :
//   { profile, draftName, setDraftName, saveProfile, validateName,
//     debugEnabled, setDebugEnabled }

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PROFILE_KEY } from '../constants';
import { generateProfile } from '../profile';

const NAME_MAX_LEN = 16;

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [debugEnabled, setDebugEnabled] = useState(false);

  // Chargement / génération initiale
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let p = null;
      try {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
        if (raw) p = JSON.parse(raw);
      } catch (e) {
        if (__DEV__) console.warn('[profile] load failed', e);
      }
      if (!p) {
        p = generateProfile();
        AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p))
          .catch((e) => __DEV__ && console.warn('[profile] save failed', e));
      }
      if (cancelled) return;
      setProfile(p);
      setDebugEnabled(!!p.debug);
    })();
    return () => { cancelled = true; };
  }, []);

  const saveProfile = useCallback((patch) => {
    setProfile((prev) => {
      const updated = { ...prev, ...patch };
      AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated))
        .catch((e) => __DEV__ && console.warn('[profile] save failed', e));
      return updated;
    });
  }, []);

  const validateName = useCallback(() => {
    const trimmed = (draftName || '').trim().slice(0, NAME_MAX_LEN);
    if (trimmed && trimmed !== profile?.name) saveProfile({ name: trimmed });
  }, [draftName, profile?.name, saveProfile]);

  return {
    profile,
    draftName, setDraftName,
    saveProfile, validateName,
    debugEnabled, setDebugEnabled,
  };
}
