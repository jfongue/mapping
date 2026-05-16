// useProfile — charge/génère/persiste le profil joueur en AsyncStorage,
// + gère le brouillon de nom (input settings) et la sauvegarde par patch.
//
// Retourne :
//   { profile, draftName, setDraftName, saveProfile, validateName,
//     debugEnabled, setDebugEnabled }

import { useCallback, useEffect, useState } from 'react';
import { PROFILE_KEY } from '../constants';
import { generateProfile } from '../profile';
import { safeGetJSON, safeSetJSON } from '../storage';

const NAME_MAX_LEN = 16;

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [debugEnabled, setDebugEnabled] = useState(false);

  // Chargement / génération initiale
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let p = await safeGetJSON(PROFILE_KEY, null);
      if (!p) {
        p = generateProfile();
        safeSetJSON(PROFILE_KEY, p);
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
      safeSetJSON(PROFILE_KEY, updated);
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
