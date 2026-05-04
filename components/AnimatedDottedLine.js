// Ligne pointillée animée : les points défilent du from au to en boucle.
import React from 'react';
import { Animated } from 'react-native';

const STEP = 16;

export default function AnimatedDottedLine({ from, to, phase, color = '#ffd93d' }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const n = Math.floor(len / STEP);
  const ux = dx / len, uy = dy / len;
  const dots = [];

  for (let i = 0; i < n; i++) {
    const baseT = i / Math.max(1, n);
    const tx = phase.interpolate({
      inputRange: [0, 1],
      outputRange: [from.x + ux * (i * STEP), from.x + ux * ((i + 1) * STEP)],
    });
    const ty = phase.interpolate({
      inputRange: [0, 1],
      outputRange: [from.y + uy * (i * STEP), from.y + uy * ((i + 1) * STEP)],
    });
    const opacity = phase.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [
        0.4 + 0.5 * (1 - baseT),
        0.9,
        0.4 + 0.5 * baseT,
      ],
    });
    dots.push(
      <Animated.View
        key={i}
        style={{
          position: 'absolute',
          left: Animated.subtract(tx, 4),
          top: Animated.subtract(ty, 4),
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: color,
          opacity,
        }}
      />
    );
  }
  return <>{dots}</>;
}
