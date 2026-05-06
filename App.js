// Treasure Quest — App principal
// Logique pure dans /src, composants UI dans /components.
// App.js orchestre uniquement : état React, gestes, animations natives.

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions,
} from 'react-native';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Rect, Path, Line, G, Polygon } from 'react-native-svg';

import {
  ONLINE_THRESHOLD_MS, TAP_PLAYER_RADIUS, SPEED_LEVELS,
  TILE_PX, MAP_W_PX, MAP_H_PX,
  MIN_DURATION_MS, MAX_DURATION_MS, SPEED_PX_PER_SEC, PX_PER_METER,
  COIN_PICKUP_RADIUS, POI_VISIT_RADIUS, CHEST_PICKUP_RADIUS, LETTER_PICKUP_RADIUS,
} from './src/constants';
import { isPassable } from './src/terrain';
import { TILES_DATA, MAP_W, MAP_H, TILE_PX as TP, WALKABLE, findPath } from './src/tilemap';
import { smoothPath, sampleAt, polylineLength } from './src/geometry';
import { pickupCoins, pickupChests, visitPOIs, revealedCellsAlongPath } from './src/gameplay';
import { COINS_DATA, CHESTS_DATA, POIS_DATA } from './src/poi';
import { buildInitialQuests, updateQuests } from './src/quests';
import { MockMultiplayer, FirebaseMultiplayer } from './src/multiplayer';
import { scheduleArrivalNotification, requestNotificationPermission } from './src/notifications';
import { movementDuration, lerpFromTarget, remainingDurationAt } from './src/movement';
import { generateProfile, isPlayerOnline } from './src/profile';
import { formatMeters, formatDuration } from './src/format';

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

import AsyncStorage from '@react-native-async-storage/async-storage';

import TileLayer from './components/TileLayer';
import FogLayer from './components/FogLayer';
import PathOverlay from './components/PathOverlay';
import DottedTrail from './components/DottedTrail';
import PreviewLayer from './components/PreviewLayer';
import { TripRecapModal } from './components/TripRecapModal';
import { TripSummaryModal } from './components/TripSummaryModal';

import {
  dropLetter, consumeLetter, subscribeLetters,
  announceMove, clearMyMove, subscribePlayers,
} from './src/multiplayer';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MAP_SIZE = MAP_W_PX;
const SPAWN = { x: (MAP_W / 2) * TILE_PX, y: (MAP_H / 2) * TILE_PX };

const PAN_THRESHOLD_PX = 5;
const RECENTER_HIDE_RADIUS = 10;
const MIN_R = 0;
const MAX_R = 9999;

const THEME = { text: '#3a2614', bg: '#fffbe8' };

const INIT_X = SCREEN_W / 2 - MAP_SIZE / 2;
const INIT_Y = SCREEN_H / 2 - MAP_SIZE / 2;

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

const MAP_SIZE2 = MAP_W_PX;
import { formatMeters as fm2, formatDuration as fd2 } from './src/format';
import { movementDuration as md2, lerpFromTarget as lft2, remainingDurationAt as rda2 } from './src/movement';
import { generateProfile as gp2, isPlayerOnline as ipo2 } from './src/profile';

import SleepyZzz2 from './components/SleepyZzz';
import SmoothEdgeArrow2 from './components/SmoothEdgeArrow';
import SettingsModal2 from './components/SettingsModal';
import PlayerDetailModal2 from './components/PlayerDetailModal';
import LetterWriteModal2 from './components/LetterWriteModal';
import LetterReadModal2 from './components/LetterReadModal';
import InventoryModal2 from './components/InventoryModal';
