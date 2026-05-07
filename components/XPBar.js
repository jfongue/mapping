// XPBar — distance marché simple
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../src/theme';
export default function XPBar({ totalDistancePx }) {
  const metres = Math.round(totalDistancePx || 0);
  return (
    <View style={styles.container}>
      <Text style={styles.distanceText}>{metres} m marché</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f4e4bc',
    borderRadius: THEME.radiusMd,
    borderWidth: 1, borderColor: THEME.border,
    padding: 10, marginBottom: 10,
  },
  distanceText: {
    fontSize: 18, fontWeight: '800', color: THEME.text,
    textAlign: 'center',
  },
});
