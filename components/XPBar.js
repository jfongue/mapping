// XPBar — affichage de la distance marchée en mètres.
// Props:
//   totalDistancePx   : distance cumulée totale (persistée)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../src/theme';

// ─── Constantes niveau ────────────────────────────────────────────────────────
export const PX_PER_LIEUE = 400;

export const LEVELS = [
  { level: 1,  title: 'Novice',          minLieues: 0    },
  { level: 2,  title: 'Marcheur',        minLieues: 5    },
  { level: 3,  title: 'Explorateur',     minLieues: 15   },
  { level: 4,  title: 'Aventurier',      minLieues: 35   },
  { level: 5,  title: 'Éclaireur',       minLieues: 70   },
  { level: 6,  title: 'Ranger',          minLieues: 120  },
  { level: 7,  title: 'Cartographe',     minLieues: 200  },
  { level: 8,  title: 'Pionnier',        minLieues: 320  },
  { level: 9,  title: 'Légende',         minLieues: 500  },
  { level: 10, title: 'Maître du Monde', minLieues: 750  },
];

export function getLevelInfo(totalDistancePx) {
  const lieues = (totalDistancePx || 0) / PX_PER_LIEUE;
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (lieues >= LEVELS[i].minLieues) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
      break;
    }
  }
  const progress = next
    ? (lieues - current.minLieues) / (next.minLieues - current.minLieues)
    : 1;
  return { current, next, lieues: Math.floor(lieues), progress: Math.min(1, Math.max(0, progress)) };
}

// ─── Composant ────────────────────────────────────────────────────────────────
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
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 10,
    marginBottom: 10,
  },
  distanceText: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.text,
    textAlign: 'center',
  },
});
