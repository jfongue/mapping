// TripSummaryModal — affiche le résumé du trajet (distance, durée, pickups, XP).
//
// Props :
//   summary : { distancePx, durationMs, pickedUpItems, startDistancePx } | null
//   onClose : () => void

import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import XPBar from './XPBar';
import { THEME } from '../src/theme';
import { formatMeters, formatDuration } from '../src/format';

export default function TripSummaryModal({ summary, onClose }) {
  return (
    <Modal visible={!!summary} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>🏁 Trajet terminé</Text>
          <Text style={styles.text}>
            {summary
              ? `${formatMeters(summary.distancePx)} · ${formatDuration(Math.round(summary.durationMs / 1000))}`
              : ''}
          </Text>
          {summary && (
            <XPBar
              totalDistancePx={summary.startDistancePx + summary.distancePx}
              startDistancePx={summary.startDistancePx}
              animated
            />
          )}
          {summary?.pickedUpItems?.length > 0 && (
            <View style={styles.pickups}>
              <Text style={styles.pickupsTitle}>Vous avez trouvé :</Text>
              {summary.pickedUpItems.map((item) => (
                <Text key={item.id} style={styles.pickupLine}>
                  {'- nouveau message de '}{item.authorName || 'Anonyme'}
                </Text>
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.btn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.btnText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modal: {
    width: '100%', maxWidth: 380,
    backgroundColor: THEME.card, borderRadius: THEME.radiusLg,
    padding: 20, ...THEME.shadow,
  },
  title: {
    color: THEME.text, fontSize: 20, fontWeight: '700',
    marginBottom: 8, textAlign: 'center',
  },
  text: {
    color: THEME.textMuted, fontSize: 14,
    textAlign: 'center', marginBottom: 12,
  },
  pickups: { marginTop: 12 },
  pickupsTitle: { color: THEME.text, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  pickupLine: { color: THEME.textMuted, fontSize: 13, marginBottom: 2 },
  btn: {
    marginTop: 18, paddingVertical: 12, borderRadius: THEME.radiusLg,
    backgroundColor: '#ff6b6b', alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
