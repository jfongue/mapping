/**
 * FogOfWar.js
 *
 * Overlay brouillard de guerre pour MapView géographique.
 *
 * Props:
 *  - playerScreenPos : { x, y }   position du joueur en pixels écran (absolu)
 *  - screenWidth     : number     largeur de l'écran
 *  - screenHeight    : number     hauteur de l'écran
 *  - visibilityRadius: number     rayon du cercle de visibilité en pixels écran (défaut 150)
 *  - discoveredCircles: Array<{x,y}> centres (pixels écran) des zones déjà découvertes
 *
 * Comportement :
 *  - Tout est recouvert d'un voile noir/sombre
 *  - Autour du joueur : cercle visible avec bord smooth (gradient radial)
 *  - Zones déjà découvertes : overlay gris semi-transparent (terni, pas entièrement noir)
 *  - feGaussianBlur sur le mask pour adoucir toutes les transitions
 */

import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Mask,
  G,
  Filter,
  FeGaussianBlur,
} from 'react-native-svg';

// Rayon du flou de bord (px) — plus grand = transition plus douce
const EDGE_BLUR = 18;

// Opacité du voile sur les zones déjà découvertes (0 = invisible, 1 = noir)
const DISCOVERED_OVERLAY_OPACITY = 0.42;

// Opacité du voile sur les zones jamais vues
const FOG_OPACITY = 0.82;

export default function FogOfWar({
  playerScreenPos,
  screenWidth,
  screenHeight,
  visibilityRadius = 150,
  discoveredCircles = [],
}) {
  // Si pas encore de position joueur, on couvre tout
  const hasPlayer = playerScreenPos != null;

  // -----------------------------------------------------------------------
  // 1. Masque principal : trou circulaire lisse autour du joueur
  //    Fond blanc (= fog appliqué), cercle noir (= trou = visible)
  // -----------------------------------------------------------------------
  const playerMask = useMemo(() => {
    if (!hasPlayer) return null;
    const { x, y } = playerScreenPos;
    return { cx: x, cy: y, r: visibilityRadius };
  }, [playerScreenPos, visibilityRadius, hasPlayer]);

  // -----------------------------------------------------------------------
  // 2. Masque secondaire pour les zones découvertes (hors cercle actuel)
  //    On applique un overlay gris semi-transparent uniquement sur ces zones.
  // -----------------------------------------------------------------------
  const discoveredMask = useMemo(() => {
    return discoveredCircles.map((pos, i) => ({
      key: i,
      cx: pos.x,
      cy: pos.y,
      r: pos.r ?? visibilityRadius,
    }));
  }, [discoveredCircles, visibilityRadius]);

  return (
    <Svg
      width={screenWidth}
      height={screenHeight}
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
    >
      <Defs>
        {/* ---- Flou pour adoucir les bords du masque ---- */}
        <Filter id="edgeBlur" x="-20%" y="-20%" width="140%" height="140%">
          <FeGaussianBlur stdDeviation={EDGE_BLUR} />
        </Filter>

        {/* ---- Gradient radial pour le halo du joueur ---- */}
        {/*
          Le gradient va du centre (opaque 0 = visible) vers l'extérieur (opaque 1 = fog).
          Utilisé dans le masque principal (valeurs de gris : blanc bloque le fog, noir = trou).
        */}
        <RadialGradient
          id="playerGradient"
          cx="50%" cy="50%"
          rx="50%" ry="50%"
          fx="50%" fy="50%"
        >
          {/* Centre : noir = trou dans le fog (visible) */}
          <Stop offset="0%"   stopColor="black" stopOpacity="1" />
          {/* 60% du rayon : encore bien visible */}
          <Stop offset="60%"  stopColor="black" stopOpacity="1" />
          {/* Transition douce vers le bord */}
          <Stop offset="80%"  stopColor="black" stopOpacity="0.5" />
          {/* Bord : blanc = fog appliqué */}
          <Stop offset="100%" stopColor="white" stopOpacity="1" />
        </RadialGradient>

        {/* ---- Masque principal (fog global) ---- */}
        <Mask id="fogMask">
          {/* Fond blanc = tout est dans le fog par défaut */}
          <Rect x="0" y="0" width={screenWidth} height={screenHeight} fill="white" />

          {/* Trou circulaire lisse autour du joueur */}
          {playerMask && (
            <Circle
              cx={playerMask.cx}
              cy={playerMask.cy}
              r={playerMask.r}
              fill="url(#playerGradient)"
              filter="url(#edgeBlur)"
            />
          )}
        </Mask>

        {/* ---- Masque pour overlay découvert ---- */}
        <Mask id="discoveredMask">
          {/* Fond noir = overlay découvert masqué par défaut */}
          <Rect x="0" y="0" width={screenWidth} height={screenHeight} fill="black" />

          {/* On révèle (blanc) les zones découvertes */}
          <G filter="url(#edgeBlur)">
            {discoveredMask.map((d) => (
              <Circle
                key={d.key}
                cx={d.cx}
                cy={d.cy}
                r={d.r}
                fill="white"
              />
            ))}
          </G>

          {/* On re-masque (noir) la zone courante du joueur pour ne pas doubler */}
          {playerMask && (
            <Circle
              cx={playerMask.cx}
              cy={playerMask.cy}
              r={playerMask.r * 0.65}
              fill="black"
              filter="url(#edgeBlur)"
            />
          )}
        </Mask>
      </Defs>

      {/* ==================================================================
          COUCHE 1 : overlay gris sur les zones déjà découvertes
          (visible uniquement via discoveredMask)
      ================================================================== */}
      {discoveredMask.length > 0 && (
        <Rect
          x="0" y="0"
          width={screenWidth}
          height={screenHeight}
          fill="#1a1a2e"
          opacity={DISCOVERED_OVERLAY_OPACITY}
          mask="url(#discoveredMask)"
        />
      )}

      {/* ==================================================================
          COUCHE 2 : brouillard principal (noir opaque sur tout)
          (percé par fogMask autour du joueur)
      ================================================================== */}
      <Rect
        x="0" y="0"
        width={screenWidth}
        height={screenHeight}
        fill="#0d0d1a"
        opacity={FOG_OPACITY}
        mask="url(#fogMask)"
      />
    </Svg>
  );
}

/**
 * USAGE dans App.js :
 *
 * import FogOfWar from './components/FogOfWar';
 * import { useWindowDimensions } from 'react-native';
 *
 * const { width, height } = useWindowDimensions();
 *
 * // Convertir la position GPS du joueur en coordonnées écran via mapRef :
 * const [playerScreenPos, setPlayerScreenPos] = useState(null);
 *
 * const updateFogPosition = async () => {
 *   if (!mapRef.current || !userLocation) return;
 *   const point = await mapRef.current.pointForCoordinate(userLocation);
 *   setPlayerScreenPos({ x: point.x, y: point.y });
 * };
 *
 * // Appeler updateFogPosition à chaque changement de position ou de région.
 *
 * // Dans le rendu, après MapView :
 * <FogOfWar
 *   playerScreenPos={playerScreenPos}
 *   screenWidth={width}
 *   screenHeight={height}
 *   visibilityRadius={160}
 *   discoveredCircles={discoveredScreenPositions}
 * />
 */
