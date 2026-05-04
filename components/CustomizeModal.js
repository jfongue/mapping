// Modal de customisation du perso (outfit, skin, hair, hat).
import React from 'react';
import {
  StyleSheet, View, Text, ScrollView,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import { OUTFITS, SKINS, HAIRS, HAT_TYPES } from '../src/character';
import { AdventurerPreview } from './Adventurer';

const HAT_LABELS = {
  none: 'Aucun',
  cap: 'Casquette',
  hood: 'Capuche',
  wizard: 'Mage',
  plume: 'Plume',
  crown: 'Couronne',
};

export default function CustomizeModal({ profile, onChange, onClose }) {
  const outfit = profile?.outfit || 'red';
  const skin = profile?.skin || 'light';
  const hair = profile?.hair || 'brown';
  const hat = profile?.hat || 'none';

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      <View style={styles.card}>
        <Text style={styles.title}>Personnalise ton aventurier</Text>

        {/* Preview large */}
        <View style={styles.preview}>
          <AdventurerPreview outfit={outfit} skin={skin} hair={hair} hat={hat} size={140} />
        </View>

        <ScrollView style={{ maxHeight: 320 }}>
          <Section label="Tenue">
            <Row>
              {Object.keys(OUTFITS).map((k) => (
                <Swatch
                  key={k}
                  active={outfit === k}
                  color={OUTFITS[k].tunic}
                  onPress={() => onChange({ outfit: k })}
                />
              ))}
            </Row>
          </Section>

          <Section label="Carnation">
            <Row>
              {Object.keys(SKINS).map((k) => (
                <Swatch
                  key={k}
                  active={skin === k}
                  color={SKINS[k]}
                  onPress={() => onChange({ skin: k })}
                />
              ))}
            </Row>
          </Section>

          <Section label="Cheveux">
            <Row>
              {Object.keys(HAIRS).map((k) => (
                <Swatch
                  key={k}
                  active={hair === k}
                  color={HAIRS[k]}
                  onPress={() => onChange({ hair: k })}
                />
              ))}
            </Row>
          </Section>

          <Section label="Couvre-chef">
            <Row wrap>
              {HAT_TYPES.map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.hatBtn, hat === k && styles.hatBtnActive]}
                  onPress={() => onChange({ hat: k })}
                >
                  <Text style={[styles.hatBtnText, hat === k && styles.hatBtnTextActive]}>
                    {HAT_LABELS[k]}
                  </Text>
                </TouchableOpacity>
              ))}
            </Row>
          </Section>
        </ScrollView>

        <TouchableOpacity style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Section({ label, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ children, wrap }) {
  return <View style={[styles.row, wrap && styles.rowWrap]}>{children}</View>;
}

function Swatch({ color, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.swatch, { backgroundColor: color }, active && styles.swatchActive]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    width: '100%', maxWidth: 380,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', textAlign: 'center', marginBottom: 8 },
  preview: { alignItems: 'center', marginBottom: 12 },
  section: { marginBottom: 14 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowWrap: {},
  swatch: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, borderColor: 'transparent',
  },
  swatchActive: { borderColor: '#1a1a2e', transform: [{ scale: 1.12 }] },
  hatBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1, borderColor: '#ddd',
  },
  hatBtnActive: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  hatBtnText: { fontSize: 12, color: '#666', fontWeight: '600' },
  hatBtnTextActive: { color: '#fff' },
  close: {
    marginTop: 14, backgroundColor: '#ff6b6b',
    paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  closeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
