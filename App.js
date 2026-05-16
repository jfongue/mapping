// Treasure Quest — App principal
// Logique pure dans /src, composants UI dans /components.
// App.js orchestre uniquement : état React, gestes, animations natives.

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, Dimensions, Animated, Easing,
  TouchableWithoutFeedback, TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import {
  GestureHandlerRootView, PanGestureHandler, PinchGestureHandler, State,
} from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  announceMove, clearMyMove, updateMyProfile,
  dropLetter, consumeLetter,
} from './firebase';

import {
  MIN_SCALE, MAX_SCALE,
  TOP_SAFE, SAVE_KEY,
  TOTAL_DISTANCE_KEY,
  RECENTER_HIDE_RADIUS, FOG_REVEAL_RADIUS,
  WATER_COLOR,
} from './src/constants';
import { THEME } from './src/theme';

// --- Notifications ---
import {
  requestNotificationPermissions,
  scheduleArrivalNotification,
  cancelArrivalNotification,
} from './src/notifications';

import { TILES_DATA, MAP_W, MAP_H, TILE_PX, WALKABLE, findPath } from './src/tilemap';
import { sampleAt } from './src/smoothing';
import TileLayer, { MAP_W_PX, MAP_H_PX } from './components/TileLayer';
import DottedTrail from './components/DottedTrail';
import XPBar from './components/XPBar';
import FogLayer from './components/FogLayer';
import { useFogCharPos } from './src/hooks/useFogCharPos';
import { useFogOfWar } from './src/hooks/useFogOfWar';
import { useFollowedPlayers } from './src/hooks/useFollowedPlayers';
import { useInventory } from './src/hooks/useInventory';
import { useBoostSpeed } from './src/hooks/useBoostSpeed';
import { useSpriteAnims } from './src/hooks/useSpriteAnims';
import { useProfile } from './src/hooks/useProfile';
import { useLetters } from './src/hooks/useLetters';
import { useMultiplayer } from './src/hooks/useMultiplayer';

import { safePixelPos, buildStraightPath, findRandomWalkableTileNear } from './src/mapUtils';

const MAP_SIZE = MAP_W_PX;
const SPAWN = { x: (MAP_W / 2) * TILE_PX, y: (MAP_H / 2) * TILE_PX };
import { formatMeters, formatDuration } from './src/format';
import { movementDurationAlongPath, movementDuration } from './src/movement';

import SleepyZzz from './components/SleepyZzz';
import SmoothEdgeArrow from './components/SmoothEdgeArrow';
import SettingsModal from './components/SettingsModal';
import PlayerDetailModal from './components/PlayerDetailModal';
import LetterWriteModal from './components/LetterWriteModal';
import LetterReadModal from './components/LetterReadModal';
import InventoryModal from './components/InventoryModal';
import { ConfirmationBar, TravelingBar } from './components/TravelBars';
import { AdventurerSprite } from './components/Adventurer';
import { ScrollText, Settings, Crosshair, Backpack, Heart } from 'lucide-react-native';
import { DEBUG_MESSAGES, DEBUG_MESSAGE_AUTHORS } from './src/debugMessages';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const INIT_X = SCREEN_W / 2 - MAP_SIZE / 2;
const INIT_Y = SCREEN_H / 2 - MAP_SIZE / 2;

const PAN_THRESHOLD_PX = 5;

