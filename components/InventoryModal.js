// Modal Inventaire : liste des messages ramassés, regroupés par auteur.
import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Animated,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import { ScrollText, Trash2, ChevronDown, ChevronRight } from 'lucide-react-native';
import { THEME } from '../src/theme';
import XPBar from './XPBar';

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

  // Tous les groupes repliés par défaut
  const initialCollapsed = {};
  groups.forEach((g) => { initialCollapsed[g.authorId] = true; });
  const [collapsedAuthors, setCollapsedAuthors] = useState(initialCollapsed);

  const toggleAuthor = (authorId) => {
    setCollapsedAuthors((prev) => ({ ...prev, [authorId]: !prev[authorId] }));
  };

  const openMsg = (l) => {
    setOpenId(l.id);
    if (l.unread) onMarkRead(l.id);
  };

  const total = (items || []).length;

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      <View style={styles.card}>

        {/* ── Barre XP (sans animation de gain ici) ── */}
        <XPBar totalDistancePx={totalDistancePx} />

        <Text style={styles.kicker}>MESSAGERIE</Text>
        <Text style={styles.title}>
          {total === 0 ? 'Aucun message' : `${total} message${total > 1 ? 's' : ''}`}
        </Text>

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
