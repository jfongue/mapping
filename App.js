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
  MAP_SIZE, GRID_STEP,
  MIN_SCALE, MAX_SCALE,
  ONLINE_THRESHOLD_MS, TAP_PLAYER_RADIUS, SPEED_LEVELS,
  TOP_SAFE, SPAWN, SAVE_KEY, PROFILE_KEY,
  PLAYER_COLORS,
} from './src/constants';
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
import { ScrollText } from 'lucide-react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const INIT_X = SCREEN_W / 2 - MAP_SIZE / 2;
const INIT_Y = SCREEN_H / 2 - MAP_SIZE / 2;

export default function App() {
  // ===== Viewport =====
  const [viewport, setViewport] = useState({ w: SCREEN_W, h: SCREEN_H });
  const [centered, setCentered] = useState(false);

  // ===== Pan caméra =====
  const tx = useRef(new Animated.Value(INIT_X)).current;
  const ty = useRef(new Animated.Value(INIT_Y)).current;
  const dx = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef({ x: INIT_X, y: INIT_Y });
  const totalX = Animated.add(tx, dx);
  const totalY = Animated.add(ty, dy);

  // ===== Zoom =====
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const totalScale = Animated.multiply(baseScale, pinchScale);

  // ===== Perso =====
  const [pos, setPos] = useState(SPAWN);
  const [moving, setMoving] = useState(false);
  const [target, setTarget] = useState(null);
  const [eta, setEta] = useState(null);
  const [now, setNow] = useState(Date.now());
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

  // ===== Tick global online check =====
  const [globalNow, setGlobalNow] = useState(Date.now());

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
    // Cleanup joueurs partis
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

  // Tick pour HUD timer
  useEffect(() => {
    if (!moving) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [moving]);

  // Tick global online
  useEffect(() => {
    const id = setInterval(() => setGlobalNow(Date.now()), 5000);
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

  // Pointillés animés (loop continue)
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

  // Centrage initial sur le perso
  useEffect(() => {
    if (centered || !loaded || viewport.w === 0) return;
    const s = lastScale.current;
    const newX = viewport.w / (2 * s) - animX.__getValue();
    const newY = viewport.h / (2 * s) - animY.__getValue();
    tx.setValue(newX);
    ty.setValue(newY);
    lastOffset.current = { x: newX, y: newY };
    setCentered(true);
  }, [loaded, viewport.w, viewport.h, centered]);

  // Speed change pendant déplacement → relance avec nouvelle durée
  useEffect(() => {
    if (!moving || !moveTarget.current) return;
    if (currentAnim.current) currentAnim.current.stop();
    const target = moveTarget.current;
    const fakeTarget = {
      toX: target.x, toY: target.y,
      durationMs: moveBaseDuration.current,
    };
    const remaining = remainingDurationAt(fakeTarget, animX.__getValue(), animY.__getValue(), speedMul);
    runMoveAnim(remaining);
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
    if (e.nativeEvent.state === State.END || e.nativeEvent.state === State.CANCELLED) {
      lastOffset.current = {
        x: lastOffset.current.x + e.nativeEvent.translationX,
        y: lastOffset.current.y + e.nativeEvent.translationY,
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
    if (e.nativeEvent.state === State.END || e.nativeEvent.state === State.CANCELLED) {
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

  const isOnline = (p) => isPlayerOnline(p, globalNow, ONLINE_THRESHOLD_MS);

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

  // Détecte tap sur une lettre (uniquement celles des autres ET si on est proche)
  const LETTER_TAP_RADIUS = 30;       // tap doit être proche de la lettre
  const LETTER_READ_DISTANCE = 80;    // perso doit être à <80px pour lire
  const findTappedLetter = (tap) => {
    let best = null, bestD = LETTER_TAP_RADIUS;
    for (const l of letters) {
      if (!profile || l.authorId === profile.id) continue;
      // Doit être proche de mon perso
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
    // Tap sur lettre (autres) → ouvre lecture
    const tappedLetter = findTappedLetter(t);
    if (tappedLetter) {
      setReadingLetter(tappedLetter);
      return;
    }
    const tappedPlayer = findTappedPlayer(t);
    if (tappedPlayer) {
      setSelectedPlayer(tappedPlayer);
      return;
    }
    if (moving) return;
    if (pendingTarget) {
      const d = Math.hypot(pendingTarget.x - t.x, pendingTarget.y - t.y);
      if (d > 30) setPendingTarget(null);
      return;
    }
    setPendingTarget(t);
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
    const t = pendingTarget;
    setPendingTarget(null);
    setTarget(t);
    startMove(t);
  };

  const cancelMove = () => setPendingTarget(null);

  const startMove = (t) => {
    const { baseDurationMs } = movementDuration(pos, t, 1); // base avec speedMul=1
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

  const recenter = () => {
    dx.setValue(0);
    dy.setValue(0);
    pinchScale.setValue(1);
    const s = lastScale.current;
    const curX = moving ? animX.__getValue() : pos.x;
    const curY = moving ? animY.__getValue() : pos.y;
    const newX = viewport.w / (2 * s) - curX;
    const newY = viewport.h / (2 * s) - curY;
    Animated.parallel([
      Animated.timing(tx, { toValue: newX, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ty, { toValue: newY, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => { lastOffset.current = { x: newX, y: newY }; });
  };

  // Speed long-press : monte par paliers
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
    const { dist, durationMs } = movementDuration(pos, pendingTarget, speedMul);
    return { dist: Math.round(dist), durSec: Math.round(durationMs / 1000) };
  })() : null;

  // === HUD timer ===
  const remaining = eta ? Math.max(0, Math.ceil((eta - now) / 1000)) : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <PinchGestureHandler onGestureEvent={onPinchGesture} onHandlerStateChange={onPinchStateChange}>
          <Animated.View style={{ flex: 1 }}>
            <PanGestureHandler onGestureEvent={onPanGesture} onHandlerStateChange={onPanStateChange} minPointers={1} maxPointers={1}>
              <Animated.View style={styles.canvas} onLayout={onCanvasLayout}>
                <Animated.View style={[styles.map, {
                  width: MAP_SIZE, height: MAP_SIZE,
                  transform: [{ translateX: totalX }, { translateY: totalY }, { scale: totalScale }],
                }]}>
                  <TouchableWithoutFeedback onPress={handleTap}>
                    <View style={StyleSheet.absoluteFill}>
                      {/* Grille */}
                      {Array.from({ length: Math.floor(MAP_SIZE / GRID_STEP) + 1 }).map((_, i) => (
                        <React.Fragment key={`g${i}`}>
                          <View style={[styles.gridV, { left: i * GRID_STEP }]} />
                          <View style={[styles.gridH, { top: i * GRID_STEP }]} />
                        </React.Fragment>
                      ))}
                      {/* Coins de repère */}
                      <View style={[styles.corner, { top: 0, left: 0, backgroundColor: '#ff6b6b' }]} />
                      <View style={[styles.corner, { top: 0, right: 0, backgroundColor: '#ffd93d' }]} />
                      <View style={[styles.corner, { bottom: 0, left: 0, backgroundColor: '#3d8acf' }]} />
                      <View style={[styles.corner, { bottom: 0, right: 0, backgroundColor: '#9b6dbd' }]} />

                      {/* Lettres déposées (icône lucide ScrollText) */}
                      {letters.map((l) => {
                        const isMine = profile && l.authorId === profile.id;
                        const distToMe = Math.hypot(l.x - pos.x, l.y - pos.y);
                        const readable = !isMine && distToMe <= 80;
                        // Couleur : grisée si pas lisible, sinon couleur auteur
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
                            <Animated.View style={[
                              styles.otherPlayer,
                              { backgroundColor: p.color || '#888', transform: dotTransform },
                            ]} />
                            {!online && <SleepyZzz x={e.x} y={e.y} />}
                            <Animated.Text
                              numberOfLines={1}
                              style={[styles.otherPlayerLabel, {
                                transform: [
                                  { translateX: Animated.subtract(e.x, 50) },
                                  { translateY: Animated.add(e.y, 16) },
                                ],
                              }]}
                            >
                              {p.name}
                            </Animated.Text>
                          </View>
                        );
                      })}

                      {/* Perso */}
                      <Animated.View style={[styles.player, {
                        backgroundColor: profile?.color || '#ff6b6b',
                        transform: [
                          { translateX: Animated.subtract(animX, 14) },
                          { translateY: Animated.subtract(Animated.subtract(animY, 14), Animated.multiply(bounce, 8)) },
                          { scaleX: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
                          { scaleY: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) },
                        ],
                      }]} />
                    </View>
                  </TouchableWithoutFeedback>
                </Animated.View>
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </PinchGestureHandler>

        {/* HUD timer pendant déplacement */}
        {moving && (
          <View style={styles.hud} pointerEvents="none">
            <Text style={styles.hudText}>
              En route — {mm}:{ss}{speedMul > 1 ? ` ×${speedMul}` : ''}
            </Text>
          </View>
        )}

        {/* Bouton recenter */}
        <TouchableOpacity style={styles.recenterBtn} onPress={recenter}>
          <Text style={styles.iconText}>⊕</Text>
        </TouchableOpacity>

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

        {/* Panneau confirmation déplacement */}
        {pendingTarget && previewStats && (
          <View style={styles.previewBar}>
            <View style={styles.previewStats}>
              <View style={styles.previewStat}>
                <Text style={styles.previewStatLabel}>Distance</Text>
                <Text style={styles.previewStatValue}>{formatMeters(previewStats.dist)}</Text>
              </View>
              <View style={styles.previewSep} />
              <View style={styles.previewStat}>
                <Text style={styles.previewStatLabel}>Durée</Text>
                <Text style={styles.previewStatValue}>{formatDuration(previewStats.durSec)}</Text>
              </View>
            </View>
            <View style={styles.previewBtns}>
              <TouchableOpacity style={[styles.previewBtn, styles.previewBtnCancel]} onPress={cancelMove}>
                <Text style={styles.previewBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.previewBtn, styles.previewBtnGo]} onPress={confirmMove}>
                <Text style={[styles.previewBtnText, { color: '#fff' }]}>Partir →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bouton Settings */}
        <TouchableOpacity style={styles.settingsBtn} onPress={openSettings}>
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>

        {/* Bouton Lettre — icône lucide ScrollText */}
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
            onColorChange={(c) => saveProfile({ color: c })}
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
    position: 'absolute', right: 16, bottom: 110,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  iconText: { color: '#fff', fontSize: 22, fontWeight: '700' },

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
