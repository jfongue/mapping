// Coffre au trésor — SVG stylisé, couleur selon la rareté.
import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Path, Circle, Ellipse } from 'react-native-svg';

export default function TreasureChest({ size = 38, color = '#b8763a', glow = '#e8a45c', dim = false }) {
  const op = dim ? 0.55 : 1;
  return (
    <View pointerEvents="none" style={{ width: size, height: size, opacity: op }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* halo */}
        <Circle cx="12" cy="13" r="11" fill={glow} opacity={dim ? 0.12 : 0.28} />
        {/* ombre */}
        <Ellipse cx="12" cy="20.5" rx="8" ry="1.8" fill="#000" opacity="0.18" />
        {/* corps */}
        <Rect x="4" y="11" width="16" height="8" rx="1.2" fill={color} stroke="#3a2614" strokeWidth="0.8" />
        {/* couvercle */}
        <Path d="M4 11 Q4 6 12 6 Q20 6 20 11 Z" fill={color} stroke="#3a2614" strokeWidth="0.8" />
        <Path d="M4 11 Q4 6 12 6 Q20 6 20 11 Z" fill="#fff" opacity="0.18" />
        {/* bandes métal */}
        <Rect x="10.6" y="6" width="2.8" height="13" fill="#e8c040" stroke="#8b6f1a" strokeWidth="0.5" />
        <Rect x="4" y="10.4" width="16" height="1.6" fill="#e8c040" stroke="#8b6f1a" strokeWidth="0.4" />
        {/* serrure */}
        <Rect x="11" y="12.4" width="2" height="3" rx="0.5" fill="#fff8d8" stroke="#8b6f1a" strokeWidth="0.4" />
        <Circle cx="12" cy="13.2" r="0.7" fill="#8b6f1a" />
      </Svg>
    </View>
  );
}
