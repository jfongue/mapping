// Bandeaux UI style parchemin (POC Fantasy) :
// - ConfirmationBar : avant départ (distance + durée + Annuler/Partir)
// - TravelingBar : pendant le voyage (timer + Stop)
//   → gère son propre setInterval, ne dépend plus de `now` dans App
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { formatMeters, formatDuration } from '../src/format';

export function ConfirmationBar({ distancePx, durationSec, destLabel, onConfirm, onCancel }) {
  return (
    <View style={[styles.bar, { flexDirection: 'column' }]}>
      <View style={styles.body}>
        <Text style={styles.kicker}>VOYAGE VERS</Text>
        <Text style={styles.dest}>{destLabel}</Text>
        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statLabel}>DISTANCE</Text>
            <Text style={styles.statValue}>{formatMeters(distancePx)}</Text>
          </View>
          <View>
            <Text style={styles.statLabel}>DURÉE EST.</Text>
            <Text style={styles.statValue}>{formatDuration(durationSec)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onCancel}>
          <Text style={styles.btnCancelText}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnGo]} onPress={onConfirm}>
          <Text style={styles.btnGoText}>⚐  Partir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// TravelingBar gère son propre tick — App ne fait plus setNow toutes les 250ms
export function TravelingBar({ eta, onStop }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((eta - Date.now()) / 1000)));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((eta - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [eta]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const label = `${mm}:${ss}`;

  return (
    <View style={styles.bar}>
      <View style={[styles.body, { flex: 1 }]}>
        <Text style={styles.kicker}>EN ROUTE</Text>
        <Text style={styles.timer}>{label}</Text>
      </View>
      {onStop && (
        <TouchableOpacity style={styles.stopBtn} onPress={onStop}>
          <Text style={styles.stopText}>⏸  Stop</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 50, left: 12, right: 12,
    backgroundColor: 'rgba(255,251,232,0.96)',
    borderWidth: 1.5, borderColor: '#3a2614',
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  kicker: {
    fontSize: 10, letterSpacing: 1.2,
    opacity: 0.6, fontWeight: '700', color: '#3a2614',
  },
  dest: {
    fontSize: 18, fontWeight: '700', color: '#3a2614', marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row', gap: 24, marginTop: 8,
  },
  statLabel: {
    fontSize: 10, opacity: 0.6, letterSpacing: 0.5,
    color: '#3a2614', fontWeight: '700',
  },
  statValue: { fontSize: 14, fontWeight: '700', color: '#3a2614', marginTop: 2 },
  timer: {
    fontSize: 22, fontWeight: '700', color: '#3a2614',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: 'rgba(58,38,20,0.2)',
  },
  btn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnCancel: {
    backgroundColor: 'transparent',
    borderRightWidth: 1, borderRightColor: 'rgba(58,38,20,0.2)',
  },
  btnCancelText: { fontSize: 14, color: '#3a2614' },
  btnGo: { flex: 1.4, backgroundColor: '#3a7ea8' },
  btnGoText: { fontSize: 14, color: '#fffbe8', fontWeight: '700' },
  stopBtn: {
    backgroundColor: '#3a2614',
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  stopText: { color: '#fffbe8', fontSize: 13, fontWeight: '700' },
});