// Modal pleine écran listant tous les joueurs connectés avec boutons cœur.
import React, { useMemo } from 'react';
import {
  Modal, View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { Heart, X } from 'lucide-react-native';
import { THEME } from '../src/theme';

const ITEM_HEIGHT = 64;

function HeartButton({ followed, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: