// useMovement — gère la position, le mouvement le long d'un path, la trip summary.
//
// Owns :
//   pos, moving, target, eta, loaded, animX, animY,
//   pendingTarget, activePathRef, frozenActivePath, consumedDist, tripSummary,
//   totalDistancePx (cumul lifetime du joueur)
//
// Inputs :
//   { profile, speedMul, letters, addInventoryItem,
//     hydratedTotalDistancePx }       totalPx hydraté depuis multiplayer.onJoinedDistance
//
// Retourne :
//   { pos, animX, animY, moving, target, eta, loaded,
//     pendingTarget, setPendingTarget,
//     activePathRef, frozenActivePath, consumedDist,
//     tripSummary, dismissTripSummary,
//     totalDistancePx, setTotalDistancePx,
//     startMoveAlongCurve, stopMove, confirmMove, cancelMove }

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import {
  announceMove, clearMyMove, updateMyProfile, consumeLetter,
} from '../../firebase';
import { safeGetJSON, safeSet, safeSetJSON } from '../storage';
import { TILE_PX, MAP_W, MAP_H } from '../tilemap';
import { sampleAt } from '../smoothing';
import { movementDurationAlongPath } from '../movement';
import { safePixelPos } from '../mapUtils';
import {
  SAVE_KEY, TOTAL_DISTANCE_KEY,
} from '../constants';

// Centre de la map en pixels (SPAWN dans constants.js est en tile coords).
const SPAWN_PX = { x: (MAP_W / 2) * TILE_PX, y: (MAP_H / 2) * TILE_PX };
import {
  scheduleArrivalNotification, cancelArrivalNotification,
} from '../notifications';

const DOT_TICK_PX = 26;

