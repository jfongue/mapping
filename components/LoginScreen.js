// Écran de connexion — liste de profils ou création d'un nouveau.
import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView,
  TouchableOpacity, TextInput, Modal,
  TouchableWithoutFeedback, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME } from '../src/theme';
import { generateProfile, randomName, randomColor } from '../src/profile';
import { AdventurerPreview } from './Adventurer';
import { TOP_SAFE } from '../src/constants';

const PROFILES_LIST_KEY = '@treasureProto.profilesList.v1';

// Sauvegarde / charge la liste de tous les profils créés sur cet appareil.
export async function loadAllProfiles() {
  try {
    const raw = await AsyncStorage.getItem(PROFILES_LIST_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export async function saveAllProfiles(list) {
  try {
    await AsyncStorage.setItem(PROFILES_LIST_KEY, JSON.stringify(list));
  } catch (e) {}
}

export default function LoginScreen({ onLogin }) {
  const [profiles, setProfiles] = useState(null); // null = loading
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadAllProfiles().then(setProfiles);
  }, []);

  const handleLogin = async (profile) => {
    // Met à jour la liste (upsert) et connecte.
    setProfiles((prev) => {
      const list = prev || [];
      const exists = list.find((p) => p.id === profile.id);
      const next = exists
        ? list.map((p) => (p.id === profile.id ? profile : p))
        : [...list, profile];
      saveAllProfiles(next);
      return next;
    });
    onLogin(profile);
  };

  const handleCreate = async () => {
    const trimmed = newName.trim().slice(0, 16);
    const p = generateProfile();
    if (trimmed) p.name = trimmed;
    setCreateOpen(false);
    setNewName('');
    // Ajoute à la liste
    const prev = profiles || [];
    const next = [...prev, p];
    setProfiles(next);
    await saveAllProfiles(next);
    handleLogin(p);
  };

  if (profiles === null) {
    return (
      <View style={styles.root}>
        <ActivityIndicator size="large" color={THEME.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.logoText}>⚔️ Treasure Quest</Text>
        <Text style={styles.subtitle}>Qui part à l'aventure ?</Text>
      </View>

      {/* Liste de profils */}
      <View style={styles.card}>
        {profiles.length === 0 ? (
          <Text style={styles.empty}>Aucun profil existant.{`\n`}Crée ton premier aventurier !</Text>
        ) : (
          <ScrollView
            style={{ maxHeight: 320 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {profiles.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.profileRow}
                onPress={() => handleLogin(p)}
                activeOpacity={0.75}
              >
                <AdventurerPreview
                  outfit={p.outfit || 'red'}
                  skin={p.skin || 'light'}
                  hair={p.hair || 'brown'}
                  hat={p.hat || 'none'}
                  size={48}
                />
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{p.name || 'Aventurier'}</Text>
                  <View style={[styles.colorDot, { backgroundColor: p.color || '#888' }]} />
                </View>
                <Text style={styles.profileArrow}>▶</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Bouton créer nouveau profil */}
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => { setNewName(randomName()); setCreateOpen(true); }}
          activeOpacity={0.8}
        >
          <Text style={styles.createBtnText}>+ Nouveau profil</Text>
        </TouchableOpacity>
      </View>

      {/* Modal : nom du nouveau profil */}
      <Modal
        visible={createOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCreateOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Nouvel aventurier</Text>
                <Text style={styles.modalLabel}>Pseudo (optionnel)</Text>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Ex : Faucon 42"
                  placeholderTextColor={THEME.textMuted}
                  maxLength={16}
                  style={styles.modalInput}
                  autoFocus
                  onSubmitEditing={handleCreate}
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setCreateOpen(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalCancelText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalConfirmBtn}
                    onPress={handleCreate}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalConfirmText}>Créer !</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: TOP_SAFE,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.textOnDark,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,251,232,0.65)',
  },
  card: {
    backgroundColor: THEME.card,
    borderWidth: 1.5,
    borderColor: THEME.border,
    borderRadius: THEME.radiusLg,
    paddingHorizontal: 16,
    paddingVertical: 18,
    width: '100%',
    maxWidth: 360,
    ...THEME.shadow,
  },
  empty: {
    color: THEME.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardSolid,
    borderRadius: THEME.radiusMd,
    borderWidth: 1.5,
    borderColor: THEME.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.text,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: THEME.borderSoft,
  },
  profileArrow: {
    fontSize: 14,
    color: THEME.textMuted,
    fontWeight: '700',
  },
  createBtn: {
    marginTop: 14,
    backgroundColor: THEME.accent,
    paddingVertical: 13,
    borderRadius: THEME.radiusMd,
    alignItems: 'center',
  },
  createBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  // Modal création
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: THEME.card,
    borderWidth: 1.5,
    borderColor: THEME.border,
    borderRadius: THEME.radiusLg,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    ...THEME.shadow,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: THEME.borderSoft,
    backgroundColor: '#fffef0',
    borderRadius: THEME.radiusMd,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: THEME.text,
    marginBottom: 18,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: THEME.radiusMd,
    borderWidth: 1.5,
    borderColor: THEME.borderSoft,
    alignItems: 'center',
  },
  modalCancelText: {
    color: THEME.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: THEME.radiusMd,
    backgroundColor: THEME.accent,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
