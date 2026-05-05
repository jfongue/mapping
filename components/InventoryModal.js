// Modal Inventaire : liste des messages ramassés.
// L'utilisateur peut lire (marque comme lu) et supprimer chaque message.
import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import { ScrollText, Trash2 } from 'lucide-react-native';
import { THEME } from '../src/theme';

export default function InventoryModal({ items, onClose, onMarkRead, onDelete }) {
  const [openId, setOpenId] = useState(null);

  const open = (l) => {
    setOpenId(l.id);
    if (l.unread) onMarkRead(l.id);
  };

  const sorted = [...(items || [])].sort((a, b) => (b.pickedAt || 0) - (a.pickedAt || 0));

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      <View style={styles.card}>
        <Text style={styles.kicker}>INVENTAIRE</Text>
        <Text style={styles.title}>
          {sorted.length === 0 ? 'Aucun message' : `${sorted.length} message${sorted.length > 1 ? 's' : ''}`}
        </Text>

        {sorted.length === 0 ? (
          <Text style={styles.empty}>
            Approche-toi d'un message sur la carte pour le ramasser.
          </Text>
        ) : (
          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingVertical: 4 }}>
            {sorted.map((l) => {
              const isOpen = openId === l.id;
              return (
                <View key={l.id} style={styles.item}>
                  <TouchableOpacity style={styles.itemHead} onPress={() => open(l)} activeOpacity={0.7}>
                    <View style={styles.itemIcon}>
                      <ScrollText size={20} color={THEME.text} strokeWidth={2.2} />
                      {l.unread && <View style={styles.unreadDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.itemRow}>
                        <View style={[styles.dot, { backgroundColor: l.authorColor || '#888' }]} />
                        <Text style={styles.author} numberOfLines={1}>
                          {l.authorName || 'Anonyme'}
                        </Text>
                      </View>
                      {!isOpen && (
                        <Text style={styles.preview} numberOfLines={1}>{l.text}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => onDelete(l.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color={THEME.danger} strokeWidth={2.2} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                  {isOpen && (
                    <Text style={styles.body}>{l.text}</Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>Fermer</Text>
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
    borderRadius: THEME.radiusLg, padding: 18,
    borderWidth: 1.5, borderColor: THEME.border,
    width: '100%', maxWidth: 380,
    ...THEME.shadow,
  },
  kicker: {
    fontSize: 10, letterSpacing: 1.2,
    fontWeight: '700', color: THEME.textMuted,
    textAlign: 'center',
  },
  title: {
    fontSize: 18, fontWeight: '700',
    color: THEME.text, textAlign: 'center', marginTop: 2, marginBottom: 12,
  },
  empty: {
    fontSize: 13, color: THEME.textMuted,
    textAlign: 'center', paddingVertical: 22, fontStyle: 'italic',
  },
  item: {
    borderWidth: 1, borderColor: THEME.borderSoft,
    borderRadius: THEME.radiusMd,
    backgroundColor: '#fffef0',
    marginBottom: 8, padding: 10,
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f4e4bc',
    borderWidth: 1, borderColor: THEME.borderSoft,
    justifyContent: 'center', alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute', top: -2, right: -2,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: THEME.danger,
    borderWidth: 1.5, borderColor: THEME.card,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  author: { fontSize: 13, fontWeight: '700', color: THEME.text, flex: 1 },
  preview: { fontSize: 12, color: THEME.textMuted, marginTop: 2 },
  body: {
    fontSize: 14, color: THEME.text, fontStyle: 'italic',
    lineHeight: 20, marginTop: 8,
    paddingLeft: 42,
  },
  deleteBtn: { padding: 4 },
  close: {
    marginTop: 12, backgroundColor: THEME.accent,
    paddingVertical: 12, borderRadius: THEME.radiusMd, alignItems: 'center',
  },
  closeText: { color: THEME.textOnDark, fontSize: 15, fontWeight: '700' },
});
