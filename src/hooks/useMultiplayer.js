// useMultiplayer — gère :
//   - join/leave Firebase quand le profile est prêt
//   - subscribe à la liste des autres joueurs
//   - animations interpolées par playerId (Map<id, { x, y, anim, lastKey }>)
//   - helpers tap/near/isOnline
//
// Inputs :
//   { profile, getCharPos, onJoinedDistance }
//     profile          : { id, name, color, outfit, skin, hair, hat } | null
//     getCharPos       : () => ({ x, y }) — position courante du joueur (px monde)
//     onJoinedDistance : (totalDistancePx) => void — hydrate depuis Firebase
//
// Retourne :
//   { otherPlayers, playerAnims,
//     selectedPlayer, setSelectedPlayer,
//     isOnline, computePlayerPos,
//     findTappedPlayer, findPlayerNearPoint }

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import {
  joinMultiplayer, leaveMultiplayer, subscribePlayers,
} from '../../firebase';
import { TILES_DATA, MAP_W, MAP_H, TILE_PX, findPath } from '../tilemap';
import { lerpFromTarget } from '../movement';
import { isPlayerOnline } from '../profile';
import {
  ONLINE_THRESHOLD_MS, TAP_PLAYER_RADIUS, PLAYER_NEAR_RADIUS,
} from '../constants';

const NOW_TICK_MS = 5000;

