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
} from './src/constants';
import { TILES_DATA, MAP_W, MAP_H, TILE_PX, findPath } from './src/tilemap';
import { smoothPath, sampleAt } from './src/smoothing';
import TileLayer, { MAP_W_PX, MAP_H_PX } from './components/TileLayer';
import PathOverlay from './components/PathOverlay';

const MAP_SIZE = MAP_W_PX;
const SPAWN = { x: (MAP_W / 2) * TILE_PX, y: (MAP_H / 2) * TILE_PX };
const SPEED_PX_PER_SEC = 80;
const MIN_DURATION_FALLBACK = 5000;
const MAX_DURATION_FALLBACK = 60000;
import { formatMeters, formatDuration } from './src/format';
import { movementDuration, lerpFromTarget, remainingDurationAt } from './src/movement';
import { generateProfile, isPlayerOnline } from './src/profile';

import AnimatedDottedLine from './components/AnimatedDottedLine';
import SleepyZzz from './components/SleepyZzz';
import SmoothEdgeArrow from './components/SmoothEdgeArrow';
import SettingsModal from './components/SettingsModal';
import PlayerDetailModal from './components/PlayerDetailModal';
import LetterWriteModal from './components/LetterWriteModal';
import LetterReadModal from './components/LetterReadModal';
import { ConfirmationBar, TravelingBar } from './components/TravelBars';
import { AdventurerSprite } from './components/Adventurer';
import { ScrollText } from 'lucide-react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const INIT_X = SCREEN_W / 2 - MAP_SIZE / 2;
const INIT_Y = SCREEN_H / 2 - MAP_SIZE / 2;

// Seuil en pixels en-dessous duquel on ne considère pas que l'user a pané
const PAN_THRESHOLD_PX = 5;

