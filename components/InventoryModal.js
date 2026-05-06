// Modal Inventaire : liste des messages ramassés, regroupés par auteur.
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Animated,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import { ScrollText, Trash2, ChevronDown, ChevronRight } from 'lucide-react-native';
import { THEME } from '../src/theme';

// ─── Système de niveaux ───────────────────────────────────────────────────────
// La distance est exprimée en px (vitesse 40px/s).
// On la convertit en "lieues" fantasy pour l'affichage (1 lieue = 400 px).
const PX_PER_LIEUE = 400;

const LEVELS = [
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

function getLevelInfo(totalDistancePx) {
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

// Bandeau de niveau avec barre de progression animée
function LevelBanner({ totalDistancePx }) {
  const { current, next, lieues, progress } = getLevelInfo(totalDistancePx);
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: progress,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={lvlStyles.container}>
      {/* Ligne du haut : niveau + titre + lieues */}
      <View style={lvlStyles.topRow}>
        <View style={lvlStyles.badge}>
          <Text style={lvlStyles.badgeLvl}>Niv.</Text>
          <Text style={lvlStyles.badgeNum}>{current.level}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={lvlStyles.title}>{current.title}</Text>
          <Text style={lvlStyles.sub}>
            {lieues} lieue{lieues !== 1 ? 's' : ''} parcourue{lieues !== 1 ? 's' : ''}
            {next ? ` · prochain : ${next.minLieues} lieues` : ' · Niveau max !'}
          </Text>
        </View>
        {current.level === 10 && (
          <Text style={lvlStyles.crown}>👑</Text>
        )}
      </View>

      {/* Barre de progression */}
      <View style={lvlStyles.track}>
        <Animated.View style={[lvlStyles.fill, { width: barWidth }]} />
      </View>

      {/* Étiquettes min/max */}
      {next && (
        <View style={lvlStyles.labels}>
          <Text style={lvlStyles.labelText}>{current.minLieues}</Text>
          <Text style={lvlStyles.labelText}>{next.minLieues}</Text>
        </View>
      )}
    </View>
  );
}

const lvlStyles = StyleSheet.create({
  container: {
    backgroundColor: '#f4e4bc',
    borderRadius: THEME.radiusMd,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 10,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME.accentDark,
  },
  badgeLvl: {
    fontSize: 8,
    fontWeight: '700',
    color: THEME.textOnDark,
    letterSpacing: 0.5,
    lineHeight: 10,
  },
  badgeNum: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.textOnDark,
    lineHeight: 20,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
  },
  sub: {
    fontSize: 10,
    color: THEME.textMuted,
    marginTop: 1,
  },
  crown: {
    fontSize: 20,
    marginLeft: 6,
  },
  track: {
    height: 8,
    backgroundColor: 'rgba(58,38,20,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: THEME.accent,
    borderRadius: 4,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  labelText: {
    fontSize: 9,
    color: THEME.textMuted,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (isToday) return `Aujourd'hui ${hh}:${mm}`;
  const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun',
                   'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
  return `${d.getDate()} ${months[d.getMonth()]} ${hh}:${mm}`;
};

// ─── Composant principal ──────────────────────────────────────────────────────
export default function InventoryModal({ items, totalDistancePx, onClose, onMarkRead, onDelete }) {
  const [openId, setOpenId] = useState(null);
  const [collapsedAuthors, setCollapsedAuthors] = useState({});

  const toggleAuthor = (authorId) => {
    setCollapsedAuthors((prev) => ({ ...prev, [authorId]: !prev[authorId] }));
  };

  const openMsg = (l) => {
    setOpenId(l.id);
    if (l.unread) onMarkRead(l.id);
  };

  // Regroupement par auteur
  const groupsMap = {};
  for (const l of (items || [])) {
    const key = l.authorId || 'unknown';
    if (!groupsMap[key]) {
      groupsMap[key] = {
        authorId: key,
        authorName: l.authorName || 'Anonyme',
        authorColor: l.authorColor || '#888',
        messages: [],
        lastAt: 0,
        unreadCount: 0,
      };
    }
    groupsMap[key].messages.push(l);
    if ((l.pickedAt || 0) > groupsMap[key].lastAt) groupsMap[key].lastAt = l.pickedAt || 0;
    if (l.unread) groupsMap[key].unreadCount += 1;
  }

  const groups = Object.values(groupsMap).sort((a, b) => b.lastAt - a.lastAt);
  groups.forEach((g) => {
    g.messages.sort((a, b) => (b.pickedAt || 0) - (a.pickedAt || 0));
  });

  const total = (items || []).length;

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      <View style={styles.card}>
        <Text style={styles.kicker}>MESSAGERIE</Text>
        <Text style={styles.title}>
          {total === 0 ? 'Aucun message' : `${total} message${total > 1 ? 's' : ''}`}
        </Text>

        {/* ── Bandeau niveau ── */}
        <LevelBanner totalDistancePx={totalDistancePx} />

        {total === 0 ? (
          <Text style={styles.empty}>
            Approche-toi d'un message sur la carte pour le ramasser.
          </Text>
        ) : (
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingVertical: 4 }}>
            {groups.map((group) => {
              const isCollapsed = collapsedAuthors[group.authorId];
              return (
                <View key={group.authorId} style={styles.group}>
                  <TouchableOpacity
                    style={styles.groupHeader}
                    onPress={() => toggleAuthor(group.authorId)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.authorDot, { backgroundColor: group.authorColor }]} />
                    <Text style={styles.authorName} numberOfLines={1}>
                      {group.authorName}
                    </Text>
                    {group.unreadCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{group.unreadCount}</Text>
                      </View>
                    )}
                    <Text style={styles.groupCount}>
                      {group.messages.length} lettre{group.messages.length > 1 ? 's' : ''}
                    </Text>
                    {isCollapsed
                      ? <ChevronRight size={16} color={THEME.textMuted} strokeWidth={2.2} />
                      : <ChevronDown size={16} color={THEME.textMuted} strokeWidth={2.2} />
                    }
                  </TouchableOpacity>

                  {!isCollapsed && group.messages.map((l) => {
                    const isOpen = openId === l.id;
                    return (
                      <View key={l.id} style={styles.item}>
                        <TouchableOpacity style={styles.itemHead} onPress={() => openMsg(l)} activeOpacity={0.7}>
                          <View style={styles.itemIcon}>
                            <ScrollText size={18} color={THEME.text} strokeWidth={2.2} />
                            {l.unread && <View style={styles.unreadDot} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.metaRow}>
                              <Text style={styles.dateText}>{formatDate(l.pickedAt)}</Text>
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
                            <Trash2 size={15} color={THEME.danger} strokeWidth={2.2} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                        {isOpen && (
                          <Text style={styles.body}>{l.text}</Text>
                        )}
                      </View>
                    );
                  })}
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
  group: { marginBottom: 10 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, paddingHorizontal: 10,
    backgroundColor: '#f4e4bc',
    borderRadius: THEME.radiusMd,
    borderWidth: 1, borderColor: THEME.border,
  },
  authorDot: { width: 12, height: 12, borderRadius: 6 },
  authorName: { flex: 1, fontSize: 13, fontWeight: '700', color: THEME.text },
  badge: {
    backgroundColor: THEME.danger,
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  groupCount: { fontSize: 11, color: THEME.textMuted, marginRight: 2 },
  item: {
    borderWidth: 1, borderColor: THEME.borderSoft,
    borderRadius: THEME.radiusMd,
    backgroundColor: '#fffef0',
    marginTop: 5, marginLeft: 14, padding: 10,
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#f4e4bc',
    borderWidth: 1, borderColor: THEME.borderSoft,
    justifyContent: 'center', alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute', top: -2, right: -2,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: THEME.danger,
    borderWidth: 1.5, borderColor: THEME.card,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 11, color: THEME.textMuted, fontStyle: 'italic' },
  preview: { fontSize: 12, color: THEME.textMuted, marginTop: 2 },
  body: {
    fontSize: 14, color: THEME.text, fontStyle: 'italic',
    lineHeight: 20, marginTop: 8, paddingLeft: 38,
  },
  deleteBtn: { padding: 4 },
  close: {
    marginTop: 12, backgroundColor: THEME.accent,
    paddingVertical: 12, borderRadius: THEME.radiusMd, alignItems: 'center',
  },
  closeText: { color: THEME.textOnDark, fontSize: 15, fontWeight: '700' },
});
