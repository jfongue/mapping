import React from 'react';
import {
  StyleSheet, View, Text,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';

export default function LetterReadModal({ letter, onClose }) {
  if (!letter) return null;
  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={[styles.dot, { backgroundColor: letter.authorColor || '#888' }]} />
          <Text style={styles.author}>{letter.authorName || 'Anonyme'}</Text>
        </View>
        <Text style={styles.body}>{letter.text}</Text>
        <Text style={styles.warning}>⚠️ Cette lettre va disparaître à la fermeture.</Text>
        <TouchableOpacity style={styles.btn} onPress={onClose}>
          <Text style={styles.btnText}>J'ai lu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#fffef5',
    borderRadius: 14, padding: 24,
    width: '100%', maxWidth: 340,
    borderWidth: 1, borderColor: '#e8d8a8',
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: 8 },
  author: { fontSize: 14, fontWeight: '700', color: '#5a4a1c' },
  body: {
    fontSize: 16, color: '#3d3219', lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 18,
  },
  warning: { fontSize: 11, color: '#a08020', textAlign: 'center', marginBottom: 14 },
  btn: {
    backgroundColor: '#a08020',
    paddingVertical: 12, borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
