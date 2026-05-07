// Modal réglages : pseudo, outfit/skin/hair/hat, debug.
import React from 'react';
import {
  StyleSheet, View, Text, TextInput, ScrollView,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import { OUTFITS, SKINS, HAIRS, HAT_TYPES } from '../src/character';
import { AdventurerPreview } from './Adventurer';
import { THEME } from '../src/theme';

const HAT_LABELS = {
  none: 'Aucun',
  cap: 'Casquette',
  hood: 'Capuche',
  wizard: 'Mage',
  plume: 'Plume',
  crown: 'Couronne',
};

export default function SettingsModal({
  profile, draftName, setDraftName,
  onPatch, debugEnabled, onToggleDebug,
  onClose, onValidateName,
  onDebugGenerateMessage,
  onDebugSpeedPressIn,
  onDebugSpeedPressOut,
  debugSpeedMul,
  // Sillons debug
  onDebugBoostSillons,
  onDebugFastErosion,
  onDebugResetSillons,
  onDebugSuperSillon,
  sillonsStats,
  showPathLayer,
  onTogglePathLayer,
}) {
  const outfit = profile?.outfit || 'red';
  const skin = profile?.skin || 'light';
  const hair = profile?.hair || 'brown';
  const hat = profile?.hat || 'none';

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={() => { onValidateName(); onClose(); }}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      <View style={styles.card}>
        <Text style={styles.title}>Réglages</Text>

        <View style={styles.preview}>
          <AdventurerPreview outfit={outfit} skin={skin} hair={hair} hat={hat} size={120} />
        </View>

        <ScrollView style={{ maxHeight: 420 }}>
          <Section label="Pseudo">
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              onBlur={onValidateName}
              placeholder="Ton pseudo"
              placeholderTextColor="#aaa"
              maxLength={16}
              style={styles.input}
            />
          </Section>

          <Section label="Tenue">
            <Row>
              {Object.keys(OUTFITS).map((k) => (
                <Swatch
                  key={k}
                  active={outfit === k}
                  color={OUTFITS[k].tunic}
                  onPress={() => onPatch({ outfit: k })}
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
                  onPress={() => onPatch({ skin: k })}
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
                  onPress={() => onPatch({ hair: k })}
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
                  onPress={() => onPatch({ hat: k })}
                >
                  <Text style={[styles.hatBtnText, hat === k && styles.hatBtnTextActive]}>
                    {HAT_LABELS[k]}
                  </Text>
                </TouchableOpacity>
              ))}
            </Row>
          </Section>

          {/* Toggle debug */}
          <View style={styles.row}>
            <Text style={styles.label}>Mode debug</Text>
            <TouchableOpacity
              onPress={onToggleDebug}
              style={[styles.toggle, debugEnabled && styles.toggleOn]}
            >
              <View style={[styles.knob, debugEnabled && styles.knobOn]} />
            </TouchableOpacity>
          </View>

          {/* Section debug */}
          {debugEnabled && (
            <View style={styles.debugSection}>
              <Text style={styles.debugSectionLabel}>Actions debug</Text>

              {/* Accélération */}
              <TouchableOpacity
                style={[
                  styles.debugActionBtn,
                  debugSpeedMul > 1 && styles.debugActionBtnActive,
                ]}
                onPressIn={onDebugSpeedPressIn}
                onPressOut={onDebugSpeedPressOut}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.debugActionText,
                  debugSpeedMul > 1 && styles.debugActionTextActive,
                ]}>
                  ⏩ Accélération{debugSpeedMul > 1 ? ` ×${debugSpeedMul}` : ''}
                </Text>
                <Text style={styles.debugActionHint}>Maintenir pour accélérer</Text>
              </TouchableOpacity>

              {/* Générer un message */}
              {onDebugGenerateMessage && (
                <TouchableOpacity
                  style={styles.debugActionBtn}
                  onPress={onDebugGenerateMessage}
                  activeOpacity={0.75}
                >
                  <Text style={styles.debugActionText}>📜 Générer un message au sol</Text>
                </TouchableOpacity>
              )}

              {/* ─── SILLONS ─── */}
              <Text style={[styles.debugSectionLabel, { marginTop: 10 }]}>Sillons</Text>

              {/* Stats */}
              {sillonsStats && (
                <View style={styles.debugStatsBox}>
                  <Text style={styles.debugStatsText}>
                    {`Total: ${sillonsStats.total} tiles · max ${sillonsStats.maxCount}`}
                  </Text>
                </View>
              )}

              {/* Toggle PathLayer */}
              <View style={[styles.row, { marginTop: 4 }]}>
                <Text style={styles.label}>Afficher les sillons</Text>
                <TouchableOpacity
                  onPress={onTogglePathLayer}
                  style={[styles.toggle, showPathLayer && styles.toggleOn]}
                >
                  <View style={[styles.knob, showPathLayer && styles.knobOn]} />
                </TouchableOpacity>
              </View>

              {/* Boost zone */}
              {onDebugBoostSillons && (
                <TouchableOpacity
                  style={styles.debugActionBtn}
                  onPress={onDebugBoostSillons}
                  activeOpacity={0.75}
                >
                  <Text style={styles.debugActionText}>🌿 Boost zone (r=5, +50)</Text>
                  <Text style={styles.debugActionHint}>Crée des sillons autour de ta position</Text>
                </TouchableOpacity>
              )}

              {/* Super Sillon x50 — 5min érosion */}
              {onDebugSuperSillon && (
                <TouchableOpacity
                  style={[styles.debugActionBtn, styles.debugActionBtnSuper]}
                  onPress={onDebugSuperSillon}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.debugActionText, styles.debugActionTextSuper]}>🚀 Super Sillon ×50</Text>
                  <Text style={styles.debugActionHint}>+50 passages sur ta case · disparaît en 5min</Text>
                </TouchableOpacity>
              )}

              {/* Érosion rapide 7j */}
              {onDebugFastErosion && (
                <TouchableOpacity
                  style={styles.debugActionBtn}
                  onPress={onDebugFastErosion}
                  activeOpacity={0.75}
                >
                  <Text style={styles.debugActionText}>⏳ Simuler 7 jours d'érosion</Text>
                  <Text style={styles.debugActionHint}>Fait repousser la végétation</Text>
                </TouchableOpacity>
              )}

              {/* Reset */}
              {onDebugResetSillons && (
                <TouchableOpacity
                  style={[styles.debugActionBtn, styles.debugActionBtnDanger]}
                  onPress={onDebugResetSillons}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.debugActionText, styles.debugActionTextDanger]}>🗑 Reset tous les sillons</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>

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

