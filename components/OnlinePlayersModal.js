// Modal pleine écran "Joueurs en ligne" — liste + bouton cœur follow par joueur.
import React, { useMemo } from 'react';
import {
  Modal, View, Text, StyleSheet,
  FlatList, TouchableOpacity, Pressable,
} from 'react-native';
import { Heart, X } from 'lucide-react-native';
import { THEME } from '../src/theme';
import { TOP_SAFE } from '../src/constants';

function distBetween(a, b) {
  if (!a || !b) return null;
  return Math.round(Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0)));
}

function HeartButton({ followed, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,107,107,0.2)', borderless: true, radius: 22 }}
      style={({ pressed }) => [styles.heartBtn, pressed && styles.heartBtnPressed]}
      hitSlop={12}
    >
      <Heart
        size={20}
        color={followed ? '#ff6b6b' : '#aaa'}
        fill={followed ? '#ff6b6b' : 'none'}
        strokeWidth={2.2}
      />
    </Pressable>
  );
}

function PlayerRow({ item, myPos, isFollowed, onToggleFollow }) {
  const followed = isFollowed(item.id);
  const dist = distBetween(myPos, item);
  const px = item.x != null ? Math.round(item.x) : '?';
  const py = item.y != null ? Math.round(item.y) : '?';

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: item.color || '#888' }]} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name || 'Anonyme'}</Text>
        <Text style={styles.rowSub}>
          {px}, {py}{dist != null ? `  ·  ${dist} px` : ''}
        </Text>
      </View>
      <HeartButton followed={followed} onPress={() => onToggleFollow(item)} />
    </View>
  );
}

export default function OnlinePlayersModal({ visible, onClose, players = [], myPos, isFollowed, onToggleFollow }) {
  const sorted = useMemo(() => {
    if (!myPos) return players;
    return [...players].sort((a, b) => {
      const da = Math.hypot((a.x || 0) - myPos.x, (a.y || 0) - myPos.y);
      const db = Math.hypot((b.x || 0) - myPos.x, (b.y || 0) - myPos.y);
      return da - db;
    });
  }, [players, myPos]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>👥 Joueurs en ligne</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10} activeOpacity={0.7}>
            <X size={22} color={THEME.text} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {sorted.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Aucun joueur connecté</Text>
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <PlayerRow
                item={item}
                myPos={myPos}
                isFollowed={isFollowed}
                onToggleFollow={onToggleFollow}
              />
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg || '#1a1a2e',
    paddingTop: TOP_SAFE + 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: THEME.border,
  },
  title: {
    flex: 1, fontSize: 18, fontWeight: '800', color: THEME.text,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: THEME.card, justifyContent: 'center', alignItems: 'center',
  },
  listContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    marginRight: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '700', color: THEME.text },
  rowSub: { fontSize: 12, color: THEME.text, opacity: 0.55, marginTop: 2 },
  heartBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  heartBtnPressed: { backgroundColor: 'rgba(255,107,107,0.12)' },
  separator: { height: 1, backgroundColor: THEME.border, opacity: 0.5 },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: THEME.text, opacity: 0.4, fontSize: 15 },
});
