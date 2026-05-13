// useInventory — inventaire local (lettres ramassées) persisté en AsyncStorage.
//
// Retourne : { inventory, loaded, open, setOpen, unreadCount,
//              addItem, markRead, deleteItem }

import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INVENTORY_KEY } from '../constants';

export function useInventory() {
  const [inventory, setInventory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  // Chargement initial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(INVENTORY_KEY);
        if (!cancelled && raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) setInventory(data);
        }
      } catch (e) {
        if (__DEV__) console.warn('[inventory] load failed', e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persistance
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory))
      .catch((e) => __DEV__ && console.warn('[inventory] save failed', e));
  }, [inventory, loaded]);

  const addItem = useCallback((item) => {
    setInventory((prev) => (prev.some((l) => l.id === item.id) ? prev : [...prev, item]));
  }, []);

  const markRead = useCallback((id) => {
    setInventory((prev) => prev.map((l) => (l.id === id ? { ...l, unread: false } : l)));
  }, []);

  const deleteItem = useCallback((id) => {
    setInventory((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const unreadCount = useMemo(
    () => inventory.filter((l) => l.unread).length,
    [inventory]
  );

  return { inventory, loaded, open, setOpen, unreadCount, addItem, markRead, deleteItem };
}
