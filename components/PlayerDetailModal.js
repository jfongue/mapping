// Modal détail d'un autre joueur (clic sur sa boule).
import React from 'react';
import {
  StyleSheet, View, Text,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';

export default function PlayerDetailModal({ player, onClose }) {
  if (!player) return null;
  const remaining = player.target
    ? Math.max(0, Math.ceil((player.target.startTs + player.target.durationMs - Date.now()) / 1000))
    : 0;
  const dist = player.target
    ? Math.round(Math.hypot(player.target.toX - player.target.fromX, player.target.toY - player.target.fromY))
    : 0;
  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      <View style={styles.card}>
        <View style={[styles.dot, { backgroundColor: player.color }]} />
        <Text style={styles.name}>{player.name}</Text>
        <Text style={styles.id}>ID : {player.id}</Text>
        {player.target ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>En déplacement</Text>
            <Text style={styles.value}>{dist} px</Text>
            <Text style={styles.label}>Arrivée dans</Text>
            <Text style={styles.value}>{remaining} s</Text>
          </View>
        ) : (
          <Text style={[styles.label, { marginTop: 12 }]}>À l'arrêt</Text>
        )}
        <TouchableOpacity onPress={onClose} style={styles.close}>
          <Text style={styles.closeText}>Fermer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 320, alignItems: 'center',
  },
  dot: { width: 40, height: 40, borderRadius: 20, marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '700', color: '#1a1a2e' },
  id: { fontSize: 11, color: '#888', marginTop: 4 },
  label: { fontSize: 13, color: '#666', marginTop: 4 },
  value: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  close: {
    marginTop: 18, backgroundColor: '#ff6b6b',
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10,
  },
  closeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