export default function App() {
  // ===== Viewport =====
  const [viewport, setViewport] = useState({ w: SCREEN_W, h: SCREEN_H });

  // ===== Pan caméra (offset pattern : pas de flicker à la fin du geste) =====
  const tx = useRef(new Animated.Value(INIT_X)).current;
  const ty = useRef(new Animated.Value(INIT_Y)).current;
  const lastOffset = useRef({ x: INIT_X, y: INIT_Y });

  // ===== Zoom =====
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const pinchStartScale = useRef(1);

  // ===== Recenter — nouvelle logique =====
  // userHasPanned : vrai uniquement si l'utilisateur a déplacé la caméra d'au moins PAN_THRESHOLD_PX.
  // On utilise un ref (pas un state) pour ne pas déclencher de re-render dans le handler de geste.
  // showRecenterBtn est un state dérivé exposé au rendu.
  const userHasPanned = useRef(false);
  const [showRecenterBtn, setShowRecenterBtn] = useState(false);
  const followRafId = useRef(null);
  const isInitialCenter = useRef(false); // true une fois le centrage initial fait

  // ===== Perso =====
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

  // ===== Animations =====
  const bounce = useRef(new Animated.Value(0)).current;
  const dashPhase = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  // ===== Speed debug =====
  const [speedLvl, setSpeedLvl] = useState(0);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const speedMul = SPEED_LEVELS[speedLvl];
  const speedTimer = useRef(null);

  // ===== Multi =====
  const [profile, setProfile] = useState(null);
  const [otherPlayers, setOtherPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const playerAnims = useRef(new Map()).current;

  // ===== Preview déplacement =====
  const [pendingTarget, setPendingTarget] = useState(null);

  // ===== Letters =====
  const [letters, setLetters] = useState([]);
  const [letterWriteOpen, setLetterWriteOpen] = useState(false);
  const [letterDraft, setLetterDraft] = useState('');
  const [readingLetter, setReadingLetter] = useState(null);

  // ===== Path en cours =====
  const activePathRef = useRef(null);
  const [frozenActivePath, setFrozenActivePath] = useState(null);

  // ===== Tick global online check =====
  const globalNowRef = useRef(Date.now());

  // ===== Animated values pour les gestes =====
  const dx = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(0)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(new Animated.Value(1)).current;

  // Transforms composés
  const totalX = Animated.add(tx, dx);
  const totalY = Animated.add(ty, dy);
  const totalScale = Animated.multiply(baseScale, pinchScale);

  // === HELPERS RECENTER ===

  /**
   * Calcule les valeurs tx/ty nécessaires pour centrer le perso à l'écran.
   * Tient compte du scale courant et du transform-origin RN (centre du View map).
   */
  const computeCenteredOffset = (charX, charY, vw, vh, s) => {
    const cx = MAP_W_PX / 2;
    const cy = MAP_H_PX / 2;
    return {
      x: vw / 2 - s * charX - cx * (1 - s),
      y: vh / 2 - s * charY - cy * (1 - s),
    };
  };

  /**
   * Marque l'utilisateur comme ayant pané et affiche le bouton recenter.
   * Appelé uniquement si le déplacement dépasse PAN_THRESHOLD_PX.
   */
  const markUserHasPanned = () => {
    if (userHasPanned.current) return;
    userHasPanned.current = true;
    setShowRecenterBtn(true);
    stopFollowLoop();
  };

  // === FOLLOW LOOP ===
  // Quand l'utilisateur n'a pas pané, la caméra suit le perso en mouvement
  // via requestAnimationFrame (JS-driven, pas de useNativeDriver ici).

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

  // Démarre/arrête le follow loop — uniquement en mode follow et hors recentrage.
  useEffect(() => {
    if (moving && !userHasPanned.current) {
      startFollowLoop();
    } else {
      stopFollowLoop();
    }
    return stopFollowLoop;
  }, [moving]);

  // === EFFECTS ===

  // Charge save pos
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data?.pos) {
            setPos(data.pos);
            animX.setValue(data.pos.x);
            animY.setValue(data.pos.y);
          }
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  // Sauve pos
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SAVE_KEY, JSON.stringify({ pos })).catch(() => {});
  }, [loaded, pos]);

  // Charge ou crée profil
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

  // Connexion Firebase (multi)
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

  // Anim values des autres joueurs
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
        const remainingMs = Math.max(50, p.target.durationMs - (Date.now() - p.target.startTs));
        const par = Animated.parallel([
          Animated.timing(entry.x, { toValue: p.target.toX, duration: remainingMs, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(entry.y, { toValue: p.target.toY, duration: remainingMs, easing: Easing.linear, useNativeDriver: true }),
        ]);
        entry.anim = par;
        par.start();
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

  // Subscribe aux lettres
  useEffect(() => {
    const unsub = subscribeLetters(setLetters);
    return () => unsub();
  }, []);

  // Tick global online
  useEffect(() => {
    const id = setInterval(() => { globalNowRef.current = Date.now(); }, 5000);
    return () => clearInterval(id);
  }, []);

  // Sautillement perso
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

  // Pointillés animés
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      dashPhase.setValue(0);
      Animated.timing(dashPhase, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: false })
        .start(({ finished }) => { if (!cancelled && finished) tick(); });
    };
    tick();
    return () => { cancelled = true; };
  }, []);

  // Respiration douce offline
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

  // Centrage initial sur le perso (une seule fois, après chargement)
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

  // Speed change pendant déplacement
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
    const wps = cellPath.map((c) => ({ x: c.x * TILE_PX + TILE_PX / 2, y: c.y * TILE_PX + TILE_PX / 2 }));
    wps[0] = { x: cx, y: cy };
    const { samples: newSamples, length } = smoothPath(wps);
    activePathRef.current = newSamples;
    startMoveAlongCurve(newSamples, length);
  }, [speedMul]);

  // Cleanup speedTimer au unmount
  useEffect(() => {
    return () => { if (speedTimer.current) clearTimeout(speedTimer.current); };
  }, []);

  // === GESTURES ===

  const onPanGesture = Animated.event(
    [{ nativeEvent: { translationX: dx, translationY: dy } }],
    { useNativeDriver: true }
  );

  const onPanStateChange = (e) => {
    const { state, translationX, translationY } = e.nativeEvent;

    // Détecte si le user a vraiment pané (dépassement du seuil)
    if (state === State.ACTIVE || state === State.END || state === State.CANCELLED) {
      const dist = Math.sqrt(translationX * translationX + translationY * translationY);
      if (dist >= PAN_THRESHOLD_PX) {
        markUserHasPanned();
      }
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

  const onPinchStateChange = (e) => {
    const { state } = e.nativeEvent;
    // Le pinch déplace aussi la caméra visuellement
    if (state === State.BEGAN) {
      markUserHasPanned();
    }
    if (state === State.END || state === State.CANCELLED) {
      let next = lastScale.current * e.nativeEvent.scale;
      next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
      lastScale.current = next;
      baseScale.setValue(next);
      pinchScale.setValue(1);
    }
  };

  const onCanvasLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ w: width, h: height });
  };

  // === HELPERS ===

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

  const LETTER_TAP_RADIUS = 30;
  const LETTER_READ_DISTANCE = 80;
  const findTappedLetter = (tap) => {
    let best = null, bestD = LETTER_TAP_RADIUS;
    for (const l of letters) {
      if (!profile || l.authorId === profile.id) continue;
      const distToMe = Math.hypot(l.x - pos.x, l.y - pos.y);
      if (distToMe > LETTER_READ_DISTANCE) continue;
      const d = Math.hypot(l.x - tap.x, l.y - tap.y);
      if (d < bestD) { bestD = d; best = l; }
    }
    return best;
  };

  // === ACTIONS ===

  const handleTap = (evt) => {
    const t = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };
    const tappedLetter = findTappedLetter(t);
    if (tappedLetter) { setReadingLetter(tappedLetter); return; }
    const tappedPlayer = findTappedPlayer(t);
    if (tappedPlayer) { setSelectedPlayer(tappedPlayer); return; }
    if (moving) return;
    if (pendingTarget) {
      const d = Math.hypot(pendingTarget.x - t.x, pendingTarget.y - t.y);
      if (d > 30) setPendingTarget(null);
      return;
    }
    const sx = Math.floor(pos.x / TILE_PX);
    const sy = Math.floor(pos.y / TILE_PX);
    const tx = Math.floor(t.x / TILE_PX);
    const ty = Math.floor(t.y / TILE_PX);
    const cellPath = findPath(TILES_DATA, MAP_W, MAP_H, sx, sy, tx, ty);
    if (!cellPath) return;
    const wps = cellPath.map((c) => ({
      x: c.x * TILE_PX + TILE_PX / 2,
      y: c.y * TILE_PX + TILE_PX / 2,
    }));
    wps[0] = { x: pos.x, y: pos.y };
    const { samples, length } = smoothPath(wps);
    const finalPx = wps[wps.length - 1];
    setPendingTarget({ ...finalPx, samples, length });
  };

  // === Letters handlers ===
  const openLetterWrite = () => {
    setLetterDraft('');
    setLetterWriteOpen(true);
  };

  const sendLetter = async () => {
    const text = (letterDraft || '').trim();
    if (!text || !profile) return;
    setLetterWriteOpen(false);
    setLetterDraft('');
    try {
      await dropLetter({
        authorId: profile.id,
        authorName: profile.name,
        authorColor: profile.color,
        x: pos.x, y: pos.y,
        text,
      });
    } catch (e) {
      console.warn('drop letter failed', e);
    }
  };

  const closeReadingLetter = async () => {
    const l = readingLetter;
    setReadingLetter(null);
    if (l?.id) {
      try { await consumeLetter(l.id); } catch (e) {}
    }
  };

  const confirmMove = () => {
    if (!pendingTarget) return;
    const samples = pendingTarget.samples;
    const length = pendingTarget.length;
    activePathRef.current = samples;
    setFrozenActivePath(samples);
    setPendingTarget(null);
    setTarget({ x: pendingTarget.x, y: pendingTarget.y });
    startMoveAlongCurve(samples, length);
  };

  const cancelMove = () => setPendingTarget(null);

  const progressRef = useRef(null);
  const progressListenerId = useRef(null);

  const startMoveAlongCurve = (samples, length) => {
    if (!samples || samples.length < 2) return;
    const baseDuration = Math.max(MIN_DURATION_FALLBACK, Math.min(MAX_DURATION_FALLBACK, (length / SPEED_PX_PER_SEC) * 1000));
    const dur = baseDuration / speedMul;
    moveTarget.current = samples[samples.length - 1];
    moveBaseDuration.current = baseDuration;
    setMoving(true);
    setEta(Date.now() + dur);

    announceMove({
      from: { x: pos.x, y: pos.y },
      to: samples[samples.length - 1],
      startTs: Date.now(),
      durationMs: dur,
    });

    const progress = new Animated.Value(0);
    progressRef.current = progress;
    progressListenerId.current = progress.addListener(({ value }) => {
      const p = sampleAt(samples, value);
      animX.setValue(p.x);
      animY.setValue(p.y);
    });

    const anim = Animated.timing(progress, {
      toValue: length,
      duration: dur,
      easing: Easing.linear,
      useNativeDriver: false,
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
    animX.setValue(final.x);
    animY.setValue(final.y);
    setPos({ x: final.x, y: final.y });
    clearMyMove(final.x, final.y);
    setMoving(false);
    setEta(null);
    setTarget(null);
    activePathRef.current = null;
    setFrozenActivePath(null);
    currentAnim.current = null;
    moveTarget.current = null;
  };

  const startMove = (t) => {
    const { baseDurationMs } = movementDuration(pos, t, 1);
    moveTarget.current = t;
    moveBaseDuration.current = baseDurationMs;
    setMoving(true);
    const dur = baseDurationMs / speedMul;
    announceMove({
      from: { x: pos.x, y: pos.y }, to: t,
      startTs: Date.now(), durationMs: dur,
    });
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

  /**
   * Recentre la caméra sur le personnage avec une animation fluide.
   * Lit la position caméra réelle (lastOffset + delta geste en cours) pour
   * éviter tout saut visuel si l'user a le doigt posé pendant le tap.
   */
  const recenter = () => {
    const vw = viewport.w || SCREEN_W;
    const vh = viewport.h || SCREEN_H;
    const s = lastScale.current;
    const charX = animX.__getValue();
    const charY = animY.__getValue();

    // Position caméra actuelle (stable + delta live)
    const curOffX = lastOffset.current.x + dx.__getValue();
    const curOffY = lastOffset.current.y + dy.__getValue();

    const { x: targetX, y: targetY } = computeCenteredOffset(charX, charY, vw, vh, s);

    // Commit le delta live dans lastOffset avant d'animer
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
      // Repasse en mode "suivi" : efface le flag pané
      userHasPanned.current = false;
      setShowRecenterBtn(false);
      // Si le perso est encore en mouvement, démarre le follow loop
      if (moving) startFollowLoop();
    });
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

  // === Profile ===

  const openSettings = () => {
    setDraftName(profile?.name || '');
    setSettingsOpen(true);
  };

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

  // === Stats preview ===
  const previewStats = pendingTarget ? (() => {
    const length = pendingTarget.length || 0;
    let durMs = (length / SPEED_PX_PER_SEC) * 1000;
    durMs = Math.max(MIN_DURATION_FALLBACK, Math.min(MAX_DURATION_FALLBACK, durMs));
    durMs = durMs / Math.max(1, speedMul);
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
                  transform: [{ translateX: totalX }, { translateY: totalY }, { scale: totalScale }],
                }]}>
                  <TouchableWithoutFeedback onPress={handleTap}>
                    <View style={StyleSheet.absoluteFill}>
                      {/* Tilemap */}
                      <TileLayer />

                      {/* Preview : courbe pathfinding (bleu pointillé) */}
                      {pendingTarget && (
                        <PathOverlay
                          samples={pendingTarget.samples}
                          color="#3a7ea8" dashed opacity={0.95}
                        />
                      )}

                      {/* Chemin actif figé */}
                      {frozenActivePath && (
                        <PathOverlay samples={frozenActivePath} color="#3a7ea8" dashed={false} opacity={0.7} />
                      )}

                      {/* Lettres déposées */}
                      {letters.map((l) => {
                        const isMine = profile && l.authorId === profile.id;
                        const distToMe = Math.hypot(l.x - pos.x, l.y - pos.y);
                        const readable = !isMine && distToMe <= 80;
                        const iconColor = isMine
                          ? '#666'
                          : (readable ? (l.authorColor || '#8b4513') : '#888');
                        return (
                          <View
                            key={l.id}
                            pointerEvents="none"
                            style={{ position: 'absolute', left: l.x - 16, top: l.y - 16 }}
                          >
                            {readable && (
                              <View style={{
                                position: 'absolute', left: -6, top: -6,
                                width: 44, height: 44, borderRadius: 22,
                                backgroundColor: l.authorColor || '#ffd93d',
                                opacity: 0.25,
                              }} />
                            )}
                            <ScrollText size={32} color={iconColor} strokeWidth={2.2} />
                          </View>
                        );
                      })}

                      {/* Marqueur destination en cours */}
                      {target && (
                        <View style={[styles.targetMarker, { left: target.x - 14, top: target.y - 14 }]}>
                          <View style={styles.targetInner} />
                        </View>
                      )}

                      {/* Preview pointillés */}
                      {pendingTarget && (
                        <>
                          <AnimatedDottedLine from={pos} to={pendingTarget} phase={dashPhase} />
                          <View style={[styles.previewTargetOuter, { left: pendingTarget.x - 18, top: pendingTarget.y - 18 }]} />
                          <View style={[styles.previewTargetInner, { left: pendingTarget.x - 6, top: pendingTarget.y - 6 }]} />
                        </>
                      )}

                      {/* Autres joueurs */}
                      {otherPlayers.map((p) => {
                        const e = playerAnims.get(p.id);
                        if (!e) return null;
                        const isMoving = !!p.target;
                        const online = isOnline(p);
                        const dotTransform = [
                          { translateX: Animated.subtract(e.x, 12) },
                          { translateY: Animated.subtract(e.y, 12) },
                        ];
                        if (isMoving) {
                          dotTransform.push(
                            { translateY: Animated.multiply(bounce, -7) },
                            { scaleX: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
                            { scaleY: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) },
                          );
                        } else if (!online) {
                          const s = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] });
                          dotTransform.push({ scaleX: s }, { scaleY: s });
                        }
                        return (
                          <View key={p.id} style={StyleSheet.absoluteFill} pointerEvents="none">
                            <Animated.View style={{
                              position: 'absolute',
                              width: 50, height: 50,
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
                              <AdventurerSprite
                                size={50} viewBoxScale={1.2}
                                dir="down" moving={isMoving}
                                outfit={p.outfit || 'gray'}
                                skin={p.skin || 'light'}
                                hair={p.hair || 'brown'}
                                hat={p.hat || 'none'}
                              />
                            </Animated.View>
                            {!online && <SleepyZzz x={e.x} y={e.y} />}
                            <Animated.Text
                              numberOfLines={1}
                              style={[styles.otherPlayerLabel, {
                                transform: [
                                  { translateX: Animated.subtract(e.x, 50) },
                                  { translateY: Animated.add(e.y, 22) },
                                ],
                              }]}
                            >
                              {p.name}
                            </Animated.Text>
                          </View>
                        );
                      })}

                      {/* Perso */}
                      <Animated.View style={{
                        position: 'absolute',
                        width: 60, height: 60,
                        transform: [
                          { translateX: Animated.subtract(animX, 30) },
                          { translateY: Animated.subtract(Animated.subtract(animY, 30), Animated.multiply(bounce, 6)) },
                          { scaleX: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
                          { scaleY: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) },
                        ],
                      }}>
                        <AdventurerSprite
                          size={60} viewBoxScale={1.4}
                          dir="down" moving={moving}
                          outfit={profile?.outfit || 'red'}
                          skin={profile?.skin || 'light'}
                          hair={profile?.hair || 'brown'}
                          hat={profile?.hat || 'none'}
                        />
                      </Animated.View>
                    </View>
                  </TouchableWithoutFeedback>
                </Animated.View>
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </PinchGestureHandler>

        {/* TravelingBar pendant déplacement */}
        {moving && (
          <TravelingBar eta={eta} onStop={null} />
        )}

        {/* Bouton recenter — visible uniquement si l'utilisateur a réellement pané */}
        {showRecenterBtn && (
          <TouchableOpacity style={styles.recenterBtn} onPress={recenter} activeOpacity={0.75}>
            <Text style={styles.iconText}>⊕</Text>
          </TouchableOpacity>
        )}

        {/* Bouton speed (debug only) */}
        {debugEnabled && (
          <TouchableOpacity
            style={[styles.speedBtn, speedMul > 1 && styles.speedBtnActive]}
            onPressIn={onSpeedPressIn}
            onPressOut={onSpeedPressOut}
            activeOpacity={0.8}
          >
            <Text style={styles.speedText}>⏩ {speedMul}×</Text>
          </TouchableOpacity>
        )}

        {/* Flèches de bord */}
        {viewport.w > 0 && otherPlayers.map((p) => {
          const e = playerAnims.get(p.id);
          if (!e) return null;
          return (
            <SmoothEdgeArrow
              key={`arr-${p.id}`}
              color={p.color}
              playerX={e.x} playerY={e.y}
              camX={totalX} camY={totalY}
              scaleVal={totalScale}
              W={viewport.w} H={viewport.h}
            />
          );
        })}

        {/* Indicateur online */}
        {profile && (
          <View style={styles.onlineBadge} pointerEvents="none">
            <View style={[styles.onlineDot, { backgroundColor: profile.color }]} />
            <Text style={styles.onlineText}>
              {profile.name} · {otherPlayers.filter(isOnline).length} en ligne
            </Text>
          </View>
        )}

        {/* ConfirmationBar avant déplacement */}
        {pendingTarget && previewStats && (
          <ConfirmationBar
            distancePx={previewStats.dist}
            durationSec={previewStats.durSec}
            destLabel={`${Math.round(pendingTarget.x / TILE_PX)}, ${Math.round(pendingTarget.y / TILE_PX)}`}
            onCancel={cancelMove}
            onConfirm={confirmMove}
          />
        )}

        {/* Bouton Settings */}
        <TouchableOpacity style={styles.settingsBtn} onPress={openSettings}>
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>

        {/* Bouton Lettre */}
        {!moving && !pendingTarget && (
          <TouchableOpacity style={styles.letterBtn} onPress={openLetterWrite} activeOpacity={0.8}>
            <Animated.View style={[
              styles.letterBtnHalo,
              {
                transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }],
                opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.2] }),
              },
            ]} />
            <View style={styles.letterBtnInner}>
              <ScrollText size={28} color="#5a3a1c" strokeWidth={2.2} />
            </View>
          </TouchableOpacity>
        )}

        {/* Modals */}
        {settingsOpen && (
          <SettingsModal
            profile={profile}
            draftName={draftName}
            setDraftName={setDraftName}
            onPatch={(patch) => saveProfile(patch)}
            debugEnabled={debugEnabled}
            onToggleDebug={onToggleDebug}
            onClose={() => setSettingsOpen(false)}
            onValidateName={validateName}
          />
        )}
        {selectedPlayer && (
          <PlayerDetailModal
            player={selectedPlayer}
            onClose={() => setSelectedPlayer(null)}
          />
        )}
        {letterWriteOpen && (
          <LetterWriteModal
            value={letterDraft}
            setValue={setLetterDraft}
            onSend={sendLetter}
            onClose={() => setLetterWriteOpen(false)}
          />
        )}
        {readingLetter && (
          <LetterReadModal
            letter={readingLetter}
            onClose={closeReadingLetter}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', overflow: 'hidden' },
  canvas: { flex: 1 },
  map: { position: 'absolute', backgroundColor: '#5da269' },
  corner: { position: 'absolute', width: 80, height: 80 },
  gridV: { position: 'absolute', top: 0, width: 1, height: MAP_SIZE, backgroundColor: 'rgba(255,255,255,0.18)' },
  gridH: { position: 'absolute', left: 0, height: 1, width: MAP_SIZE, backgroundColor: 'rgba(255,255,255,0.18)' },

  player: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#ff6b6b',
    borderWidth: 3, borderColor: '#fff',
  },
  otherPlayer: {
    position: 'absolute',
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#fff',
    opacity: 0.95,
  },
  otherPlayerLabel: {
    position: 'absolute',
    left: 0, top: 0, width: 100,
    textAlign: 'center',
    color: '#fff', fontSize: 11, fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 3,
  },

  targetMarker: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,217,61,0.25)',
    borderWidth: 2, borderColor: '#ffd93d',
    justifyContent: 'center', alignItems: 'center',
  },
  targetInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffd93d' },

  previewTargetOuter: {
    position: 'absolute',
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: '#ffd93d',
    backgroundColor: 'rgba(255,217,61,0.18)',
  },
  previewTargetInner: {
    position: 'absolute',
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#ffd93d',
  },

  hud: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' },
  hudText: {
    color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    fontSize: 13, fontWeight: '600',
  },

  recenterBtn: {
    position: 'absolute',
    bottom: 170,
    left: '50%',
    marginLeft: -22,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,251,232,0.96)',
    borderWidth: 1.5, borderColor: '#3a2614',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  iconText: { color: '#3a2614', fontSize: 22, fontWeight: '700' },

  speedBtn: {
    position: 'absolute', bottom: 40, right: 16,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.7)',
    minWidth: 70, alignItems: 'center',
  },
  speedBtnActive: { backgroundColor: '#ff6b6b' },
  speedText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  onlineBadge: {
    position: 'absolute', top: TOP_SAFE, left: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  onlineText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  previewBar: {
    position: 'absolute', bottom: 110, left: 20, right: 20,
    backgroundColor: '#fff', borderRadius: 18,
    paddingVertical: 14, paddingHorizontal: 18,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  previewStats: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    marginBottom: 14,
  },
  previewStat: { alignItems: 'center', flex: 1 },
  previewStatLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewStatValue: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginTop: 2 },
  previewSep: { width: 1, height: 30, backgroundColor: '#eee' },
  previewBtns: { flexDirection: 'row', gap: 10 },
  previewBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  previewBtnCancel: { backgroundColor: '#f3f3f3' },
  previewBtnGo: { backgroundColor: '#ff6b6b' },
  previewBtnText: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },

  settingsBtn: {
    position: 'absolute', top: TOP_SAFE - 4, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  customizeBtn: {
    position: 'absolute', top: TOP_SAFE - 4, right: 70,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  settingsIcon: { color: '#fff', fontSize: 22 },

  letterBtn: {
    position: 'absolute', bottom: 170, right: 16,
    width: 60, height: 60,
    justifyContent: 'center', alignItems: 'center',
  },
  letterBtnHalo: {
    position: 'absolute',
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#ffd93d',
  },
  letterBtnInner: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#f4e4bc',
    borderWidth: 2, borderColor: '#a08050',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.25,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
