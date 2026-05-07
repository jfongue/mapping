// Modal pleine écran listant tous les joueurs connectés avec boutons cœur.
import React, { useMemo } from 'react';
import {
  Modal, View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { Heart, X } from 'lucide-react-native';
import { THEME } from '../src/theme';

const ITEM_HEIGHT = 64;

function HeartButton({ followed, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={styles.heartBtn}
    >
      <Heart
        size={22}
        color={followed ? '#ff6b6b' : '#aaa'}
        fill={followed ? '#ff6b6b' : 'none'}
        strokeWidth={2.2}
      />
    </TouchableOpacity>
  );
}

function PlayerItem({ player, isFollowed, myPos, onToggleFollow }) {
  const dist = myPos
    ? Math.round(Math.hypot(player.x - myPos.x, player.y - myPos.y))
    : null;
  const followed = isFollowed(player.id);

  return (
    <View style={styles.item}>
      <View style={[styles.avatar, { backgroundColor: player.color || '#888' }]} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{player.name || player.id}</Text>
        <Text style={styles.pos}>
          {Math.round(player.x)}, {Math.round(player.y)}
          {dist !== null ? `  ·  ${dist} px` : ''}
        </Text>
      </View>
      <HeartButton followed={followed} onPress={() => onToggleFollow(player)} />
    </View>
  );
}

export default function OnlinePlayersModal({ visible, onClose, players, isFollowed, onToggleFollow, myPos }) {
  const sortedPlayers = useMemo(() => {
    if (!myPos) return players;
    return [...players].sort((a, b) => {
      const da = Math.hypot(a.x - myPos.x, a.y - myPos.y);
      const db = Math.hypot(b.x - myPos.x, b.y - myPos.y);
      return da - db;
    });
  }, [players, myPos]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Joueurs en ligne ({players.length})</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={22} color={THEME.text} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={sortedPlayers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PlayerItem
              player={item}
              isFollowed={isFollowed}
              myPos={myPos}
              onToggleFollow={onToggleFollow}
            />
          )}
          getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
          ListEmptyComponent={
            <Text style={styles.empty}>Aucun joueur en ligne pour l'instant.</Text>
          }
          contentContainerStyle={sortedPlayers.length === 0 ? { flex: 1 } : null}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg || '#1a1a2e' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: THEME.border,
    backgroundColor: THEME.card,
  },
  title: { color: THEME.text, fontSize: 17, fontWeight: '800' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  item: {
    flexDirection: 'row', alignItems: 'center',
    height: ITEM_HEIGHT, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.border,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    marginRight: 12,
  },
  info: { flex: 1 },
  name: { color: THEME.text, fontSize: 14, fontWeight: '700' },
  pos: { color: THEME.text, fontSize: 11, opacity: 0.55, marginTop: 2 },
  heartBtn: {
    width: 44, height: 44,
    justifyContent: 'center', alignItems: 'center',
  },
  empty: {
    flex: 1, textAlign: 'center', color: THEME.text,
    opacity: 0.4, marginTop: 60, fontSize: 14,
  },
});
