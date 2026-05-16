// Treasure Quest — App principal
// Logique pure dans /src, composants UI dans /components.
// App.js orchestre uniquement : état React, gestes, animations natives.

import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, Animated, Easing,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import {
  GestureHandlerRootView, PanGestureHandler, PinchGestureHandler,
} from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { safeSet } from './src/storage';

import {
  updateMyProfile, dropLetter,
} from './firebase';

import {
  TOP_SAFE,
  TOTAL_DISTANCE_KEY,
  SPAWN,
  FOG_REVEAL_RADIUS,
  WATER_COLOR,
} from './src/constants';
import { THEME } from './src/theme';

// --- Notifications ---
import { requestNotificationPermissions } from './src/notifications';

import { TILES_DATA, MAP_W, MAP_H, TILE_PX, findPath } from './src/tilemap';
import TileLayer, { MAP_W_PX, MAP_H_PX } from './components/TileLayer';
import DottedTrail from './components/DottedTrail';
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
import { useCamera } from './src/hooks/useCamera';
import { useMovement } from './src/hooks/useMovement';

import { buildStraightPath, findRandomWalkableTileNear } from './src/mapUtils';
import { movementDurationAlongPath } from './src/movement';

import SleepyZzz from './components/SleepyZzz';
import SmoothEdgeArrow from './components/SmoothEdgeArrow';
import SettingsModal from './components/SettingsModal';
import PlayerDetailModal from './components/PlayerDetailModal';
import LetterWriteModal from './components/LetterWriteModal';
import LetterReadModal from './components/LetterReadModal';
import InventoryModal from './components/InventoryModal';
import PlayersListModal from './components/PlayersListModal';
import TripSummaryModal from './components/TripSummaryModal';
import { ConfirmationBar, TravelingBar } from './components/TravelBars';
import { AdventurerSprite } from './components/Adventurer';
import { ScrollText, Settings, Crosshair, Backpack } from 'lucide-react-native';
import { DEBUG_MESSAGES, DEBUG_MESSAGE_AUTHORS } from './src/debugMessages';

export default function App() {
  // --- Profil ---
  const {
    profile, draftName, setDraftName,
    saveProfile: persistProfile,
    debugEnabled, setDebugEnabled,
  } = useProfile();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // --- Boost vitesse ---
  const { speedLvl, speedMul, onPressIn: onSpeedPressIn, onPressOut: onSpeedPressOut } = useBoostSpeed();

  // --- Inventaire ---
  const {
    inventory,
    open: inventoryOpen,
    setOpen: setInventoryOpen,
    unreadCount,
    addItem: addInventoryItem,
    markRead: markInventoryRead,
    deleteItem: deleteInventoryItem,
  } = useInventory();

  // --- Lettres (subscribe + write/read) ---
  const {
    letters,
    writeOpen: letterWriteOpen, setWriteOpen: setLetterWriteOpen,
    draft: letterDraft, setDraft: setLetterDraft,
    readingLetter, setReadingLetter,
    openWrite: openLetterWrite,
    sendLetter: sendLetterAt,
    closeReadingLetter,
    findLetterNearPoint,
  } = useLetters({ profile });

  // --- Mouvement (owns pos, animX/animY, target, eta, trip, totalDistance) ---
  const {
    pos, animX, animY, moving, target, eta, loaded,
    pendingTarget, setPendingTarget,
    activePathRef, frozenActivePath, consumedDist,
    tripSummary, dismissTripSummary,
    totalDistancePx, setTotalDistancePx,
    startMoveAlongCurve, stopMove, confirmMove, cancelMove,
  } = useMovement({ profile, speedMul, letters, addInventoryItem });

  // --- Animations sprite ---
  const { bounce, breathe } = useSpriteAnims(moving);

  // --- Multiplayer ---
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
      safeSet(TOTAL_DISTANCE_KEY, totalPx);
    },
  });

  // --- Brouillard de guerre ---
  const fogCharPos = useFogCharPos(animX, animY, 20);
  const { explored } = useFogOfWar({ animX, animY, moving, loaded });

  // --- Suivi de joueurs ---
  const { followed: followedPlayers, toggle: toggleFollow } = useFollowedPlayers();
  const [playersListOpen, setPlayersListOpen] = useState(false);

  // --- Caméra ---
  const {
    tx, ty, dx, dy, baseScale, pinchScale, totalX, totalY,
    viewport, onCanvasLayout,
    onPanGesture, onPanStateChange, onPinchGesture, onPinchStateChange,
    recenter, centerOnPoint, markUserHasPanned,
    showRecenterBtn,
  } = useCamera({
    getCharPos: () => ({ x: animX.__getValue(), y: animY.__getValue() }),
    moving,
    loaded,
  });

  // --- Notifications ---
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Wrapper sendLetter pour injecter la position courante
  const sendLetter = () => sendLetterAt({ x: pos.x, y: pos.y });

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

        <TripSummaryModal summary={tripSummary} onClose={dismissTripSummary} />

        <PlayersListModal
          visible={playersListOpen}
          onClose={() => setPlayersListOpen(false)}
          players={otherPlayers}
          isOnline={isOnline}
          followedPlayers={followedPlayers}
          toggleFollow={toggleFollow}
        />

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
});
