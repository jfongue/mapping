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
const FOLLOWED_PLAYERS_KEY = '@treasureProto.followedPlayers.v1';
const TOTAL_DISTANCE_KEY = 'TOTAL_DISTANCE_KEY';
const LETTER_PICKUP_RADIUS = 130;
const PLAYER_NEAR_RADIUS = 130;
const RECENTER_HIDE_RADIUS = 90;

import { TILES_DATA, MAP_W, MAP_H, TILE_PX, WALKABLE, findPath } from './src/tilemap';
import { sampleAt } from './src/smoothing';
import TileLayer, { MAP_W_PX, MAP_H_PX } from './components/TileLayer';
import DottedTrail from './components/DottedTrail';
import XPBar from './components/XPBar';

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

  const tripTotalLengthRef = useRef(0);
  const [tripSummary, setTripSummary] = useState(null);
  const tripStartedAtRef = useRef(null);
  const [totalDistancePx, setTotalDistancePx] = useState(0);

  const globalNowRef = useRef(Date.now());

  const dx = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(0)).current;

  const totalX = Animated.add(tx, dx);
  const totalY = Animated.add(ty, dy);

  const pinchListenerId = useRef(null);

  // --- Suivi de joueurs ---
  const [followedPlayers, setFollowedPlayers] = useState(new Set());
  const [playersListOpen, setPlayersListOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FOLLOWED_PLAYERS_KEY);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) setFollowedPlayers(new Set(arr));
        }
      } catch (e) {}
    })();
  }, []);

  const toggleFollow = (playerId) => {
    setFollowedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      AsyncStorage.setItem(FOLLOWED_PLAYERS_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  };

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
        const result = await joinMultiplayer({
          playerId: profile.id, name: profile.name, color: profile.color,
          outfit: profile.outfit, skin: profile.skin,
          hair: profile.hair, hat: profile.hat,
          x: animX.__getValue(), y: animY.__getValue(),
        });
        if (!alive) return;
        if (result && typeof result.totalDistancePx === 'number' && result.totalDistancePx > 0) {
          setTotalDistancePx((prev) => {
            const best = Math.max(prev, result.totalDistancePx);
            AsyncStorage.setItem(TOTAL_DISTANCE_KEY, best.toString()).catch(() => {});
            return best;
          });
        }
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
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TOTAL_DISTANCE_KEY);
        if (raw) setTotalDistancePx(parseInt(raw) || 0);
      } catch (e) {}
    })();
  }, []);

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

  useEffec