function Section({ label, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ children, wrap }) {
  return <View style={[styles.rowList, wrap && styles.rowWrap]}>{children}</View>;
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
  title: {
    fontSize: 18, fontWeight: '700',
    color: THEME.text, textAlign: 'center', marginBottom: 8,
  },
  preview: { alignItems: 'center', marginBottom: 12 },
  section: { marginBottom: 14 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700',
    color: THEME.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 8,
  },
  rowList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowWrap: {},
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8, paddingVertical: 6,
  },
  label: { fontSize: 13, fontWeight: '700', color: THEME.text },
  input: {
    borderWidth: 1.5, borderColor: THEME.borderSoft,
    backgroundColor: '#fffef0',
    borderRadius: THEME.radiusMd,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 15, color: THEME.text,
  },
  swatch: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, borderColor: 'transparent',
  },
  swatchActive: { borderColor: THEME.text, transform: [{ scale: 1.12 }] },
  hatBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1, borderColor: THEME.borderSoft,
    backgroundColor: 'transparent',
  },
  hatBtnActive: { backgroundColor: THEME.text, borderColor: THEME.text },
  hatBtnText: { fontSize: 12, color: THEME.textMuted, fontWeight: '700' },
  hatBtnTextActive: { color: THEME.textOnDark },
  toggle: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: THEME.borderSoft, padding: 2,
  },
  toggleOn: { backgroundColor: THEME.accent },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: THEME.cardSolid },
  knobOn: { transform: [{ translateX: 18 }] },
  close: {
    marginTop: 14, backgroundColor: THEME.accent,
    paddingVertical: 12, borderRadius: THEME.radiusMd, alignItems: 'center',
  },
  closeText: { color: THEME.textOnDark, fontSize: 15, fontWeight: '700' },
  debugSection: {
    marginTop: 10,
    borderTopWidth: 1, borderTopColor: THEME.borderSoft,
    paddingTop: 12,
    gap: 8,
  },
  debugSectionLabel: {
    fontSize: 11, fontWeight: '700',
    color: THEME.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 4,
  },
  debugActionBtn: {
    backgroundColor: 'rgba(139,69,19,0.10)',
    borderWidth: 1.5, borderColor: '#8b4513',
    borderRadius: THEME.radiusMd,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  debugActionBtnActive: {
    backgroundColor: '#ff6b6b',
    borderColor: '#ff6b6b',
  },
  debugActionBtnSuper: {
    backgroundColor: 'rgba(58,126,168,0.12)',
    borderColor: '#3a7ea8',
  },
  debugActionBtnDanger: {
    backgroundColor: 'rgba(220,50,50,0.08)',
    borderColor: '#dc3232',
  },
  debugActionText: { color: '#8b4513', fontSize: 13, fontWeight: '700' },
  debugActionTextActive: { color: '#fff' },
  debugActionTextSuper: { color: '#3a7ea8' },
  debugActionTextDanger: { color: '#dc3232' },
  debugActionHint: { color: THEME.textMuted, fontSize: 10, marginTop: 2 },
  debugStatsBox: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  debugStatsText: { color: THEME.textMuted, fontSize: 11, fontWeight: '600' },
});
