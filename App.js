// Treasure Quest — App principal
// Logique pure dans /src, composants UI dans /components.
// App.js orchestre uniquement : état React, gestes, animations natives.

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, Dimensions, Animated, Easing,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import {
  GestureHandlerRootView, PanGestureHandler, PinchGestureHandler, State,
} from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  joinMultiplayer, announceMove, clearMyMove,
  subscribePlayers, leaveMultiplayer, updateMyProfile,
  dropLetter, consumeLetter, subscribeLetters,
} from './firebase';

import {
  MIN_SCALE, MAX_SCALE,
  ONLINE_THRESHOLD_MS, TAP_PLAYER_RADIUS, SPEED_LEVELS,
  TOP_SAFE, SAVE_KEY, PROFILE_KEY,
  PLAYER_COLORS,
  SPEED_PX_PER_SEC, MIN_DURATION_MS, MAX_DURATION_MS,
} from './src/constants';
import { THEME } from './src/theme';

// --- Notifications ---
import {
  requestNotificationPermissions,
  scheduleArrivalNotification,
  cancelArrivalNotification,
} from './src/notifications';

const INVENTORY_KEY = '@treasureProto.inventory.v1';
const LETTER_PICKUP_RADIUS = 130;
const PLAYER_NEAR_RADIUS = 130;
const RECENTER_HIDE_RADIUS = 90;

import { TILES_DATA, MAP_W, MAP_H, TILE_PX, WALKABLE, findPath } from './src/tilemap';
import { sampleAt } from './src/smoothing';
import TileLayer, { MAP_W_PX, MAP_H_PX } from './components/TileLayer';
import DottedTrail from './components/DottedTrail';

const WATER_COLOR = '#bce0e8';

function safePixelPos(px, py) {
  const tx = Math.floor(px / TILE_PX);
  const ty = Math.floor(py / TILE_PX);
  const tileIdx = ty * MAP_W + tx;
  if (
    tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H &&
    WALKABLE[TILES_DATA[tileIdx]]
  ) {
    return { x: px, y: py };
  }
  for (let r = 1; r <= 20; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
        if (WALKABLE[TILES_DATA[ny * MAP_W + nx]]) {
          return {
            x: nx * TILE_PX + TILE_PX / 2,
            y: ny * TILE_PX + TILE_PX / 2,
          };
        }
      }
    }
  }
  return { x: (MAP_W / 2) * TILE_PX, y: (MAP_H / 2) * TILE_PX };
}

function buildStraightPath(cellPath, startPx) {
  const wps = cellPath.map((c) => ({
    x: c.x * TILE_PX + TILE_PX / 2,
    y: c.y * TILE_PX + TILE_PX / 2,
  }));
  if (startPx) wps[0] = { x: startPx.x, y: startPx.y };
  let length = 0;
  for (let i = 1; i < wps.length; i++) {
    length += Math.hypot(wps[i].x - wps[i - 1].x, wps[i].y - wps[i - 1].y);
  }
  return { samples: wps, length };
}

const MAP_SIZE = MAP_W_PX;
const SPAWN = { x: (MAP_W / 2) * TILE_PX, y: (MAP_H / 2) * TILE_PX };
import { formatMeters, formatDuration } from './src/format';
import { movementDuration, lerpFromTarget, remainingDurationAt } from './src/movement';
import { generateProfile, isPlayerOnline } from './src/profile';

