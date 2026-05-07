// TripSummaryModal — récap de trajet style Strava
// Props:
//   trip: {
//     samples, distancePx, durationMs,
//     collectedLetters: [{authorName, authorColor, text}],
//     xpBefore: number,   // totalDistancePx avant le trajet
//     xpAfter:  number,   // totalDistancePx après le trajet
//   }
//   onClose: () => void

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Easing, ScrollView, Dimensions,
} from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { THEME } from '../src/theme';
import { formatDuration } from '../src/format';
import XPBar from './XPBar';

const { width: SCREEN_W } = Dimensions.get('window');
const MAP_SIZE = 200;

function MiniMap({ samples }) {
  if (!samples || samples.length < 2) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of samples) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const PADDING = 20;
  const drawW = MAP_SIZE - PADDING * 2;
  const drawH = MAP_SIZE - PADDING * 2;
  const scaleF = Math.min(drawW / rangeX, drawH / rangeY);
  const offX = PADDING + (drawW - rangeX * scaleF) / 2;
  const offY = PADDING + (drawH - rangeY * scaleF) / 2;

  const pts = samples.map((p) => {
    const x = offX + (p.x - minX) * scaleF;
    const y = offY + (p.y - minY) * scaleF;
    return `${x},${y}`;
  }).join(' ');

  const start = samples[0];
  const end = samples[samples.length - 1];
  const sx = offX + (start.x - minX) * scaleF;
  const sy = offY + (start.y - minY) * scaleF;
  const ex = offX + (end.x - minX) * scaleF;
  const ey = offY + (end.y - minY) * scaleF;

  return (
    <View style={styles.mapContainer}>
      <Svg width={MAP_SIZE} height={MAP_SIZE}>
        <Polyline points={pts} fill="none" stroke="#fc4c02" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={sx} cy={sy} r={5} fill="#fff" stroke="#fc4c02" strokeWidth={2} />
        <Circle cx={ex} cy={ey} r={6} fill="#fc4c02" stroke="#fff" strokeWidth={2} />
      </Svg>
    </View>
  );
}

function formatMetersLocal(px) {
  if (px >= 1000) return `${(px / 1000).toFixed(2)} km`;
  return `${Math.round(px)} m`;
}

export default function TripSummaryModal({ trip, onClose }) {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 22, stiffness: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 600, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const { samples, distancePx, durationMs, collectedLetters = [], xpBefore = 0, xpAfter = 0 } = trip;
  const durStr = formatDuration(Math.round(durationMs / 1000));
  const distStr = formatMetersLocal(distancePx);
  const xpGain = Math.max(0, xpAfter - xpBefore);

  return (
    <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.titleLabel}>Récap de trajet</Text>
            <Text style={styles.subtitle}>Treasure Quest</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Mini-map */}
        <MiniMap samples={samples} />

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{distStr}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{durStr}</Text>
            <Text style={styles.statLabel}>Durée</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{collectedLetters.length}</Text>
            <Text style={styles.statLabel}>Message{collectedLetters.length > 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* ── Progression XP animée ── */}
        <View style={styles.xpSection}>
          <Text style={styles.sectionTitle}>Progression</Text>
          <XPBar totalDistancePx={xpAfter} gainPx={xpGain} />
        </View>

        {/* Messages ramassés */}
        {collectedLetters.length > 0 && (
          <View style={styles.lettersSection}>
            <Text style={styles.sectionTitle}>Messages ramassés</Text>
            <ScrollView style={styles.lettersList} showsVerticalScrollIndicator={false}>
              {collectedLetters.map((l, i) => (
                <View key={i} style={styles.letterItem}>
                  <View style={[styles.letterDot, { backgroundColor: l.authorColor || '#8b4513' }]} />
                  <View style={styles.letterBody}>
                    <Text style={styles.letterAuthor}>{l.authorName || 'Anonyme'}</Text>
                    <Text style={styles.letterText} numberOfLines={2}>{l.text}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity style={styles.ctaBtn} onPress={handleClose} activeOpacity={0.8}>
          <Text style={styles.ctaBtnText}>Continuer l'exploration</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, paddingBottom: 36, paddingHorizontal: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleLabel: { fontSize: 20, fontWeight: '800', color: THEME.text },
  subtitle: { fontSize: 12, color: THEME.textMuted || '#aaa', marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { color: THEME.text, fontSize: 15, fontWeight: '700' },
  mapContainer: {
    width: MAP_SIZE, height: MAP_SIZE,
    backgroundColor: '#1e3a2e',
    borderRadius: 14, overflow: 'hidden',
    alignSelf: 'center', marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, paddingVertical: 16, marginBottom: 18,
  },
  statBlock: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: THEME.text },
  statLabel: { fontSize: 11, color: THEME.textMuted || '#aaa', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 },
  statDivider: { width: 1, height: 36, backgroundColor: THEME.border || 'rgba(255,255,255,0.12)' },
  xpSection: { marginBottom: 14 },
  lettersSection: { marginBottom: 18 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: THEME.textMuted || '#aaa', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  lettersList: { maxHeight: 160 },
  letterItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, padding: 10, marginBottom: 8,
  },
  letterDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3, marginRight: 10, flexShrink: 0 },
  letterBody: { flex: 1 },
  letterAuthor: { fontSize: 12, fontWeight: '700', color: THEME.text, marginBottom: 2 },
  letterText: { fontSize: 13, color: THEME.textMuted || '#bbb', lineHeight: 18 },
  ctaBtn: {
    backgroundColor: '#fc4c02',
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center',
  },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
