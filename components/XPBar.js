// XPBar — niveaux d'exploration avec barre de progression animée
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { THEME } from '../src/theme';

export const LEVELS = [
  { level: 1,  title: '🐾 Marcheur',               threshold: 0       },
  { level: 2,  title: '🥾 Randonneur',              threshold: 100     },
  { level: 3,  title: '🗺️ Explorateur',             threshold: 500     },
  { level: 4,  title: '⛵ Navigateur',              threshold: 2000    },
  { level: 5,  title: '🧭 Aventurier',              threshold: 10000   },
  { level: 6,  title: '🏕️ Nomade',                 threshold: 50000   },
  { level: 7,  title: '🌍 Grand Voyageur',          threshold: 150000  },
  { level: 8,  title: '🚀 Pionnier',                threshold: 400000  },
  { level: 9,  title: '🌌 Explorateur Légendaire',  threshold: 700000  },
  { level: 10, title: '🏆 Maître des Terres',       threshold: 1000000 },
];

export function getLevelIndex(dist) {
  let idx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (dist >= LEVELS[i].threshold) { idx = i; break; }
  }
  return idx;
}

export function formatDist(px) {
  if (px >= 1000000) return `${(px / 1000000).toFixed(1).replace('.0', '')} 000 km`;
  if (px >= 1000)    return `${(px / 1000).toFixed(1).replace('.0', '')} km`;
  return `${Math.round(px)} m`;
}

// animated=true : anime de startDistancePx → totalDistancePx au montage
export default function XPBar({ totalDistancePx, startDistancePx, animated = false }) {
  const finalDist = Math.max(0, Math.round(totalDistancePx || 0));
  const startDist = Math.max(0, Math.round(startDistancePx ?? finalDist));

  const animVal = useRef(new Animated.Value(animated ? 0 : 1)).current;

  useEffect(() => {
    if (!animated) { animVal.setValue(1); return; }
    animVal.setValue(0);
    // Délai 300ms avant de démarrer pour laisser le modal s'ouvrir
    const timeout = setTimeout(() => {
      Animated.timing(animVal, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, 300);
    return () => clearTimeout(timeout);
  }, [animated, totalDistancePx]);

  // Distance interpolée selon l'animation
  const interpDist = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [startDist, finalDist],
  });

  // Niveau à la fin (pour afficher le bon titre dès le départ)
  const finalIdx = getLevelIndex(finalDist);
  const startIdx = getLevelIndex(startDist);
  const levelUp = animated && finalIdx > startIdx;

  const current = LEVELS[finalIdx];
  const next = LEVELS[finalIdx + 1] || null;

  // Progress bar basée sur l'animation
  const barWidth = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [
      // progress au départ
      (() => {
        const c = LEVELS[getLevelIndex(startDist)];
        const n = LEVELS[getLevelIndex(startDist) + 1];
        if (!n) return '100%';
        const span = n.threshold - c.threshold;
        const done = startDist - c.threshold;
        return `${Math.round(Math.min(1, done / span) * 100)}%`;
      })(),
      // progress à la fin
      (() => {
        if (!next) return '100%';
        const span = next.threshold - current.threshold;
        const done = finalDist - current.threshold;
        return `${Math.round(Math.min(1, done / span) * 100)}%`;
      })(),
    ],
  });

  // Couleur dorée si level up
  const barColor = levelUp
    ? animVal.interpolate({
        inputRange: [0, 0.7, 1],
        outputRange: [THEME.accent, '#ffd93d', THEME.accent],
      })
    : THEME.accent;

  const remaining = next ? next.threshold - finalDist : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.levelBadge}>Niv. {current.level}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Animated.Text style={styles.totalDist}>
          {animated
            ? interpDist.__getValue
              ? formatDist(finalDist) // fallback statique
              : formatDist(finalDist)
            : formatDist(finalDist)
          }
        </Animated.Text>
      </View>

      {levelUp && (
        <Text style={styles.levelUpBanner}>🎉 Nouveau niveau !</Text>
      )}

      <View style={styles.barBg}>
        <Animated.View style={[styles.barFill, { width: barWidth, backgroundColor: barColor }]} />
      </View>

      {next ? (
        <Text style={styles.nextLabel}>
          encore {formatDist(remaining)} → {next.title}
        </Text>
      ) : (
        <Text style={styles.nextLabel}>🏆 Rang maximal atteint !</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f4e4bc',
    borderRadius: THEME.radiusMd,
    borderWidth: 1, borderColor: THEME.border,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  levelBadge: {
    fontSize: 10, fontWeight: '800',
    color: THEME.textOnDark,
    backgroundColor: THEME.text,
    borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
    overflow: 'hidden',
  },
  title: {
    flex: 1,
    fontSize: 13, fontWeight: '800',
    color: THEME.text,
  },
  totalDist: {
    fontSize: 11, fontWeight: '700',
    color: THEME.textMuted,
  },
  levelUpBanner: {
    fontSize: 12, fontWeight: '800',
    color: '#b8860b',
    textAlign: 'center',
    backgroundColor: '#fff8dc',
    borderRadius: 6,
    paddingVertical: 3,
  },
  barBg: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.10)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 4,
  },
  nextLabel: {
    fontSize: 10, fontWeight: '600',
    color: THEME.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