export function useMovement({ profile, speedMul, letters, addInventoryItem, hydratedTotalDistancePx }) {
  const [pos, setPos] = useState(SPAWN_PX);
  const [moving, setMoving] = useState(false);
  const [target, setTarget] = useState(null);
  const [eta, setEta] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const animX = useRef(new Animated.Value(SPAWN_PX.x)).current;
  const animY = useRef(new Animated.Value(SPAWN_PX.y)).current;
  const currentAnim = useRef(null);
  const moveTarget = useRef(null);

  const [pendingTarget, setPendingTarget] = useState(null);
  const pendingPickupRef = useRef(null);

  const activePathRef = useRef(null);
  const [frozenActivePath, setFrozenActivePath] = useState(null);
  const [consumedDist, setConsumedDist] = useState(0);
  const lastConsumedTick = useRef(0);

  const tripTotalLengthRef = useRef(0);
  const [tripSummary, setTripSummary] = useState(null);
  const tripStartedAtRef = useRef(null);

  const [totalDistancePx, setTotalDistancePx] = useState(0);

  const progressRef = useRef(null);
  const progressListenerId = useRef(null);

  // Load initial position
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await safeGetJSON(SAVE_KEY, null);
      if (cancelled) return;
      if (data?.pos) {
        const safe = safePixelPos(data.pos.x, data.pos.y);
        setPos(safe);
        animX.setValue(safe.x);
        animY.setValue(safe.y);
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist pos
  useEffect(() => {
    if (!loaded) return;
    safeSetJSON(SAVE_KEY, { pos });
  }, [loaded, pos]);

  // Hydrate total distance depuis multiplayer
  useEffect(() => {
    if (typeof hydratedTotalDistancePx === 'number' && hydratedTotalDistancePx > 0) {
      setTotalDistancePx(hydratedTotalDistancePx);
    }
  }, [hydratedTotalDistancePx]);

  const showTripSummary = useCallback((distancePx, durationMs, pickedUpItems = [], startDistancePx = 0) => {
    setTripSummary({
      distancePx: Math.max(0, Math.round(distancePx || 0)),
      durationMs: Math.max(0, Math.round(durationMs || 0)),
      pickedUpItems,
      startDistancePx,
    });
  }, []);

  const dismissTripSummary = useCallback(() => setTripSummary(null), []);

  // Garde une réf à jour vers la fonction finalizeArrival pour résoudre les cycles
  const finalizeRef = useRef(null);
  const startMoveRef = useRef(null);

  const startMoveAlongCurve = useCallback((samples, length) => {
    if (!samples || samples.length < 2) return;
    const { durationMs: baseDuration } = movementDurationAlongPath(samples);
    const dur = baseDuration / speedMul;
    moveTarget.current = samples[samples.length - 1];
    tripStartedAtRef.current = Date.now();
    tripTotalLengthRef.current = length;
    setTripSummary(null);
    setMoving(true);
    const etaMs = Date.now() + dur;
    setEta(etaMs);
    setConsumedDist(0);
    lastConsumedTick.current = 0;
    announceMove({
      from: { x: pos.x, y: pos.y },
      to: samples[samples.length - 1],
      startTs: Date.now(),
      durationMs: dur,
    });
    const last = samples[samples.length - 1];
    const destLabel = `${Math.round(last.x / TILE_PX)}, ${Math.round(last.y / TILE_PX)}`;
    scheduleArrivalNotification(etaMs, destLabel);

    // Cleanup listener précédent si reste
    if (progressListenerId.current && progressRef.current) {
      progressRef.current.removeListener(progressListenerId.current);
      progressListenerId.current = null;
    }
    const progress = new Animated.Value(0);
    progressRef.current = progress;
    progressListenerId.current = progress.addListener(({ value }) => {
      const p = sampleAt(samples, value);
      animX.setValue(p.x);
      animY.setValue(p.y);
      if (value - lastConsumedTick.current >= DOT_TICK_PX) {
        lastConsumedTick.current = value;
        setConsumedDist(value);
      }
    });
    const anim = Animated.timing(progress, {
      toValue: length, duration: dur, easing: Easing.linear, useNativeDriver: false,
    });
    currentAnim.current = anim;
    anim.start(({ finished }) => {
      if (progressListenerId.current && progressRef.current) {
        progressRef.current.removeListener(progressListenerId.current);
        progressListenerId.current = null;
      }
      if (!finished) return;
      finalizeRef.current?.(samples[samples.length - 1]);
    });
  }, [speedMul, pos.x, pos.y, animX, animY]);

  startMoveRef.current = startMoveAlongCurve;

  const finalizeArrival = useCallback((final) => {
    const tripDistancePx = tripTotalLengthRef.current || 0;
    const tripDurationMs = tripStartedAtRef.current ? Date.now() - tripStartedAtRef.current : 0;

    animX.setValue(final.x);
    animY.setValue(final.y);
    setPos({ x: final.x, y: final.y });
    clearMyMove(final.x, final.y);
    setMoving(false);
    setEta(null);
    setTarget(null);
    activePathRef.current = null;
    setFrozenActivePath(null);
    setConsumedDist(0);
    lastConsumedTick.current = 0;
    currentAnim.current = null;
    moveTarget.current = null;
    tripStartedAtRef.current = null;
    tripTotalLengthRef.current = 0;

    const pickup = pendingPickupRef.current;
    pendingPickupRef.current = null;

    const pickedUpItems = [];
    if (pickup && pickup.id) {
      const stillThere = letters.some((l) => l.id === pickup.id);
      if (stillThere) {
        const newItem = {
          id: pickup.id, authorId: pickup.authorId,
          authorName: pickup.authorName, authorColor: pickup.authorColor,
          text: pickup.text, pickedAt: Date.now(), unread: true,
        };
        addInventoryItem(newItem);
        consumeLetter(pickup.id).catch(() => {});
        pickedUpItems.push(newItem);
      }
    }

    if (tripDistancePx > 0) {
      setTotalDistancePx((prev) => {
        const newTotal = prev + tripDistancePx;
        safeSet(TOTAL_DISTANCE_KEY, newTotal);
        const profileUpdate = updateMyProfile({ totalDistancePx: newTotal });
        if (profileUpdate && typeof profileUpdate.catch === 'function') {
          profileUpdate.catch(() => {});
        }
        if (tripDistancePx > 0 || tripDurationMs > 0) {
          showTripSummary(tripDistancePx, tripDurationMs, pickedUpItems, prev);
        }
        return newTotal;
      });
    } else if (tripDurationMs > 0) {
      showTripSummary(0, tripDurationMs, pickedUpItems, totalDistancePx);
    }
  }, [letters, addInventoryItem, animX, animY, showTripSummary, totalDistancePx]);

  finalizeRef.current = finalizeArrival;

  const confirmMove = useCallback(() => {
    if (!pendingTarget) return;
    const samples = pendingTarget.samples;
    const length = pendingTarget.length;
    activePathRef.current = samples;
    setFrozenActivePath(samples);
    pendingPickupRef.current = pendingTarget.pickupLetter || null;
    setPendingTarget(null);
    setTarget({ x: pendingTarget.x, y: pendingTarget.y });
    startMoveAlongCurve(samples, length);
  }, [pendingTarget, startMoveAlongCurve]);

  const cancelMove = useCallback(() => setPendingTarget(null), []);

  const stopMove = useCallback(() => {
    if (currentAnim.current) currentAnim.current.stop();
    if (progressListenerId.current && progressRef.current) {
      progressRef.current.removeListener(progressListenerId.current);
      progressListenerId.current = null;
    }
    cancelArrivalNotification();
    pendingPickupRef.current = null;
    finalizeArrival({ x: animX.__getValue(), y: animY.__getValue() });
  }, [finalizeArrival, animX, animY]);

  // Recompute le path quand speedMul change (boost vitesse)
  // (relance startMoveAlongCurve depuis la position courante)
  useEffect(() => {
    if (!moving || !moveTarget.current) return;
    const samples = activePathRef.current;
    if (!samples || samples.length < 2) return;
    if (currentAnim.current) currentAnim.current.stop();
    // Repath depuis position courante vers le même dest (simple : on prend les samples restants
    // approximatifs : on rebuild un path linéaire de pos courante → fin)
    const cx = animX.__getValue();
    const cy = animY.__getValue();
    const last = samples[samples.length - 1];
    const newSamples = [{ x: cx, y: cy }, { x: last.x, y: last.y }];
    const length = Math.hypot(last.x - cx, last.y - cy);
    activePathRef.current = newSamples;
    startMoveRef.current?.(newSamples, length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedMul]);

  // Cleanup unmount : stop anim + remove listener
  useEffect(() => () => {
    if (currentAnim.current) currentAnim.current.stop();
    if (progressListenerId.current && progressRef.current) {
      progressRef.current.removeListener(progressListenerId.current);
      progressListenerId.current = null;
    }
    cancelArrivalNotification();
  }, []);

  return {
    pos, animX, animY, moving, target, eta, loaded,
    pendingTarget, setPendingTarget,
    activePathRef, frozenActivePath, consumedDist,
    tripSummary, dismissTripSummary,
    totalDistancePx, setTotalDistancePx,
    startMoveAlongCurve, stopMove, confirmMove, cancelMove,
    pendingPickupRef,
  };
}