export default function App() {
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

  const [pos, setPos] = useState(SPAWN);
  const [moving, setMoving] = useState(false);
  const [target, setTarget] = useState(null);
  const [eta, setEta] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const animX = useRef(new Animated.Value(SPAWN.x)).current;
  const animY = useRef(new Animated.Value(SPAWN.y)).current;
  const currentAnim = useRef(null);
  const moveTarget = useRef(null);
  const moveBaseDuration = useRef(0);

  const { bounce, breathe } = useSpriteAnims(moving);

  const { speedLvl, speedMul, onPressIn: onSpeedPressIn, onPressOut: onSpeedPressOut } = useBoostSpeed();

  const {
    profile, draftName, setDraftName,
    saveProfile: persistProfile,
    debugEnabled, setDebugEnabled,
  } = useProfile();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [pendingTarget, setPendingTarget] = useState(null);

  const {
    letters,
    writeOpen: letterWriteOpen, setWriteOpen: setLetterWriteOpen,
    draft: letterDraft, setDraft: setLetterDraft,
    readingLetter, setReadingLetter,
    openWrite: openLetterWrite,
    sendLetter,
    closeReadingLetter,
    findLetterNearPoint,
  } = useLetters({ profile, pos });

  const {
    inventory,
    open: inventoryOpen,
    setOpen: setInventoryOpen,
    unreadCount,
    addItem: addInventoryItem,
    markRead: markInventoryRead,
    deleteItem: deleteInventoryItem,
  } = useInventory();

  const [totalDistancePx, setTotalDistancePx] = useState(0);

  const {
    otherPlayers, playerAnims,
    selectedPlayer, setSelectedPlayer,
    isOnline, computePlayerPos,
    findTappedPlayer, findPlayerNearPoint,
  } = useMultiplayer({
    profile,
    getCharPos: () => ({ x: animX.__getValue(), y: animY.__getValue() }),
    onJoinedDistance: (totalPx) => {
      setTotalDistancePx(totalPx);
      AsyncStorage.setItem(TOTAL_DISTANCE_KEY, totalPx.toString()).catch(() => {});
    },
  });

  const activePathRef = useRef(null);
  const [frozenActivePath, setFrozenActivePath] = useState(null);
  const [consumedDist, setConsumedDist] = useState(0);
  const lastConsumedTick = useRef(0);

  const tripTotalLengthRef = useRef(0);
  const [tripSummary, setTripSummary] = useState(null);
  const tripStartedAtRef = useRef(null);

  const dx = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(0)).current;

  const totalX = Animated.add(tx, dx);
  const totalY = Animated.add(ty, dy);

  const pinchListenerId = useRef(null);

  // --- Brouillard de guerre ---
  // Position du personnage en JS (pas Animated.Value) pour le FogLayer
  const fogCharPos = useFogCharPos(animX, animY, 20);
  const { explored } = useFogOfWar({ animX, animY, moving, loaded });

  // --- Suivi de joueurs ---
  const { followed: followedPlayers, toggle: toggleFollow } = useFollowedPlayers();
  const [playersListOpen, setPlayersListOpen] = useState(false);

  const computeCenteredOffset = (charX, charY, vw, vh, s) => {
    const cx = MAP_W_PX / 2;
    const cy = MAP_H_PX / 2;
    return {
      x: vw / 2 - s * charX - cx * (1 - s),
      y: vh / 2 - s * charY - cy * (1 - s),
    };
  };

  const markUserHasPanned = () => {
    if (userHasPanned.current) return;
    userHasPanned.current = true;
    stopFollowLoop();
  };

  const stopFollowLoop = () => {
    if (followRafId.current) {
      cancelAnimationFrame(followRafId.current);
      followRafId.current = null;
    }
  };

  const startFollowLoop = () => {
    stopFollowLoop();
    const loop = () => {
      if (userHasPanned.current) return;
      const vw = viewport.w || SCREEN_W;
      const vh = viewport.h || SCREEN_H;
      const s = lastScale.current;
      const charX = animX.__getValue();
      const charY = animY.__getValue();
      const { x: newX, y: newY } = computeCenteredOffset(charX, charY, vw, vh, s);
      tx.setValue(newX);
      ty.setValue(newY);
      lastOffset.current = { x: newX, y: newY };
      followRafId.current = requestAnimationFrame(loop);
    };
    followRafId.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    if (moving && !userHasPanned.current) {
      startFollowLoop();
    } else {
      stopFollowLoop();
    }
    return stopFollowLoop;
  }, [moving]);

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data?.pos) {
            const safe = safePixelPos(data.pos.x, data.pos.y);
            setPos(safe);
            animX.setValue(safe.x);
            animY.setValue(safe.y);
          }
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SAVE_KEY, JSON.stringify({ pos })).catch(() => {});
  }, [loaded, pos]);

  // Visibilité bouton recenter : on recalcule sur chaque tick d'Animated
  // (pan, pinch, mouvement) au lieu d'un polling 150ms permanent.
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
      const charX = animX.__getValue();
      const charY = animY.__getValue();
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
    // Recompute initial puis sur chaque changement d'animX/animY/dx/dy
    schedule();
    const ids = [
      animX.addListener(schedule),
      animY.addListener(schedule),
      dx.addListener(schedule),
      dy.addListener(schedule),
    ];
    return () => {
      animX.removeListener(ids[0]);
      animY.removeListener(ids[1]);
      dx.removeListener(ids[2]);
      dy.removeListener(ids[3]);
    };
  }, [viewport.w, viewport.h]);

  useEffect(() => {
    if (isInitialCenter.current || !loaded || viewport.w === 0) return;
    const s = lastScale.current;
    const vw = viewport.w;
    const vh = viewport.h;
    const charX = animX.__getValue();
    const charY = animY.__getValue();
    const { x: newX, y: newY } = computeCenteredOffset(charX, charY, vw, vh, s);
    tx.setValue(newX);
    ty.setValue(newY);
    lastOffset.current = { x: newX, y: newY };
    isInitialCenter.current = true;
  }, [loaded, viewport.w, viewport.h]);

  useEffect(() => {
    if (!moving || !moveTarget.current) return;
    const samples = activePathRef.current;
    if (!samples || samples.length < 2) return;
    if (currentAnim.current) currentAnim.current.stop();
    const cx = animX.__getValue();
    const cy = animY.__getValue();
    const sx = Math.floor(cx / TILE_PX);
    const sy = Math.floor(cy / TILE_PX);
    const last = samples[samples.length - 1];
    const fx = Math.floor(last.x / TILE_PX);
    const fy = Math.floor(last.y / TILE_PX);
    const cellPath = findPath(TILES_DATA, MAP_W, MAP_H, sx, sy, fx, fy);
    if (!cellPath) return;
    const { samples: newSamples, length } = buildStraightPath(cellPath, { x: cx, y: cy });
    activePathRef.current = newSamples;
    startMoveAlongCurve(newSamples, length);
  }, [speedMul]);

  const onPanGesture = Animated.event(
    [{ nativeEvent: { translationX: dx, translationY: dy } }],
    { useNativeDriver: true }
  );

  const onPanStateChange = (e) => {
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
  };

  const onPinchGesture = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const pinchAnchor = useRef({ mapX: 0, mapY: 0, focalX: 0, focalY: 0 });

  const onPinchStateChange = (e) => {
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
  };

  const onCanvasLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ w: width, h: height });
  };

  const handleTap = (evt) => {
    const t = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };
    const tappedPlayer = findTappedPlayer(t);
    if (tappedPlayer) { setSelectedPlayer(tappedPlayer); return; }
    if (moving) return;
    if (pendingTarget) {
      const d = Math.hypot(pendingTarget.x - t.x, pendingTarget.y - t.y);
      if (d > 30) setPendingTarget(null);
      return;
    }
    const nearLetter = findLetterNearPoint(t.x, t.y, 40);
    let goalX = t.x, goalY = t.y;
    if (nearLetter) { goalX = nearLetter.x; goalY = nearLetter.y; }
    const sx = Math.floor(pos.x / TILE_PX);
    const sy = Math.floor(pos.y / TILE_PX);
    const tx2 = Math.floor(goalX / TILE_PX);
    const ty2 = Math.floor(goalY / TILE_PX);
    const cellPath = findPath(TILES_DATA, MAP_W, MAP_H, sx, sy, tx2, ty2);
    if (!cellPath) return;
    const { samples, length } = buildStraightPath(cellPath, pos);
    const finalPx = samples[samples.length - 1];
    const pickupLetter = nearLetter || findLetterNearPoint(finalPx.x, finalPx.y);
    const nearPlayer = pickupLetter ? null : findPlayerNearPoint(finalPx.x, finalPx.y);
    setPendingTarget({
      ...finalPx, samples, length,
      pickupLetter: pickupLetter || null,
      nearPlayer: nearPlayer || null,
    });
  };

  const pendingPickupRef = useRef(null);

  const confirmMove = () => {
    if (!pendingTarget) return;
    const samples = pendingTarget.samples;
    const length = pendingTarget.length;
    activePathRef.current = samples;
    setFrozenActivePath(samples);
    pendingPickupRef.current = pendingTarget.pickupLetter || null;
    setPendingTarget(null);
    setTarget({ x: pendingTarget.x, y: pendingTarget.y });
    startMoveAlongCurve(samples, length);
  };

  const cancelMove = () => setPendingTarget(null);

  const stopMove = () => {
    if (currentAnim.current) currentAnim.current.stop();
    if (progressListenerId.current && progressRef.current) {
      progressRef.current.removeListener(progressListenerId.current);
      progressListenerId.current = null;
    }
    cancelArrivalNotification();
    pendingPickupRef.current = null;
    const cx = animX.__getValue();
    const cy = animY.__getValue();
    finalizeArrival({ x: cx, y: cy });
  };

  const progressRef = useRef(null);
  const progressListenerId = useRef(null);

  const showTripSummary = (distancePx, durationMs, pickedUpItems = [], startDistancePx = 0) => {
    setTripSummary({
      distancePx: Math.max(0, Math.round(distancePx || 0)),
      durationMs: Math.max(0, Math.round(durationMs || 0)),
      pickedUpItems,
      startDistancePx,
    });
  };

  const dismissTripSummary = () => setTripSummary(null);

  const startMoveAlongCurve = (samples, length) => {
    if (!samples || samples.length < 2) return;
    const { durationMs: baseDuration } = movementDurationAlongPath(samples);
    const dur = baseDuration / speedMul;
    moveTarget.current = samples[samples.length - 1];
    moveBaseDuration.current = baseDuration;
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
    const progress = new Animated.Value(0);
    progressRef.current = progress;
    const DOT_TICK = 26;
    progressListenerId.current = progress.addListener(({ value }) => {
      const p = sampleAt(samples, value);
      animX.setValue(p.x);
      animY.setValue(p.y);
      if (value - lastConsumedTick.current >= DOT_TICK) {
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
      finalizeArrival(samples[samples.length - 1]);
    });
  };

  const finalizeArrival = (final) => {
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
        AsyncStorage.setItem(TOTAL_DISTANCE_KEY, newTotal.toString()).catch(() => {});
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
  };

  const recenter = () => {
    const vw = viewport.w || SCREEN_W;
    const vh = viewport.h || SCREEN_H;
    const s = lastScale.current;
    const charX = animX.__getValue();
    const charY = animY.__getValue();
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
  };

  const centerOnPoint = (mapX, mapY) => {
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
  };

  const handleDebugGenerateMessage = async () => {
    if (!profile) return;
    const dropPos = findRandomWalkableTileNear(pos);
    if (!dropPos) return;
    const msgIndex = Math.floor(Math.random() * DEBUG_MESSAGES.length);
    const text = DEBUG_MESSAGES[msgIndex];
    const authorIndex = msgIndex % DEBUG_MESSAGE_AUTHORS.length;
    const author = DEBUG_MESSAGE_AUTHORS[authorIndex];
    setSettingsOpen(false);
    try {
      await dropLetter({
        authorId: `debug_${author.name.toLowerCase()}`,
        authorName: author.name,
        authorColor: author.color,
        x: dropPos.x,
        y: dropPos.y,
        text,
      });
      centerOnPoint(dropPos.x, dropPos.y);
    } catch (e) {
      console.warn('debug drop letter failed', e);
    }
  };

  const openSettings = () => { setDraftName(profile?.name || ''); setSettingsOpen(true); };

  const saveProfile = (patch) => {
    persistProfile(patch);
    updateMyProfile(patch);
  };

  const validateName = () => {
    const trimmed = (draftName || '').trim().slice(0, 16);
    if (trimmed && trimmed !== profile?.name) saveProfile({ name: trimmed });
  };

  const onToggleDebug = () => {
    const next = !debugEnabled;
    setDebugEnabled(next);
    saveProfile({ debug: next });
  };

  const previewStats = pendingTarget ? (() => {
    const samples = pendingTarget.samples;
    const { durationMs: durMs } = movementDurationAlongPath(samples);
    return { dist: Math.round(pendingTarget.length || 0), durSec: Math.round(durMs / Math.max(1, speedMul) / 1000) };
  })() : null;

  // --- Modale liste des joueurs ---
  const renderPlayersListModal = () => (
    <Modal
      visible={playersListOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setPlayersListOpen(false)}
    >
      <TouchableWithoutFeedback onPress={() => setPlayersListOpen(false)}>
        <View style={styles.playersModalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.playersModalCard}>
              <Text style={styles.playersModalTitle}>
                👥 Joueurs en ligne ({otherPlayers.filter(isOnline).length})
              </Text>
              {otherPlayers.length === 0 ? (
                <Text style={styles.playersModalEmpty}>Aucun autre joueur connecté</Text>
              ) : (
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                  {otherPlayers.map((p) => {
                    const online = isOnline(p);
                    const followed = followedPlayers.has(p.id);
                    return (
                      <View key={p.id} style={styles.playerRow}>
                        <View style={[styles.playerRowDot, { backgroundColor: p.color || '#888' }]} />
                        <Text style={[styles.playerRowName, !online && styles.playerRowNameOffline]}>
                          {p.name || 'Anonyme'}
                        </Text>
                        {!online && <Text style={styles.playerRowStatus}>💤</Text>}
                        <TouchableOpacity
                          style={[styles.heartBtn, followed && styles.heartBtnActive]}
                          onPress={() => toggleFollow(p.id)}
                          activeOpacity={0.7}
                        >
                          <Heart
                            size={18}
                            color={followed ? '#ff4d6d' : THEME.text}
                            fill={followed ? '#ff4d6d' : 'none'}
                            strokeWidth={2}
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
              <TouchableOpacity
                style={styles.playersModalCloseBtn}
                onPress={() => setPlayersListOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.playersModalCloseBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <PinchGestureHandler onGestureEvent={onPinchGesture} onHandlerStateChange={onPinchStateChange}>
          <Animated.View style={{ flex: 1 }}>
            <PanGestureHandler onGestureEvent={onPanGesture} onHandlerStateChange={onPanStateChange} minPointers={1} maxPointers={1}>
              <Animated.View style={styles.canvas} onLayout={onCanvasLayout}>
                <Animated.View style={[styles.map, {
                  width: MAP_W_PX, height: MAP_H_PX,
                  transform: [{ translateX: totalX }, { translateY: totalY }, { scale: baseScale }],
                }]}>
                  <TouchableWithoutFeedback onPress={handleTap}>
                    <View style={StyleSheet.absoluteFill}>
                      <TileLayer />
                      {/* ===== BROUILLARD DE GUERRE ===== */}
                      <FogLayer
                        discovered={explored}
                        charPos={fogCharPos}
                        revealRadiusCells={FOG_REVEAL_RADIUS}
                      />
                      {/* =============================== */}
                      {pendingTarget && (
                        <DottedTrail samples={pendingTarget.samples} color="#3a7ea8" spacing={26} size={6} opacity={0.95} />
                      )}
                      {frozenActivePath && (
                        <DottedTrail samples={frozenActivePath} color="#3a7ea8" spacing={30} size={5} opacity={0.55} minDist={consumedDist + 40} />
                      )}
                      {letters.map((l) => {
                        const isMine = profile && l.authorId === profile.id;
                        const distToMe = Math.hypot(l.x - pos.x, l.y - pos.y);
                        const readable = !isMine && distToMe <= 80;
                        const iconColor = isMine ? '#666' : (readable ? (l.authorColor || '#8b4513') : '#888');
                        return (
                          <View key={l.id} pointerEvents="none" style={{ position: 'absolute', left: l.x - 16, top: l.y - 16 }}>
                            {readable && (
                              <View style={{
                                position: 'absolute', left: -6, top: -6,
                                width: 44, height: 44, borderRadius: 22,
                                backgroundColor: l.authorColor || '#ffd93d', opacity: 0.25,
                              }} />
                            )}
                            <ScrollText size={32} color={iconColor} strokeWidth={2.2} />
                          </View>
                        );
                      })}
                      {target && (
                        <View style={[styles.targetMarker, { left: target.x - 14, top: target.y - 14 }]}>
                          <View style={styles.targetInner} />
                        </View>
                      )}
                      {pendingTarget && (
                        <>
                          <View style={[styles.previewTargetOuter, { left: pendingTarget.x - 18, top: pendingTarget.y - 18 }]} />
                          <View style={[styles.previewTargetInner, { left: pendingTarget.x - 6, top: pendingTarget.y - 6 }]} />
                        </>
                      )}
                      {otherPlayers.map((p) => {
                        const e = playerAnims.get(p.id);
                        if (!e) return null;
                        const isMoving = !!p.target;
                        const online = isOnline(p);
                        return (
                          <View key={p.id} style={StyleSheet.absoluteFill} pointerEvents="none">
                            <Animated.View style={{
                              position: 'absolute', width: 50, height: 50,
                              transform: [
                                { translateX: Animated.subtract(e.x, 25) },
                                { translateY: Animated.subtract(e.y, 25) },
                                ...(isMoving ? [
                                  { translateY: Animated.multiply(bounce, -6) },
                                  { scaleX: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
                                  { scaleY: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) },
                                ] : []),
                                ...(!online && !isMoving ? [
                                  { scaleX: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) },
                                  { scaleY: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) },
                                ] : []),
                              ],
                            }}>
                              <AdventurerSprite size={50} viewBoxScale={1.2} dir="down" moving={isMoving}
                                outfit={p.outfit||'gray'} skin={p.skin||'light'} hair={p.hair||'brown'} hat={p.hat||'none'} />
                            </Animated.View>
                            {!online && <SleepyZzz x={e.x} y={e.y} />}
                            <Animated.Text numberOfLines={2} style={[styles.otherPlayerLabel, {
                              transform: [
                                { translateX: Animated.subtract(e.x, 60) },
                                { translateY: Animated.add(e.y, 22) },
                              ],
                            }]}>{p.name}</Animated.Text>
                          </View>
                        );
                      })}
                      <Animated.View style={{
                        position: 'absolute', width: 50, height: 50,
                        transform: [
                          { translateX: Animated.subtract(animX, 25) },
                          { translateY: Animated.subtract(Animated.subtract(animY, 25), Animated.multiply(bounce, 6)) },
                          { scaleX: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
                          { scaleY: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) },
                        ],
                      }}>
                        <AdventurerSprite size={50} viewBoxScale={1.2} dir="down" moving={moving}
                          outfit={profile?.outfit||'red'} skin={profile?.skin||'light'}
                          hair={profile?.hair||'brown'} hat={profile?.hat||'none'} />
                      </Animated.View>
                    </View>
                  </TouchableWithoutFeedback>
                </Animated.View>
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </PinchGestureHandler>

        {moving && <TravelingBar eta={eta} onStop={stopMove} />}

        <Modal
          visible={!!tripSummary}
          transparent
          animationType="fade"
          onRequestClose={dismissTripSummary}
        >
          <View style={styles.tripSummaryOverlay}>
            <View style={styles.tripSummaryModal}>
              <Text style={styles.tripSummaryTitle}>🏁 Trajet terminé</Text>
              <Text style={styles.tripSummaryText}>
                {tripSummary ? `${formatMeters(tripSummary.distancePx)} · ${formatDuration(Math.round(tripSummary.durationMs / 1000))}` : ''}
              </Text>
              {tripSummary && (
                <XPBar
                  totalDistancePx={tripSummary.startDistancePx + tripSummary.distancePx}
                  startDistancePx={tripSummary.startDistancePx}
                  animated
                />
              )}
              {tripSummary?.pickedUpItems?.length > 0 && (
                <View style={styles.tripSummaryPickups}>
                  <Text style={styles.tripSummaryPickupsTitle}>Vous avez trouvé :</Text>
                  {tripSummary.pickedUpItems.map((item) => (
                    <Text key={item.id} style={styles.tripSummaryPickupLine}>
                      {'- nouveau message de '}{item.authorName || 'Anonyme'}
                    </Text>
                  ))}
                </View>
              )}
              <TouchableOpacity style={styles.tripSummaryBtn} onPress={dismissTripSummary} activeOpacity={0.8}>
                <Text style={styles.tripSummaryBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {renderPlayersListModal()}

        {showRecenterBtn && (
          <TouchableOpacity style={styles.recenterBtn} onPress={recenter} activeOpacity={0.75}>
            <Crosshair size={22} color={THEME.text} strokeWidth={2.2} />
          </TouchableOpacity>
        )}

        {debugEnabled && (
          <TouchableOpacity
            style={[styles.speedBtn, speedMul > 1 && styles.speedBtnActive]}
            onPressIn={onSpeedPressIn} onPressOut={onSpeedPressOut} activeOpacity={0.8}
          >
            <Text style={styles.speedText}>⏩ {speedMul}×</Text>
          </TouchableOpacity>
        )}

        {viewport.w > 0 && otherPlayers
          .filter((p) => followedPlayers.has(p.id))
          .map((p) => {
            const e = playerAnims.get(p.id);
            if (!e) return null;
            return (
              <SmoothEdgeArrow key={`arr-${p.id}`} color={p.color}
                playerX={e.x} playerY={e.y} camX={totalX} camY={totalY}
                scaleVal={baseScale} W={viewport.w} H={viewport.h} />
            );
          })
        }

        {profile && (
          <TouchableOpacity
            style={styles.onlineBadge}
            onPress={() => setPlayersListOpen(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.onlineDot, { backgroundColor: profile.color }]} />
            <Text style={styles.onlineText}>
              {profile.name} · {otherPlayers.filter(isOnline).length} en ligne
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.inventoryBtn} onPress={() => setInventoryOpen(true)} activeOpacity={0.8}>
          <Backpack size={22} color={THEME.text} strokeWidth={2.2} />
          {unreadCount > 0 && (
            <View style={styles.inventoryBadge}>
              <Text style={styles.inventoryBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {pendingTarget && previewStats && (
          <ConfirmationBar
            distancePx={previewStats.dist} durationSec={previewStats.durSec}
            destLabel={
              pendingTarget.pickupLetter
                ? `Message de ${pendingTarget.pickupLetter.authorName || 'Anonyme'}`
                : pendingTarget.nearPlayer
                  ? (pendingTarget.nearPlayer.name || 'Inconnu')
                  : `${Math.round(pendingTarget.x / TILE_PX)}, ${Math.round(pendingTarget.y / TILE_PX)}`
            }
            onCancel={cancelMove} onConfirm={confirmMove}
          />
        )}

        <TouchableOpacity style={styles.settingsBtn} onPress={openSettings} activeOpacity={0.8}>
          <Settings size={22} color={THEME.text} strokeWidth={2.2} />
        </TouchableOpacity>

        {!moving && !pendingTarget && (
          <TouchableOpacity style={styles.letterBtn} onPress={openLetterWrite} activeOpacity={0.8}>
            <ScrollText size={24} color={THEME.text} strokeWidth={2.2} />
          </TouchableOpacity>
        )}

        {settingsOpen && (
          <SettingsModal profile={profile} draftName={draftName} setDraftName={setDraftName}
            onPatch={saveProfile} debugEnabled={debugEnabled} onToggleDebug={onToggleDebug}
            onClose={() => setSettingsOpen(false)} onValidateName={validateName}
            onDebugGenerateMessage={handleDebugGenerateMessage} />
        )}
        {selectedPlayer && <PlayerDetailModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
        {letterWriteOpen && (
          <LetterWriteModal value={letterDraft} setValue={setLetterDraft}
            onSend={sendLetter} onClose={() => setLetterWriteOpen(false)} />
        )}
        {readingLetter && <LetterReadModal letter={readingLetter} onClose={closeReadingLetter} />}
        {inventoryOpen && (
          <InventoryModal items={inventory} totalDistancePx={totalDistancePx} onClose={() => setInventoryOpen(false)}
            onMarkRead={markInventoryRead}
            onDelete={deleteInventoryItem} />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WATER_COLOR, overflow: 'hidden' },
  canvas: { flex: 1 },
  map: { position: 'absolute', backgroundColor: WATER_COLOR },
  otherPlayerLabel: {
    position: 'absolute', left: 0, top: 0, width: 120,
    textAlign: 'center', color: '#fff', fontSize: 11, fontWeight: '600',
    lineHeight: 14, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
  targetMarker: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,217,61,0.25)', borderWidth: 2, borderColor: '#ffd93d',
    justifyContent: 'center', alignItems: 'center',
  },
  targetInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffd93d' },
  previewTargetOuter: {
    position: 'absolute', width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: '#ffd93d', backgroundColor: 'rgba(255,217,61,0.18)',
  },
  previewTargetInner: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#ffd93d',
  },
  recenterBtn: {
    position: 'absolute', bottom: 156, right: 16,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: THEME.card, borderWidth: 1.5, borderColor: THEME.border,
    justifyContent: 'center', alignItems: 'center',
    ...THEME.shadow, shadowRadius: 12,
  },
  speedBtn: {
    position: 'absolute', bottom: 160, left: 16,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.7)', minWidth: 80, alignItems: 'center',
  },
  speedBtnActive: { backgroundColor: '#ff6b6b' },
  speedText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  onlineBadge: {
    position: 'absolute', top: TOP_SAFE, left: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: THEME.card, borderWidth: 1.5, borderColor: THEME.border,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: THEME.radiusLg,
    ...THEME.shadow, shadowRadius: 10,
  },
  onlineDot: { width: 9, height: 9, borderRadius: 4.5, marginRight: 7, borderWidth: 1, borderColor: THEME.border },
  onlineText: { color: THEME.text, fontSize: 12, fontWeight: '700' },
  settingsBtn: {
    position: 'absolute', top: TOP_SAFE, right: 16,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: THEME.card, borderWidth: 1.5, borderColor: THEME.border,
    justifyContent: 'center', alignItems: 'center',
    ...THEME.shadow, shadowRadius: 10,
  },
  inventoryBtn: {
    position: 'absolute', top: TOP_SAFE, right: 76,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: THEME.card, borderWidth: 1.5, borderColor: THEME.border,
    justifyContent: 'center', alignItems: 'center',
    ...THEME.shadow, shadowRadius: 10,
  },
  inventoryBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: THEME.danger, borderWidth: 1.5, borderColor: THEME.card,
    paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center',
  },
  inventoryBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  letterBtn: {
    position: 'absolute', bottom: 90, right: 16,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: THEME.card, borderWidth: 1.5, borderColor: THEME.border,
    justifyContent: 'center', alignItems: 'center',
    ...THEME.shadow, shadowRadius: 12,
  },
  tripSummaryOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  tripSummaryModal: {
    backgroundColor: THEME.card, borderWidth: 1.5, borderColor: THEME.border,
    borderRadius: THEME.radiusLg, paddingHorizontal: 20, paddingVertical: 24,
    alignItems: 'stretch', width: '88%', maxWidth: 360,
    ...THEME.shadow, shadowRadius: 20,
  },
  tripSummaryTitle: {
    color: THEME.text, fontSize: 17, fontWeight: '800',
    marginBottom: 4, textAlign: 'center',
  },
  tripSummaryText: {
    color: THEME.text, fontSize: 14, fontWeight: '600',
    textAlign: 'center', marginBottom: 12, opacity: 0.7,
  },
  tripSummaryPickups: {
    width: '100%', backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 14, alignItems: 'flex-start',
  },
  tripSummaryPickupsTitle: {
    color: THEME.text, fontSize: 13, fontWeight: '700', marginBottom: 6, opacity: 0.9,
  },
  tripSummaryPickupLine: {
    color: THEME.text, fontSize: 13, fontWeight: '400', opacity: 0.8, lineHeight: 20,
  },
  tripSummaryBtn: {
    backgroundColor: THEME.accent || '#3a7ea8',
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24,
    alignItems: 'center', marginTop: 4,
  },
  tripSummaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  playersModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start', alignItems: 'flex-start',
    paddingTop: TOP_SAFE + 48, paddingLeft: 16,
  },
  playersModalCard: {
    backgroundColor: THEME.card, borderWidth: 1.5, borderColor: THEME.border,
    borderRadius: THEME.radiusLg, paddingHorizontal: 16, paddingVertical: 16,
    width: 280, maxWidth: '90%',
    ...THEME.shadow, shadowRadius: 16,
  },
  playersModalTitle: {
    color: THEME.text, fontSize: 15, fontWeight: '800',
    marginBottom: 12, textAlign: 'center',
  },
  playersModalEmpty: {
    color: THEME.text, fontSize: 13, opacity: 0.6,
    textAlign: 'center', marginBottom: 12,
  },
  playerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME.border,
  },
  playerRowDot: {
    width: 10, height: 10, borderRadius: 5, marginRight: 8,
  },
  playerRowName: {
    flex: 1, color: THEME.text, fontSize: 13, fontWeight: '600',
  },
  playerRowNameOffline: { opacity: 0.5 },
  playerRowStatus: { fontSize: 14, marginRight: 6 },
  heartBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'transparent',
  },
  heartBtnActive: {
    backgroundColor: 'rgba(255,77,109,0.12)',
  },
  playersModalCloseBtn: {
    marginTop: 12, backgroundColor: THEME.accent || '#3a7ea8',
    paddingVertical: 10, borderRadius: 20, alignItems: 'center',
  },
  playersModalCloseBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
