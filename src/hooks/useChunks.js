// useChunks — hook React qui maintient le ChunkRegistry synchronisé
// avec la position caméra.
//
// Retourne la Map des chunks actifs à chaque mise à jour.
// La caméra « world position » est déduite de l'offset Animated + scale.

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChunkRegistry } from '../chunkManager';
import { setChunkRegistry } from '../tilemap';

/**
 * @param {object} opts
 * @param {React.MutableRefObject} opts.lastOffset  ref { x, y } (offset caméra)
 * @param {React.MutableRefObject} opts.lastScale   ref number
 * @param {number} opts.viewW   largeur du viewport (px écran)
 * @param {number} opts.viewH   hauteur du viewport (px écran)
 * @param {number} opts.mapW    largeur de la map (px)
 * @param {number} opts.mapH    hauteur de la map (px)
 */
export function useChunks({ lastOffset, lastScale, viewW, viewH, mapW, mapH }) {
  const registryRef = useRef(null);
  const [chunks, setChunks] = useState(new Map());
  const rafRef = useRef(null);

  // Crée le registry une seule fois
  if (!registryRef.current) {
    const reg = createChunkRegistry();
    registryRef.current = reg;
    setChunkRegistry(reg); // injecte dans tilemap.js pour le pathfinding
  }

  const update = useCallback(() => {
    const reg = registryRef.current;
    if (!reg || !viewW || !viewH) return;

    const s = lastScale.current;
    const offX = lastOffset.current.x;
    const offY = lastOffset.current.y;

    // Coin supérieur-gauche de la map dans l'espace monde
    // offset = translateX de la map dans le viewport
    // monde_x = (screen_x - offset) / scale
    const camLeft  = Math.max(0, -offX / s);
    const camTop   = Math.max(0, -offY / s);
    const camRight  = Math.min(mapW, camLeft  + viewW / s);
    const camBottom = Math.min(mapH, camTop   + viewH / s);

    const updated = reg.update(camLeft, camTop, camRight - camLeft, camBottom - camTop);
    // Crée une nouvelle Map pour forcer le re-render
    setChunks(new Map(updated));
  }, [viewW, viewH, mapW, mapH]);

  // Boucle RAF : met à jour les chunks à chaque frame
  useEffect(() => {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      update();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [update]);

  return chunks;
}
