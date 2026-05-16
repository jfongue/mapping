// useInventory — inventaire local (lettres ramassées) persisté en AsyncStorage.
//
// Retourne : { inventory, loaded, open, setOpen, unreadCount,
//              addItem, markRead, deleteItem }

import { useCallback, useEffect, useMemo, useState } from 'react';
import { INVENTORY_KEY } from '../constants';
import { safeGetJSON, safeSetJSON } from '../storage';

export function useInventory() {
  const [inventory, setInventory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  // Chargement initial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await safeGetJSON(INVENTORY_KEY, []);
      if (cancelled) return;
      if (Array.isArray(data)) setInventory(data);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Persistance
  useEffect(() => {
    if (!loaded) return;
    safeSetJSON(INVENTORY_KEY, inventory);
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