import SleepyZzz from './components/SleepyZzz';
import SmoothEdgeArrow from './components/SmoothEdgeArrow';
import SettingsModal from './components/SettingsModal';
import PlayerDetailModal from './components/PlayerDetailModal';
import LetterWriteModal from './components/LetterWriteModal';
import LetterReadModal from './components/LetterReadModal';
import InventoryModal from './components/InventoryModal';
import { ConfirmationBar, TravelingBar } from './components/TravelBars';
import { AdventurerSprite } from './components/Adventurer';
import { ScrollText, Settings, Crosshair, Backpack } from 'lucide-react-native';
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

  const bounce = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  const [speedLvl, setSpeedLvl] = useState(0);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const speedMul = SPEED_LEVELS[speedLvl];
  const speedTimer = useRef(null);

  const [profile, setProfile] = useState(null);
  const [otherPlayers, setOtherPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const playerAnims = useRef(new Map()).current;

  const [pendingTarget, setPendingTarget] = useState(null);

  const [letters, setLetters] = useState([]);
  const [letterWriteOpen, setLetterWriteOpen] = useState(false);
  const [letterDraft, setLetterDraft] = useState('');
  const [readingLetter, setReadingLetter] = useState(null);

  const [inventory, setInventory] = useState([]);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const unreadCount = inventory.filter((l) => l.unread).length;

  const activePathRef = useRef(null);
  const [frozenActivePath, setFrozenActivePath] = useState(null);
  const [consumedDist, setConsumedDist] = useState(0);
  const lastConsumedTick = useRef(0);

  // Récapitulatif de fin de trajet
  const [tripSummary, setTripSummary] = useState(null);
  const tripStartedAtRef = useRef(null);
  const tripSummaryTimeoutRef = useRef(null);

  const globalNowRef = useRef(Date.now());

  const dx = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(0)).current;

  const totalX = Animated.add(tx, dx);
  const totalY = Animated.add(ty, dy);

  const pinchListenerId = useRef(null);

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

  // Demande les permissions notifications au montage
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Charge save pos — téléporte sur case safe si zone interdite
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

  useEffect(() => {
    (async () => {
      let p = null;
      try {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
        if (raw) p = JSON.parse(raw);
      } catch (e) {}
      if (!p) {
        p = generateProfile();
        AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p)).catch(() => {});
      }
      setProfile(p);
      setDebugEnabled(!!p.debug);
    })();
  }, []);

  useEffect(() => {
    if (!profile) return;
    let unsub = null;
    let alive = true;
    (async () => {
      try {
        await joinMultiplayer({
          playerId: profile.id, name: profile.name, color: profile.color,
          outfit: profile.outfit, skin: profile.skin,
          hair: profile.hair, hat: profile.hat,
          x: animX.__getValue(), y: animY.__getValue(),
        });
        if (!alive) return;
        unsub = subscribePlayers((list) => setOtherPlayers(list));
      } catch (e) {
        console.warn('multi join failed', e);
      }
    })();
    return () => {
      alive = false;
      if (unsub) unsub();
      leaveMultiplayer().catch(() => {});
    };
  }, [profile?.id]);

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
    for (const id of Array.from(playerAnims.keys())) {
      if (!seen.has(id)) {
        const e = playerAnims.get(id);
        if (e?.anim) e.anim.stop();
        playerAnims.delete(id);
      }
    }
  }, [otherPlayers]);

  useEffect(() => {
    const unsub = subscribeLetters(setLetters);
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(INVENTORY_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) setInventory(data);
        }
      } catch (e) {}
      setInventoryLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!inventoryLoaded) return;
    AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory)).catch(() => {});
  }, [inventory, inventoryLoaded]);

  useEffect(() => {
    const id = setInterval(() => { globalNowRef.current = Date.now(); }, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const vw = viewport.w || SCREEN_W;
      const vh = viewport.h || SCREEN_H;
      if (!vw || !vh) return;
      const s = lastScale.current;
      const charX = animX.__getValue();
      const charY = animY.__getValue();
      const offX = lastOffset.current.x + dx.__getValue();
      const offY = lastOffset.current.y + dy.__getValue();
      const cx = MAP_W_PX / 2;
      const cy = MAP_H_PX / 2;
      const screenX = offX + s * charX + cx * (1 - s);
      const screenY = offY + s * charY + cy * (1 - s);
      const dist = Math.hypot(screenX - vw / 2, screenY - vh / 2);
      const shouldShow = dist > RECENTER_HIDE_RADIUS;
      setShowRecenterBtn((prev) => (prev === shouldShow ? prev : shouldShow));
    }, 150);
    return () => clearInterval(id);
  }, [viewport.w, viewport.h]);

  useEffect(() => {
    if (!moving) {
      Animated.timing(bounce, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [moving]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]).start(({ finished }) => { if (!cancelled && finished) tick(); });
    };
    tick();
    return () => { cancelled = true; };
  }, []);

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

  useEffect(() => {
    return () => { if (speedTimer.current) clearTimeout(speedTimer.current); };
  }, []);

  // Nettoyage du timer du récapitulatif au démontage
  useEffect(() => {
    return () => {
      if (tripSummaryTimeoutRef.current) clearTimeout(tripSummaryTimeoutRef.current);
    };
  }, []);

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

  const isOnline = (p) => isPlayerOnline(p, globalNowRef.current, ONLINE_THRESHOLD_MS);

  const computePlayerPos = (p) => {
    const e = playerAnims.get(p.id);
    if (e) return { x: e.x.__getValue(), y: e.y.__getValue() };
    return { x: p.x, y: p.y };
  };

  const findTappedPlayer = (tap) => {
    let best = null, bestD = TAP_PLAYER_RADIUS;
    for (const p of otherPlayers) {
      const pp = computePlayerPos(p);
      const d = Math.hypot(pp.x - tap.x, pp.y - tap.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  };

  const findLetterNearPoint = (px, py, radius = LETTER_PICKUP_RADIUS) => {
    let best = null, bestD = radius;
    for (const l of letters) {
      if (!profile || l.authorId === profile.id) continue;
      const d = Math.hypot(l.x - px, l.y - py);
      if (d < bestD) { bestD = d; best = l; }
    }
    return best;
  };

  const findPlayerNearPoint = (px, py, radius = PLAYER_NEAR_RADIUS) => {
    let best = null, bestD = radius;
    for (const p of otherPlayers) {
      const pp = computePlayerPos(p);
      const d = Math.hypot(pp.x - px, pp.y - py);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
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

  const openLetterWrite = () => { setLetterDraft(''); setLetterWriteOpen(true); };

  const sendLetter = async () => {
    const text = (letterDraft || '').trim();
    if (!text || !profile) return;
    setLetterWriteOpen(false);
    setLetterDraft('');
    try {
      await dropLetter({
        authorId: profile.id, authorName: profile.name, authorColor: profile.color,
        x: pos.x, y: pos.y, text,
      });
    } catch (e) { console.warn('drop letter failed', e); }
  };

  const closeReadingLetter = async () => {
    const l = readingLetter;
    setReadingLetter(null);
    if (l?.id) { try { await consumeLetter(l.id); } catch (e) {} }
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
    cancelArrivalNotification(); // trajet annulé manuellement
    pendingPickupRef.current = null;
    const cx = animX.__getValue();
    const cy = animY.__getValue();
    finalizeArrival({ x: cx, y: cy });
  };

  const progressRef = useRef(null);
  const progressListenerId = useRef(null);

  // Affiche le récapitulatif de fin de trajet pendant 4 secondes
  const showTripSummary = (distancePx, durationMs) => {
    if (tripSummaryTimeoutRef.current) clearTimeout(tripSummaryTimeoutRef.current);
    setTripSummary({
      distancePx: Math.max(0, Math.round(distancePx || 0)),
      durationMs: Math.max(0, Math.round(durationMs || 0)),
    });
    tripSummaryTimeoutRef.current = setTimeout(() => {
      setTripSummary(null);
      tripSummaryTimeoutRef.current = null;
    }, 4000);
  };

  const startMoveAlongCurve = (samples, length) => {
    if (!samples || samples.length < 2) return;
    const baseDuration = Math.max(
      MIN_DURATION_MS,
      Math.min(MAX_DURATION_MS, (length / SPEED_PX_PER_SEC) * 1000)
    );
    const dur = baseDuration / speedMul;
    moveTarget.current = samples[samples.length - 1];
    moveBaseDuration.current = baseDuration;
    tripStartedAtRef.current = Date.now();
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
    // Planifie la notification d'arrivée
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
    // Calcul du récapitulatif avant de réinitialiser les refs
    const pathAtArrival = activePathRef.current;
    const tripDistancePx = pathAtArrival && pathAtArrival.length >= 2
      ? pathAtArrival.reduce((sum, point, index, arr) => {
          if (index === 0) return sum;
          return sum + Math.hypot(point.x - arr[index - 1].x, point.y - arr[index - 1].y);
        }, 0)
      : 0;
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

    // Affiche le récapitulatif si le trajet avait une distance mesurable
    if (tripDistancePx > 0 || tripDurationMs > 0) {
      showTripSummary(tripDistancePx, tripDurationMs);
    }

    const pickup = pendingPickupRef.current;
    pendingPickupRef.current = null;
    if (pickup && pickup.id) {
      const stillThere = letters.some((l) => l.id === pickup.id);
      if (stillThere) {
        setInventory((prev) => {
          if (prev.some((l) => l.id === pickup.id)) return prev;
          return [
            ...prev,
            {
              id: pickup.id, authorId: pickup.authorId,
              authorName: pickup.authorName, authorColor: pickup.authorColor,
              text: pickup.text, pickedAt: Date.now(), unread: true,
            },
          ];
        });
        consumeLetter(pickup.id).catch(() => {});
      }
    }
  };

  const startMove = (t) => {
    const { baseDurationMs } = movementDuration(pos, t, 1);
    moveTarget.current = t;
    moveBaseDuration.current = baseDurationMs;
    setMoving(true);
    const dur = baseDurationMs / speedMul;
    announceMove({ from: { x: pos.x, y: pos.y }, to: t, startTs: Date.now(), durationMs: dur });
    runMoveAnim(dur);
  };

  const runMoveAnim = (duration) => {
    const t = moveTarget.current;
    if (!t) return;
    setEta(Date.now() + duration);
    const anim = Animated.parallel([
      Animated.timing(animX, { toValue: t.x, duration, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(animY, { toValue: t.y, duration, easing: Easing.linear, useNativeDriver: true }),
    ]);
    currentAnim.current = anim;
    anim.start(({ finished }) => {
      if (finished) {
        setPos(t);
        clearMyMove(t.x, t.y);
        setMoving(false);
        setEta(null);
        setTarget(null);
        currentAnim.current = null;
        moveTarget.current = null;
      }
    });
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

  const findRandomWalkableTileNearPlayer = () => {
    const originTx = Math.floor(pos.x / TILE_PX);
    const originTy = Math.floor(pos.y / TILE_PX);
    const MIN_R = 5;
    const MAX_R = 15;
    const candidates = [];
    for (let dy2 = -MAX_R; dy2 <= MAX_R; dy2++) {
      for (let dx2 = -MAX_R; dx2 <= MAX_R; dx2++) {
        const dist = Math.max(Math.abs(dx2), Math.abs(dy2));
        if (dist < MIN_R || dist > MAX_R) continue;
        const nx = originTx + dx2;
        const ny = originTy + dy2;
        if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
        if (WALKABLE[TILES_DATA[ny * MAP_W + nx]]) {
          candidates.push({ x: nx * TILE_PX + TILE_PX / 2, y: ny * TILE_PX + TILE_PX / 2 });
        }
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  const handleDebugGenerateMessage = async () => {
    if (!profile) return;
    const dropPos = findRandomWalkableTileNearPlayer();
    if (!dropPos) return;
    const msgIndex = Math.floor(Math.random() * DEBUG_MESSAGES.length);
    const text = DEBUG_MESSAGES[msgIndex];
    // Choisir l'auteur selon l'index pour une bonne distribution
    const authorIndex = msgIndex % DEBUG_MESSAGE_AUTHORS.length;
    const author = DEBUG_MESSAGE_AUTHORS[authorIndex];
    // Fermer les settings
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
      // Centrer la caméra sur le message généré
      centerOnPoint(dropPos.x, dropPos.y);
    } catch (e) {
      console.warn('debug drop letter failed', e);
    }
  };

  const onSpeedPressIn = () => {
    setSpeedLvl(1);
    let lvl = 1;
    const tick = () => {
      lvl++;
      if (lvl >= SPEED_LEVELS.length) return;
      setSpeedLvl(lvl);
      speedTimer.current = setTimeout(tick, 600);
    };
    speedTimer.current = setTimeout(tick, 600);
  };
  const onSpeedPressOut = () => {
    if (speedTimer.current) clearTimeout(speedTimer.current);
    setSpeedLvl(0);
  };

  const openSettings = () => { setDraftName(profile?.name || ''); setSettingsOpen(true); };

  const saveProfile = (patch) => {
    const updated = { ...profile, ...patch };
    setProfile(updated);
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated)).catch(() => {});
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
    const length = pendingTarget.length || 0;
    const durMs = Math.max(
      MIN_DURATION_MS,
      Math.min(MAX_DURATION_MS, (length / SPEED_PX_PER_SEC) * 1000)
    ) / Math.max(1, speedMul);
    return { dist: Math.round(length), durSec: Math.round(durMs / 1000) };
  })() : null;

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

        {tripSummary && (
          <View style={styles.tripSummaryBar} pointerEvents="none">
            <Text style={styles.tripSummaryText}>
              Trajet terminé · {formatMeters(tripSummary.distancePx)} · {formatDuration(Math.round(tripSummary.durationMs / 1000))}
            </Text>
          </View>
        )}

        {showRecenterBtn && (
          <TouchableOpacity style={styles.recenterBtn} onPress={recenter} activeOpacity={0.75}>
            <Crosshair size={22} color={THEME.text} strokeWidth={2.2} />
          </TouchableOpacity>
        )}

        {/* Bouton debug vitesse — bas gauche */}
        {debugEnabled && (
          <TouchableOpacity
            style={[styles.speedBtn, speedMul > 1 && styles.speedBtnActive]}
            onPressIn={onSpeedPressIn} onPressOut={onSpeedPressOut} activeOpacity={0.8}
          >
            <Text style={styles.speedText}>⏩ {speedMul}×</Text>
          </TouchableOpacity>
        )}

        {viewport.w > 0 && otherPlayers.map((p) => {
          const e = playerAnims.get(p.id);
          if (!e) return null;
          return (
            <SmoothEdgeArrow key={`arr-${p.id}`} color={p.color}
              playerX={e.x} playerY={e.y} camX={totalX} camY={totalY}
              scaleVal={baseScale} W={viewport.w} H={viewport.h} />
          );
        })}

        {profile && (
          <View style={styles.onlineBadge} pointerEvents="none">
            <View style={[styles.onlineDot, { backgroundColor: profile.color }]} />
            <Text style={styles.onlineText}>{profile.name} · {otherPlayers.filter(isOnline).length} en ligne</Text>
          </View>
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
          <InventoryModal items={inventory} onClose={() => setInventoryOpen(false)}
            onMarkRead={(id) => setInventory((prev) => prev.map((l) => l.id === id ? { ...l, unread: false } : l))}
            onDelete={(id) => setInventory((prev) => prev.filter((l) => l.id !== id))} />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WATER_COLOR, overflow: 'hidden' },
  canvas: { flex: 1 },
  map: { position: 'absolute', backgroundColor: WATER_COLOR },
  player: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#ff6b6b', borderWidth: 3, borderColor: '#fff',
  },
  otherPlayer: {
    position: 'absolute', width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#fff', opacity: 0.95,
  },
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
  hud: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' },
  hudText: {
    color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    fontSize: 13, fontWeight: '600',
  },
  recenterBtn: {
    position: 'absolute', bottom: 156, right: 16,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: THEME.card, borderWidth: 1.5, borderColor: THEME.border,
    justifyContent: 'center', alignItems: 'center',
    ...THEME.shadow, shadowRadius: 12,
  },
  iconText: { color: THEME.text, fontSize: 22, fontWeight: '700' },
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
  recenterBtnText: { color: THEME.text, fontSize: 22 },
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
  tripSummaryBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: THEME.radiusLg,
    backgroundColor: THEME.card,
    borderWidth: 1.5,
    borderColor: THEME.border,
    alignItems: 'center',
    ...THEME.shadow,
    shadowRadius: 12,
  },
  tripSummaryText: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
