// Modal détail d'un autre joueur (clic sur sa boule) + bouton Suivre.
import React from 'react';
import {
  StyleSheet, View, Text,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import { Heart } from 'lucide-react-native';

export default function PlayerDetailModal({ player, onClose, isFollowed, onToggleFollow }) {
  if (!player) return null;
  const remaining = player.target
    ? Math.max(0, Math.ceil((player.target.startTs + player.target.durationMs - Date.now()) / 1000))
    : 0;
  const dist = player.target
    ? Math.round(Math.hypot(player.target.toX - player.target.fromX, player.target.toY - player.target.fromY))
    : 0;
  const followed = isFollowed ? isFollowed(player.id) : false;
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

        {onToggleFollow && (
          <TouchableOpacity
            onPress={() => onToggleFollow(player)}
            style={[styles.followBtn, followed && styles.followBtnActive]}
            activeOpacity={0.75}
          >
            <Heart
              size={16}
              color={followed ? '#fff' : '#ff6b6b'}
              fill={followed ? '#fff' : 'none'}
              strokeWidth={2.2}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.followBtnText, followed && styles.followBtnTextActive]}>
              {followed ? 'Suivi ✓' : 'Suivre ❤️'}
            </Text>
          </TouchableOpacity>
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
  followBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 16, borderWidth: 1.5, borderColor: '#ff6b6b',
    paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20,
  },
  followBtnActive: { backgroundColor: '#ff6b6b', borderColor: '#ff6b6b' },
  followBtnText: { fontSize: 14, fontWeight: '700', color: '#ff6b6b' },
  followBtnTextActive: { color: '#fff' },
  close: {
    marginTop: 12, backgroundColor: '#ff6b6b',
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10,
  },
  closeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
