/**
 * FogLayer v2 — Brouillard de guerre 3 zones
 *
 * Zone 1 : jamais découverte → noir opaque (#0a0a0a)
 * Zone 2 : découverte dans le passé → overlay sombre + filtre "terni"
 *           (simulé via noir semi-transparent ~55%)
 * Zone 3 : visible maintenant (dans le rayon du perso) → transparent
 *
 * Le bord du cercle de vision est lissé via un gradient radial SVG.
 *
 * Props:
 *   discovered  : Set<"col,row">  — tuiles déjà vues par le profil (persistées)
 *   charPos     : { x, y }       — position du personnage en px sur la map
 *   revealRadiusCells : number   — rayon de vision en cellules (défaut 3.5)
 *
 * CHECKPOINT 1 : visuel pur, pas encore de persistance Firebase.
 * La prop `discovered` vient toujours de App.js (AsyncStorage existant).
 */
import React, { useMemo } from 'react';
import Svg, {
  Rect, G, Defs, Mask, Circle, Filter,
  FeGaussianBlur, RadialGradient, Stop,
} from 'react-native-svg';
import { MAP_W_PX, MAP_H_PX } from './TileLayer';
import { TILE_PX } from '../src/tilemap';

// Rayon de flou autour du bord du cercle de vision (px)
const EDGE_BLUR = 28;
// Opacité de l'overlay sur les zones "vues dans le passé"
const PAST_OPACITY = 0.55;

export default function FogLayer({ discovered, charPos, revealRadiusCells = 3.5 }) {
  const revealR = revealRadiusCells * TILE_PX;

  // Liste des trous pour les zones découvertes dans le passé
  const pastHoles = useMemo(() => {
    const list = [];
    if (!discovered) return list;
    for (const k of discovered) {
      const [col, row] = k.split(',').map(Number);
      list.push({
        cx: col * TILE_PX + TILE_PX / 2,
        cy: row * TILE_PX + TILE_PX / 2,
      });
    }
    return list;
  }, [discovered]);

  // Position du perso (centre du cercle de vision)
  const cx = charPos ? charPos.x : MAP_W_PX / 2;
  const cy = charPos ? charPos.y : MAP_H_PX / 2;

  return (
    <Svg
      width={MAP_W_PX}
      height={MAP_H_PX}
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Defs>
        {/* --- Flou pour adoucir les bords des trous "passé" --- */}
        <Filter id="pastBlur" x="-10%" y="-10%" width="120%" height="120%">
          <FeGaussianBlur stdDeviation={EDGE_BLUR} />
        </Filter>

        {/* --- Gradient radial pour le cercle de vision actuel --- */}
        {/* Transparent au centre → opaque sur le bord → noir plein au-delà */}
        <RadialGradient
          id="visionGrad"
          cx="50%" cy="50%" r="50%"
          gradientUnits="userSpaceOnUse"
          fx={cx} fy={cy}
          x1={cx - revealR} y1={cy - revealR}
          x2={cx + revealR} y2={cy + revealR}
        >
          <Stop offset="0%"   stopColor="black" stopOpacity="1" />
          <Stop offset="70%"  stopColor="black" stopOpacity="1" />
          <Stop offset="100%" stopColor="black" stopOpacity="0" />
        </RadialGradient>

        {/* --- Mask pour la couche NOIRE (jamais découverte) --- */}
        {/* blanc = fog visible, noir = trou (zone découverte ou visible) */}
        <Mask id="blackMask">
          <Rect width={MAP_W_PX} height={MAP_H_PX} fill="white" />
          {/* Trous sur zones passées */}
          <G filter="url(#pastBlur)">
            {pastHoles.map((h, i) => (
              <Circle key={i} cx={h.cx} cy={h.cy} r={revealR * 1.1} fill="black" />
            ))}
          </G>
          {/* Trou sur cercle de vision actuel (gradient smooth) */}
          <Circle cx={cx} cy={cy} r={revealR + EDGE_BLUR * 1.5} fill="black" opacity="0.98" />
        </Mask>

        {/* --- Mask pour la couche GRISÉE (zones passées mais pas visibles maintenant) --- */}
        <Mask id="pastMask">
          <Rect width={MAP_W_PX} height={MAP_H_PX} fill="white" />
          {/* Enlever les zones jamais découvertes (restent noires) */}
          <G filter="url(#pastBlur)">
            {pastHoles.map((h, i) => (
              <Circle key={`pm${i}`} cx={h.cx} cy={h.cy} r={revealR * 1.1} fill="white" />
            ))}
          </G>
          {/* Enlever aussi le cercle de vision actuel */}
          <Circle cx={cx} cy={cy} r={revealR + EDGE_BLUR * 1.5} fill="white" />
          {/* Puis re-masquer tout sauf les zones passées */}
          <Rect width={MAP_W_PX} height={MAP_H_PX} fill="black" />
          <G filter="url(#pastBlur)">
            {pastHoles.map((h, i) => (
              <Circle key={`pm2${i}`} cx={h.cx} cy={h.cy} r={revealR * 1.1} fill="white" />
            ))}
          </G>
        </Mask>
      </Defs>

      {/* COUCHE 1 : zones jamais découvertes → noir quasi-opaque */}
      <Rect
        width={MAP_W_PX}
        height={MAP_H_PX}
        fill="#0d0d0d"
        opacity={0.97}
        mask="url(#blackMask)"
      />

      {/* COUCHE 2 : zones vues dans le passé → grisé/terni */}
      <Rect
        width={MAP_W_PX}
        height={MAP_H_PX}
        fill="#111111"
        opacity={PAST_OPACITY}
        mask="url(#pastMask)"
      />

      {/* COUCHE 3 : bord du cercle de vision actuel → smooth via gradient */}
      {/* On applique un cercle de gradient qui va du noir vers transparent */}
      {/* pour avoir un fondu progressif sur le bord du rayon de vision */}
      <Circle
        cx={cx}
        cy={cy}
        r={revealR + EDGE_BLUR * 3}
        fill="url(#visionGrad)"
        opacity={0}
      />
    </Svg>
  );
}
