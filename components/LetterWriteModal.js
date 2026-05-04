import React from 'react';
import {
  StyleSheet, View, Text, TextInput,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import { THEME } from '../src/theme';

export default function LetterWriteModal({ value, setValue, onSend, onClose }) {
  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      <View style={styles.card}>
        <Text style={styles.kicker}>LAISSER UNE LETTRE</Text>
        <Text style={styles.hint}>Elle restera ici jusqu'à ce qu'un autre joueur la lise.</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Écris ton message..."
          placeholderTextColor={THEME.textMuted}
          multiline
          maxLength={200}
          autoFocus
          style={styles.input}
        />
        <Text style={styles.count}>{(value || '').length} / 200</Text>
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onClose}>
            <Text style={styles.btnCancelText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnGo, !value?.trim() && styles.btnDisabled]}
            onPress={onSend}
            disabled={!value?.trim()}
          >
            <Text style={styles.btnGoText}>⚐  Déposer</Text>
          </TouchableOpacity>
        </View>
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
    borderWidth: 1.5, borderColor: THEME.border,
    borderRadius: THEME.radiusLg, padding: 18,
    width: '100%', maxWidth: 380,
    ...THEME.shadow,
  },
  kicker: {
    fontSize: 11, letterSpacing: 1.2,
    fontWeight: '700', color: THEME.textMuted,
    textAlign: 'center',
  },
  hint: { fontSize: 12, color: THEME.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  input: {
    borderWidth: 1.5, borderColor: THEME.borderSoft,
    backgroundColor: '#fffef0',
    borderRadius: THEME.radiusMd,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: THEME.text,
    minHeight: 100, textAlignVertical: 'top',
  },
  count: {
    fontSize: 11, color: THEME.textMuted,
    alignSelf: 'flex-end', marginTop: 4, marginBottom: 12,
  },
  btnRow: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: THEME.borderSoft,
    marginHorizontal: -18, marginBottom: -18,
    marginTop: 8,
  },
  btn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnCancel: {
    borderRightWidth: 1, borderRightColor: THEME.borderSoft,
  },
  btnCancelText: { fontSize: 14, color: THEME.text },
  btnGo: { flex: 1.4, backgroundColor: THEME.accent },
  btnGoText: { fontSize: 14, color: THEME.textOnDark, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
});
