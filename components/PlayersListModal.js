// PlayersListModal — liste des joueurs connectés avec toggle "follow".
//
// Props :
//   visible : boolean
//   onClose : () => void
//   players : array<{ id, name, color }>
//   isOnline : (player) => boolean
//   followedPlayers : Set<id>
//   toggleFollow : (id) => void

import React from 'react';
import {
  Modal, View, Text, ScrollView,
  TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
} from 'react-native';
import { Heart } from 'lucide-react-native';
import { THEME } from '../src/theme';

export default function PlayersListModal({
  visible, onClose, players, isOnline, followedPlayers, toggleFollow,
}) {
  const onlineCount = players.filter(isOnline).length;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.card}>
              <Text style={styles.title}>
                👥 Joueurs en ligne ({onlineCount})
              </Text>
              {players.length === 0 ? (
                <Text style={styles.empty}>Aucun autre joueur connecté</Text>
              ) : (
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                  {players.map((p) => {
                    const online = isOnline(p);
                    const followed = followedPlayers.has(p.id);
                    return (
                      <View key={p.id} style={styles.row}>
                        <View style={[styles.dot, { backgroundColor: p.color || '#888' }]} />
                        <Text style={[styles.name, !online && styles.nameOffline]}>
                          {p.name || 'Anonyme'}
                        </Text>
                        {!online && <Text style={styles.status}>💤</Text>}
                        <TouchableOpacity
                          style={[styles.heart, followed && styles.heartActive]}
                          onPress={() => toggleFollow(p.id)}
                          activeOpacity={0.7}
                        >
                          <Heart
                            size={18}
                            color={followed ? '#ff4d6d' : THEME.text}
                            fill={followed ? '#ff4d6d' : 'none'}
                            strokeWidth={2}
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.closeBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 380,
    backgroundColor: THEME.card, borderRadius: THEME.radiusLg,
    padding: 20, ...THEME.shadow,
  },
  title: {
    color: THEME.text, fontSize: 18, fontWeight: '700',
    marginBottom: 16, textAlign: 'center',
  },
  empty: {
    color: THEME.textMuted, fontSize: 14,
    textAlign: 'center', paddingVertical: 20,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 10,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { color: THEME.text, fontSize: 15, fontWeight: '600', flex: 1 },
  nameOffline: { color: THEME.textMuted },
  status: { fontSize: 14 },
  heart: {
    padding: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: THEME.border,
  },
  heartActive: { borderColor: '#ff4d6d', backgroundColor: 'rgba(255,77,109,0.1)' },
  closeBtn: {
    marginTop: 16, paddingVertical: 12, borderRadius: THEME.radiusLg,
    backgroundColor: THEME.border, alignItems: 'center',
  },
  closeBtnText: { color: THEME.text, fontSize: 15, fontWeight: '700' },
});