export function useMultiplayer({ profile, getCharPos, onJoinedDistance }) {
  const [otherPlayers, setOtherPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const playerAnims = useRef(new Map()).current;
  const globalNowRef = useRef(Date.now());

  // Join + subscribe
  useEffect(() => {
    if (!profile) return;
    let unsub = null;
    let alive = true;
    (async () => {
      try {
        const charPos = getCharPos ? getCharPos() : { x: 0, y: 0 };
        const result = await joinMultiplayer({
          playerId: profile.id,
          name: profile.name, color: profile.color,
          outfit: profile.outfit, skin: profile.skin,
          hair: profile.hair, hat: profile.hat,
          x: charPos.x, y: charPos.y,
        });
        if (!alive) return;
        if (result && typeof result.totalDistancePx === 'number' && result.totalDistancePx > 0) {
          onJoinedDistance?.(result.totalDistancePx);
        }
        unsub = subscribePlayers((list) => setOtherPlayers(list));
      } catch (e) {
        if (__DEV__) console.warn('[multi] join failed', e);
      }
    })();
    return () => {
      alive = false;
      if (typeof unsub === 'function') unsub();
      leaveMultiplayer().catch(() => {});
    };
  }, [profile?.id]);

  // Animation des autres joueurs (sync sur la liste + cleanup absents)
  useEffect(() => {
    const seen = new Set();
    for (const p of otherPlayers) {
      if (typeof p.x !== 'number' || typeof p.y !== 'number') continue;
      seen.add(p.id);

      let entry = playerAnims.get(p.id);
      let isNew = false;
      if (!entry) {
        isNew = true;
        const lerped = p.target ? lerpFromTarget(p.target) : null;
        const startX = lerped?.x ?? p.x;
        const startY = lerped?.y ?? p.y;
        entry = {
          x: new Animated.Value(startX),
          y: new Animated.Value(startY),
          anim: null,
          lastKey: '',
        };
        playerAnims.set(p.id, entry);
      }

      const key = p.target
        ? `${p.target.startTs}-${p.target.toX}-${p.target.toY}`
        : `static-${p.x}-${p.y}`;
      if (!isNew && key === entry.lastKey) continue;
      entry.lastKey = key;
      if (entry.anim) entry.anim.stop();

      if (p.target) {
        const t = p.target;
        const fromTx = Math.floor(t.fromX / TILE_PX);
        const fromTy = Math.floor(t.fromY / TILE_PX);
        const toTx = Math.floor(t.toX / TILE_PX);
        const toTy = Math.floor(t.toY / TILE_PX);
        const cellPath = findPath(TILES_DATA, MAP_W, MAP_H, fromTx, fromTy, toTx, toTy);

        let samples;
        if (cellPath && cellPath.length >= 2) {
          samples = cellPath.map((c) => ({
            x: c.x * TILE_PX + TILE_PX / 2,
            y: c.y * TILE_PX + TILE_PX / 2,
          }));
          samples[0] = { x: t.fromX, y: t.fromY };
          samples[samples.length - 1] = { x: t.toX, y: t.toY };
        } else {
          samples = [
            { x: t.fromX, y: t.fromY },
            { x: t.toX, y: t.toY },
          ];
        }

        const cum = [0];
        let total = 0;
        for (let i = 1; i < samples.length; i++) {
          total += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
          cum.push(total);
        }

        const elapsed = Math.max(0, Date.now() - t.startTs);
        const frac = total > 0 ? Math.min(1, elapsed / t.durationMs) : 1;

        if (frac >= 1) {
          entry.x.setValue(t.toX);
          entry.y.setValue(t.toY);
          entry.anim = null;
        } else {
          const elapsedDist = frac * total;
          let seg = 1;
          while (seg < cum.length && cum[seg] < elapsedDist) seg++;
          const a = samples[seg - 1];
          const b = samples[seg];
          const segLen = cum[seg] - cum[seg - 1];
          const tInSeg = segLen > 0 ? (elapsedDist - cum[seg - 1]) / segLen : 0;
          const startX = a.x + (b.x - a.x) * tInSeg;
          const startY = a.y + (b.y - a.y) * tInSeg;
          entry.x.setValue(startX);
          entry.y.setValue(startY);

          const steps = [];
          const firstSegRemaining = segLen * (1 - tInSeg);
          if (firstSegRemaining > 0) {
            steps.push({ x: b.x, y: b.y, dist: firstSegRemaining });
          }
          for (let i = seg + 1; i < samples.length; i++) {
            steps.push({ x: samples[i].x, y: samples[i].y, dist: cum[i] - cum[i - 1] });
          }

          const remainingMs = Math.max(50, t.durationMs - elapsed);
          const animations = steps.map((s) => {
            const dur = total > 0 ? Math.max(16, (s.dist / total) * t.durationMs) : remainingMs;
            return Animated.parallel([
              Animated.timing(entry.x, { toValue: s.x, duration: dur, easing: Easing.linear, useNativeDriver: true }),
              Animated.timing(entry.y, { toValue: s.y, duration: dur, easing: Easing.linear, useNativeDriver: true }),
            ]);
          });
          const seq = animations.length === 1 ? animations[0] : Animated.sequence(animations);
          entry.anim = seq;
          seq.start();
        }
      } else {
        entry.x.setValue(p.x);
        entry.y.setValue(p.y);
        entry.anim = null;
      }
    }
    // Cleanup joueurs disparus
    for (const id of Array.from(playerAnims.keys())) {
      if (!seen.has(id)) {
        const e = playerAnims.get(id);
        if (e?.anim) e.anim.stop();
        playerAnims.delete(id);
      }
    }
  }, [otherPlayers]);

  // Cleanup unmount global : stop toutes les anims encore en cours
  useEffect(() => {
    return () => {
      for (const e of playerAnims.values()) {
        if (e?.anim) e.anim.stop();
      }
      playerAnims.clear();
    };
  }, []);

  // globalNow tick (utilisé par isOnline)
  useEffect(() => {
    const id = setInterval(() => { globalNowRef.current = Date.now(); }, NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const isOnline = useCallback(
    (p) => isPlayerOnline(p, globalNowRef.current, ONLINE_THRESHOLD_MS),
    []
  );

  const computePlayerPos = useCallback((p) => {
    const e = playerAnims.get(p.id);
    if (e) return { x: e.x.__getValue(), y: e.y.__getValue() };
    return { x: p.x, y: p.y };
  }, []);

  const findTappedPlayer = useCallback((tap) => {
    let best = null, bestD = TAP_PLAYER_RADIUS;
    for (const p of otherPlayers) {
      const pp = computePlayerPos(p);
      const d = Math.hypot(pp.x - tap.x, pp.y - tap.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }, [otherPlayers, computePlayerPos]);

  const findPlayerNearPoint = useCallback((px, py, radius = PLAYER_NEAR_RADIUS) => {
    let best = null, bestD = radius;
    for (const p of otherPlayers) {
      const pp = computePlayerPos(p);
      const d = Math.hypot(pp.x - px, pp.y - py);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }, [otherPlayers, computePlayerPos]);

  return {
    otherPlayers, playerAnims,
    selectedPlayer, setSelectedPlayer,
    isOnline, computePlayerPos,
    findTappedPlayer, findPlayerNearPoint,
  };
}
