// Modal récapitulatif de fin de trajet.
// Affiché automatiquement à l'arrivée ou au redémarrage après un trajet.
import React from 'react';
import {
  StyleSheet, View, Text, ScrollView,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import { ScrollText, Ruler, Clock, CheckCircle } from 'lucide-react-native';
import { THEME } from '../src/theme';
import { formatMeters, formatDuration } from '../src/format';

export default function TripRecapModal({ recap, onClose }) {
  if (!recap) return null;

  const { distancePx, durationSec, pickedItems } = recap;
  const items = pickedItems || [];

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      <View style={styles.card}>
        {/* En-tête */}
        <View style={styles.header}>
          <CheckCircle size={28} color={THEME.success} strokeWidth={2.2} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.kicker}>TRAJET TERMINÉ</Text>
            <Text style={styles.title}>Récapitulatif</Text>
          </View>
        </View>

        {/* Stats distance + durée */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ruler size={18} color={THEME.accent} strokeWidth={2.2} />
            <Text style={styles.statValue}>{formatMeters(distancePx)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Clock size={18} color={THEME.accent} strokeWidth={2.2} />
            <Text style={styles.statValue}>{formatDuration(durationSec)}</Text>
            <Text style={styles.statLabel}>Durée</Text>
          </View>
        </View>

        {/* Objets ramassés */}
        <Text style={styles.sectionTitle}>
          {items.length === 0
            ? 'Aucun objet ramassé'
            : `${items.length} objet${items.length > 1 ? 's' : ''} ramassé${items.length > 1 ? 's' : ''}`}
        </Text>

        {items.length > 0 && (
          <ScrollView style={styles.itemList} contentContainerStyle={{ gap: 8 }}>
            {items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemIcon}>
                  <ScrollText size={16} color={item.authorColor || THEME.text} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemAuthor} numberOfLines={1}>
                    {item.authorName || 'Anonyme'}
                  </Text>
                  <Text style={styles.itemPreview} numberOfLines={1}>
                    {item.text}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {items.length === 0 && (
          <Text style={styles.emptyHint}>
            Les messages laissés sur le chemin peuvent être ramassés lors de vos trajets.
          </Text>
        )}

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.closeBtnText}>Super !</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: THEME.radiusLg, padding: 20,
    borderWidth: 1.5, borderColor: THEME.border,
    width: '100%', maxWidth: 380,
    ...THEME.shadow,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 16,
  },
  kicker: {
    fontSize: 10, letterSpacing: 1.2,
    fontWeight: '700', color: THEME.textMuted,
  },
  title: {
    fontSize: 18, fontWeight: '800',
    color: THEME.text, marginTop: 1,
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f4e4bc',
    borderRadius: THEME.radiusMd,
    borderWidth: 1, borderColor: THEME.borderSoft,
    marginBottom: 16, overflow: 'hidden',
  },
  statBox: {
    flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4,
  },
  statDivider: {
    width: 1, height: 40, backgroundColor: THEME.borderSoft,
  },
  statValue: {
    fontSize: 22, fontWeight: '800', color: THEME.text,
  },
  statLabel: {
    fontSize: 11, color: THEME.textMuted, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: THEME.text,
    marginBottom: 8,
  },
  itemList: {
    maxHeight: 200, marginBottom: 14,
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fffef0',
    borderRadius: THEME.radiusMd,
    borderWidth: 1, borderColor: THEME.borderSoft,
    padding: 10,
  },
  itemIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#f4e4bc',
    borderWidth: 1, borderColor: THEME.borderSoft,
    justifyContent: 'center', alignItems: 'center',
  },
  itemAuthor: {
    fontSize: 12, fontWeight: '700', color: THEME.text,
  },
  itemPreview: {
    fontSize: 11, color: THEME.textMuted, marginTop: 1,
    fontStyle: 'italic',
  },
  emptyHint: {
    fontSize: 12, color: THEME.textMuted,
    fontStyle: 'italic', textAlign: 'center',
    marginBottom: 12, paddingHorizontal: 8,
  },
  closeBtn: {
    marginTop: 4, backgroundColor: THEME.accent,
    paddingVertical: 12, borderRadius: THEME.radiusMd, alignItems: 'center',
  },
  closeBtnText: {
    color: THEME.textOnDark, fontSize: 15, fontWeight: '700',
  },
});
