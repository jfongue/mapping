// XPBar — barre d'expérience / niveau, composant autonome.
// Peut être utilisé dans InventoryModal ET dans TripSummaryModal.
// Props:
//   totalDistancePx   : distance cumulée totale (persistée)
//   gainPx            : (optionnel) XP gagné lors du dernier trajet, déclenche l'animation
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { THEME } from '../src/theme';

// ─── Constantes niveau ────────────────────────────────────────────────────────
export const PX_PER_LIEUE = 400;

export const LEVELS = [
  { level: 1,  title: 'Novice',          minLieues: 0    },
  { level: 2,  title: 'Marcheur',        minLieues: 5    },
  { level: 3,  title: 'Explorateur',     minLieues: 15   },
  { level: 4,  title: 'Aventurier',      minLieues: 35   },
  { level: 5,  title: 'Éclaireur',       minLieues: 70   },
  { level: 6,  title: 'Ranger',          minLieues: 120  },
  { level: 7,  title: 'Cartographe',     minLieues: 200  },
  { level: 8,  title: 'Pionnier',        minLieues: 320  },
  { level: 9,  title: 'Légende',         minLieues: 500  },
  { level: 10, title: 'Maître du Monde', minLieues: 750  },
];

export function getLevelInfo(totalDistancePx) {
  const lieues = (totalDistancePx || 0) / PX_PER_LIEUE;
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (lieues >= LEVELS[i].minLieues) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
      break;
    }
  }
  const progress = next
    ? (lieues - current.minLieues) / (next.minLieues - current.minLieues)
    : 1;
  return { current, next, lieues: Math.floor(lieues), progress: Math.min(1, Math.max(0, progress)) };
}

// ─── Composant ────────────────────────────────────────────────────────────────
export default function XPBar({ totalDistancePx, gainPx = 0 }) {
  const before = Math.max(0, (totalDistancePx || 0) - (gainPx || 0));
  const after  = totalDistancePx || 0;

  const { current, next, lieues, progress } = getLevelInfo(after);
  const { progress: progressBefore } = getLevelInfo(before);

  const barAnim = useRef(new Animated.Value(gainPx > 0 ? progressBefore : 0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (gainPx > 0) {
      // Démarre depuis la valeur avant le gain, puis remplit jusqu'à la valeur finale
      barAnim.setValue(progressBefore);
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(barAnim, {
          toValue: progress,
          duration: 900,
          useNativeDriver: false,
        }),
      ]).start();
      // Glow pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
        ]),
        { iterations: 3 }
      ).start();
    } else {
      // Forcer le départ de 0 pour animer à chaque ouverture (ex: InventoryModal)
      barAnim.setValue(0);
      Animated.timing(barAnim, {
        toValue: progress,
        duration: 700,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, gainPx]);

  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] });

  // Calcul du gain en lieues
  const gainLieues = Math.floor((gainPx || 0) / PX_PER_LIEUE);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeLvl}>Niv.</Text>
          <Text style={styles.badgeNum}>{current.level}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.sub}>
            {lieues} lieue{lieues !== 1 ? 's' : ''} parcourue{lieues !== 1 ? 's' : ''}
            {next ? ` · prochain : ${next.minLieues} lieues` : ' · Niveau max !'}
          </Text>
        </View>
        {gainPx > 0 && (
          <View style={styles.gainBadge}>
            <Text style={styles.gainText}>
              +{gainLieues > 0 ? `${gainLieues} lieue${gainLieues > 1 ? 's' : ''}` : `${Math.round(gainPx)} px`}
            </Text>
          </View>
        )}
        {current.level === 10 && <Text style={styles.crown}>👑</Text>}
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: barWidth }]} />
        {gainPx > 0 && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.glow,
              { opacity: glowOpacity },
            ]}
          />
        )}
      </View>

      {next && (
        <View style={styles.labels}>
          <Text style={styles.labelText}>{current.minLieues}</Text>
          <Text style={styles.labelText}>{next.minLieues}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f4e4bc',
    borderRadius: THEME.radiusMd,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 10,
    marginBottom: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  badge: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: THEME.accent,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: THEME.accentDark,
  },
  badgeLvl: { fontSize: 8, fontWeight: '700', color: THEME.textOnDark, letterSpacing: 0.5, lineHeight: 10 },
  badgeNum: { fontSize: 18, fontWeight: '800', color: THEME.textOnDark, lineHeight: 20 },
  title: { fontSize: 14, fontWeight: '700', color: THEME.text },
  sub: { fontSize: 10, color: THEME.textMuted, marginTop: 1 },
  crown: { fontSize: 20, marginLeft: 6 },
  gainBadge: {
    backgroundColor: '#2ecc71',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
    marginLeft: 6,
  },
  gainText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  track: {
    height: 8, backgroundColor: 'rgba(58,38,20,0.15)',
    borderRadius: 4, overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: THEME.accent, borderRadius: 4 },
  glow: {
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  labelText: { fontSize: 9, color: THEME.textMuted },
});
