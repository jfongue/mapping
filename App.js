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