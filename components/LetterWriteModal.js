import React from 'react';
import {
  StyleSheet, View, Text, TextInput,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';

export default function LetterWriteModal({ value, setValue, onSend, onClose }) {
  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      <View style={styles.card}>
        <Text style={styles.title}>Laisser une lettre ✉️</Text>
        <Text style={styles.hint}>Elle restera ici jusqu'à ce qu'un autre joueur la lise.</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Écris ton message..."
          placeholderTextColor="#aaa"
          multiline
          maxLength={200}
          autoFocus
          style={styles.input}
        />
        <Text style={styles.count}>{(value || '').length} / 200</Text>
        <View style={styles.btns}>
          <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onClose}>
            <Text style={styles.btnText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnSend, !value?.trim() && styles.btnDisabled]}
            onPress={onSend}
            disabled={!value?.trim()}
          >
            <Text style={[styles.btnText, { color: '#fff' }]}>Déposer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 360,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', textAlign: 'center', marginBottom: 6 },
  hint: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 16 },
  input: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#1a1a2e',
    minHeight: 100, textAlignVertical: 'top',
  },
  count: { fontSize: 11, color: '#999', alignSelf: 'flex-end', marginTop: 4, marginBottom: 12 },
  btns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnCancel: { backgroundColor: '#f3f3f3' },
  btnSend: { backgroundColor: '#ff6b6b' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
});
