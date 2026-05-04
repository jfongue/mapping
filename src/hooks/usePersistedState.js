// Hook : useState synchronisé avec AsyncStorage. Hydrate au mount.
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function usePersistedState(key, initial) {
  const [state, setState] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const skipNextSave = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) setState(JSON.parse(raw));
      } catch (e) {}
      setLoaded(true);
    })();
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    AsyncStorage.setItem(key, JSON.stringify(state)).catch(() => {});
  }, [key, loaded, state]);

  return [state, setState, loaded];
}
