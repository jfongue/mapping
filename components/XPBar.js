// XPBar — niveaux d'exploration avec barre de progression
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../src/theme';

const LEVELS = [
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

function formatDist(px) {
  if (px >= 1000000) return `${(px / 1000000).toFixed(1).replace('.0', '')} 000 km`;
  if (px >= 1000)    return `${(px / 1000).toFixed(1).replace('.0', '')} km`;
  return `${Math.round(px)} m`;
}

export default function XPBar({ totalDistancePx }) {
  const dist = Math.max(0, Math.round(totalDistancePx || 0));

  // Trouver le niveau actuel
  let currentIdx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (dist >= LEVELS[i].threshold) { currentIdx = i; break; }
  }

  const current = LEVELS[currentIdx];
  const next = LEVELS[currentIdx + 1] || null;

  let progress = 1;
  let remaining = null;
  if (next) {
    const span = next.threshold - current.threshold;
    const done = dist - current.threshold;
    progress = Math.min(1, done / span);
    remaining = next.threshold - dist;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.levelBadge}>Niv. {current.level}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.totalDist}>{formatDist(dist)}</Text>
      </View>

      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
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
  barBg: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.10)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: THEME.accent,
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
