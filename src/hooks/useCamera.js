// useCamera — pan + pinch + recenter + follow loop.
//
// Inputs :
//   { getCharPos, moving, loaded }
//     getCharPos : () => ({ x, y })  position courante du joueur (px monde)
//     moving     : boolean — déclenche la follow loop
//     loaded     : boolean — déclenche le centrage initial
//
// Retourne :
//   tx, ty, dx, dy             Animated.Value (offsets)
//   baseScale, pinchScale      Animated.Value (zoom)
//   totalX, totalY             Animated.add(tx,dx), Animated.add(ty,dy)
//   viewport, setViewport
//   onCanvasLayout
//   onPanGesture, onPanStateChange, onPinchGesture, onPinchStateChange
//   recenter, centerOnPoint, markUserHasPanned
//   showRecenterBtn

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { MAP_W_PX, MAP_H_PX } from '../../components/TileLayer';
import { MIN_SCALE, MAX_SCALE, RECENTER_HIDE_RADIUS } from '../constants';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAN_THRESHOLD_PX = 5;

export function useCamera({ getCharPos, moving, loaded }) {
  const INIT_X = SCREEN_W / 2 - MAP_W_PX / 2;
  const INIT_Y = SCREEN_H / 2 - MAP_H_PX / 2;

  const [viewport, setViewport] = useState({ w: SCREEN_W, h: SCREEN_H });

  const tx = useRef(new Animated.Value(INIT_X)).current;
  const ty = useRef(new Animated.Value(INIT_Y)).current;
  const lastOffset = useRef({ x: INIT_X, y: INIT_Y });

  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const pinchStartScale = useRef(1);

  const userHasPanned = useRef(false);
  const [showRecenterBtn, setShowRecenterBtn] = useState(false);
  const followRafId = useRef(null);
  const isInitialCenter = useRef(false);

  const dx = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(0)).current;
  const totalX = useRef(Animated.add(tx, dx)).current;
  const totalY = useRef(Animated.add(ty, dy)).current;

  const pinchListenerId = useRef(null);
  const pinchAnchor = useRef({ mapX: 0, mapY: 0, focalX: 0, focalY: 0 });

  const computeCenteredOffset = useCallback((charX, charY, vw, vh, s) => {
    const cx = MAP_W_PX / 2;
    const cy = MAP_H_PX / 2;
    return {
      x: vw / 2 - s * charX - cx * (1 - s),
      y: vh / 2 - s * charY - cy * (1 - s),
    };
  }, []);

  const stopFollowLoop = useCallback(() => {
    if (followRafId.current) {
      cancelAnimationFrame(followRafId.current);
      followRafId.current = null;
    }
  }, []);

  const startFollowLoop = useCallback(() => {
    stopFollowLoop();
    const loop = () => {
      if (userHasPanned.current) return;
      const vw = viewport.w || SCREEN_W;
      const vh = viewport.h || SCREEN_H;
      const s = lastScale.current;
      const { x: charX, y: charY } = getCharPos();
      const { x: newX, y: newY } = computeCenteredOffset(charX, charY, vw, vh, s);
      tx.setValue(newX);
      ty.setValue(newY);
      lastOffset.current = { x: newX, y: newY };
      followRafId.current = requestAnimationFrame(loop);
    };
    followRafId.current = requestAnimationFrame(loop);
  }, [viewport.w, viewport.h, getCharPos, computeCenteredOffset, stopFollowLoop]);

  const markUserHasPanned = useCallback(() => {
    if (userHasPanned.current) return;
    userHasPanned.current = true;
    stopFollowLoop();
  }, [stopFollowLoop]);

  // Follow loop on/off
  useEffect(() => {
    if (moving && !userHasPanned.current) startFollowLoop();
    else stopFollowLoop();
    return stopFollowLoop;
  }, [moving, startFollowLoop, stopFollowLoop]);

  // Centrage initial
  useEffect(() => {
    if (isInitialCenter.current || !loaded || viewport.w === 0) return;
    const s = lastScale.current;
    const { x: charX, y: charY } = getCharPos();
    const { x: newX, y: newY } = computeCenteredOffset(charX, charY, viewport.w, viewport.h, s);
    tx.setValue(newX);
    ty.setValue(newY);
    lastOffset.current = { x: newX, y: newY };
    isInitialCenter.current = true;
  }, [loaded, viewport.w, viewport.h, getCharPos, computeCenteredOffset]);

  // Recenter visibility (listeners au lieu de polling)
  useEffect(() => {
    const vw = viewport.w || SCREEN_W;
    const vh = viewport.h || SCREEN_H;
    if (!vw || !vh) return;
    const cx = MAP_W_PX / 2;
    const cy = MAP_H_PX / 2;
    let pending = false;
    const recompute = () => {
      pending = false;
      const s = lastScale.current;
      const { x: charX, y: charY } = getCharPos();
      const offX = lastOffset.current.x + dx.__getValue();
      const offY = lastOffset.current.y + dy.__getValue();
      const screenX = offX + s * charX + cx * (1 - s);
      const screenY = offY + s * charY + cy * (1 - s);
      const dist = Math.hypot(screenX - vw / 2, screenY - vh / 2);
      const shouldShow = dist > RECENTER_HIDE_RADIUS;
      setShowRecenterBtn((prev) => (prev === shouldShow ? prev : shouldShow));
    };
    const schedule = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(recompute);
    };
    schedule();
    const idDx = dx.addListener(schedule);
    const idDy = dy.addListener(schedule);
    return () => {
      dx.removeListener(idDx);
      dy.removeListener(idDy);
    };
  }, [viewport.w, viewport.h, getCharPos]);

  const onPanGesture = useRef(
    Animated.event(
      [{ nativeEvent: { translationX: dx, translationY: dy } }],
      { useNativeDriver: true }
    )
  ).current;

  const onPanStateChange = useCallback((e) => {
    const { state, translationX, translationY } = e.nativeEvent;
    if (state === State.ACTIVE || state === State.END || state === State.CANCELLED) {
      const dist = Math.sqrt(translationX * translationX + translationY * translationY);
      if (dist >= PAN_THRESHOLD_PX) markUserHasPanned();
    }
    if (state === State.END || state === State.CANCELLED) {
      lastOffset.current = {
        x: lastOffset.current.x + translationX,
        y: lastOffset.current.y + translationY,
      };
      tx.setValue(lastOffset.current.x);
      ty.setValue(lastOffset.current.y);
      dx.setValue(0);
      dy.setValue(0);
    }
  }, [markUserHasPanned]);

  const onPinchGesture = useRef(
    Animated.event(
      [{ nativeEvent: { scale: pinchScale } }],
      { useNativeDriver: true }
    )
  ).current;

  const onPinchStateChange = useCallback((e) => {
    const { state, scale: gestureScale, focalX, focalY } = e.nativeEvent;
    if (state === State.BEGAN) {
      markUserHasPanned();
      pinchStartScale.current = lastScale.current;
      const s = lastScale.current;
      const cx = MAP_W_PX / 2;
      const cy = MAP_H_PX / 2;
      const focX = focalX ?? (viewport.w || SCREEN_W) / 2;
      const focY = focalY ?? (viewport.h || SCREEN_H) / 2;
      pinchAnchor.current = {
        mapX: (focX - lastOffset.current.x - cx * (1 - s)) / s,
        mapY: (focY - lastOffset.current.y - cy * (1 - s)) / s,
        focalX: focX,
        focalY: focY,
      };
      if (pinchListenerId.current !== null) pinchScale.removeListener(pinchListenerId.current);
      pinchListenerId.current = pinchScale.addListener(({ value: liveGestureScale }) => {
        const liveScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStartScale.current * liveGestureScale));
        const cx2 = MAP_W_PX / 2;
        const cy2 = MAP_H_PX / 2;
        const { mapX, mapY, focalX: fX, focalY: fY } = pinchAnchor.current;
        const newTx = fX - cx2 * (1 - liveScale) - mapX * liveScale;
        const newTy = fY - cy2 * (1 - liveScale) - mapY * liveScale;
        baseScale.setValue(liveScale);
        tx.setValue(newTx);
        ty.setValue(newTy);
        lastOffset.current = { x: newTx, y: newTy };
      });
    }
    if (state === State.END || state === State.CANCELLED) {
      if (pinchListenerId.current !== null) {
        pinchScale.removeListener(pinchListenerId.current);
        pinchListenerId.current = null;
      }
      let next = pinchStartScale.current * gestureScale;
      next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
      lastScale.current = next;
      pinchScale.setValue(1);
      baseScale.setValue(next);
      tx.setValue(lastOffset.current.x);
      ty.setValue(lastOffset.current.y);
    }
  }, [viewport.w, viewport.h, markUserHasPanned]);

  const onCanvasLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ w: width, h: height });
  }, []);

  const recenter = useCallback(() => {
    const vw = viewport.w || SCREEN_W;
    const vh = viewport.h || SCREEN_H;
    const s = lastScale.current;
    const { x: charX, y: charY } = getCharPos();
    const curOffX = lastOffset.current.x + dx.__getValue();
    const curOffY = lastOffset.current.y + dy.__getValue();
    const { x: targetX, y: targetY } = computeCenteredOffset(charX, charY, vw, vh, s);
    lastOffset.current = { x: curOffX, y: curOffY };
    dx.setValue(0);
    dy.setValue(0);
    tx.setValue(curOffX);
    ty.setValue(curOffY);
    Animated.parallel([
      Animated.timing(tx, { toValue: targetX, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ty, { toValue: targetY, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      lastOffset.current = { x: targetX, y: targetY };
      userHasPanned.current = false;
      if (moving) startFollowLoop();
    });
  }, [viewport.w, viewport.h, getCharPos, computeCenteredOffset, moving, startFollowLoop]);

  const centerOnPoint = useCallback((mapX, mapY) => {
    const vw = viewport.w || SCREEN_W;
    const vh = viewport.h || SCREEN_H;
    const s = lastScale.current;
    const cx = MAP_W_PX / 2;
    const cy = MAP_H_PX / 2;
    const targetX = vw / 2 - s * mapX - cx * (1 - s);
    const targetY = vh / 2 - s * mapY - cy * (1 - s);
    const curOffX = lastOffset.current.x + dx.__getValue();
    const curOffY = lastOffset.current.y + dy.__getValue();
    lastOffset.current = { x: curOffX, y: curOffY };
    dx.setValue(0);
    dy.setValue(0);
    tx.setValue(curOffX);
    ty.setValue(curOffY);
    userHasPanned.current = true;
    Animated.parallel([
      Animated.timing(tx, { toValue: targetX, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ty, { toValue: targetY, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      lastOffset.current = { x: targetX, y: targetY };
    });
  }, [viewport.w, viewport.h]);

  return {
    tx, ty, dx, dy, baseScale, pinchScale, totalX, totalY,
    viewport, setViewport, onCanvasLayout,
    onPanGesture, onPanStateChange, onPinchGesture, onPinchStateChange,
    recenter, centerOnPoint, markUserHasPanned,
    showRecenterBtn,
  };
}
