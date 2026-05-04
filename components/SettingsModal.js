// Modal réglages : pseudo, couleur, toggle debug.
import React from 'react';
import {
  StyleSheet, View, Text, TextInput,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import { PLAYER_COLORS } from '../src/constants';

export default function SettingsModal({
  profile, draftName, setDraftName,
  onColorChange, debugEnabled, onToggleDebug,
  onClose, onValidateName,
}) {
  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={() => { onValidateName(); onClose(); }}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      <View style={styles.card}>
        <Text style={styles.title}>Réglages</Text>

        <Text style={styles.label}>Pseudo</Text>
        <TextInput
          value={draftName}
          onChangeText={setDraftName}
          onBlur={onValidateName}
          placeholder="Ton pseudo"
          placeholderTextColor="#aaa"
          maxLength={16}
          style={styles.input}
        />

        <Text style={styles.label}>Couleur</Text>
        <View style={styles.colorGrid}>
          {PLAYER_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.swatch,
                { backgroundColor: c },
                profile?.color === c && styles.swatchActive,
              ]}
              onPress={() => onColorChange(c)}
            />
          ))}
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Mode debug (boost vitesse)</Text>
          <TouchableOpacity
            onPress={onToggleDebug}
            style={[styles.toggle, debugEnabled && styles.toggleOn]}
          >
            <View style={[styles.knob, debugEnabled && styles.knobOn]} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.close}
          onPress={() => { onValidateName(); onClose(); }}
        >
          <Text style={styles.closeText}>OK</Text>
        </TouchableOpacity>
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
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 18, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 15, color: '#1a1a2e', marginBottom: 8,
  },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: '#1a1a2e', transform: [{ scale: 1.1 }] },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingVertical: 6,
  },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#ddd', padding: 2 },
  toggleOn: { backgroundColor: '#5dca8b' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  knobOn: { transform: [{ translateX: 18 }] },
  close: {
    marginTop: 12, backgroundColor: '#ff6b6b',
    paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  closeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
