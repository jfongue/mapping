import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import { tileKeyToCoord } from './fogUtils';
import { FOG_COLOR, FOG_MAX_OPACITY, TILE_SIZE_DEG } from './fogConstants';

/**
 * Convertit des coordonnées GPS en position pixel écran
 * en fonction de la région visible (MapView region).
 */
const geoToPixel = (latitude, longitude, region, layout) => {
  const { latitude: cLat, longitude: cLon, latitudeDelta, longitudeDelta } = region;
  const { width, height } = layout;

  const x = ((longitude - cLon) / longitudeDelta + 0.5) * width;
  const y = ((cLat - latitude)  / latitudeDelta  + 0.5) * height;
  return { x, y };
};

/**
 * FogOfWarLayer
 *
 * Props :
 *   - tiles       : { [tileKey]: { firstSeen, lastSeen } }
 *   - getOpacity  : (tileKey) => number [0..1]
 *   - region      : région visible de la MapView { latitude, longitude, latitudeDelta, longitudeDelta }
 *   - layout      : { width, height } de la MapView
 */
const FogOfWarLayer = ({ tiles, getOpacity, region, layout }) => {
  const { width, height } = layout;

  // Taille en pixels d'une tuile selon le zoom actuel
  const tilePixelW = useMemo(() => {
    return (TILE_SIZE_DEG / region.longitudeDelta) * width;
  }, [region.longitudeDelta, width]);

  const tilePixelH = useMemo(() => {
    return (TILE_SIZE_DEG / region.latitudeDelta) * height;
  }, [region.latitudeDelta, height]);

  // Ne rendre que les tuiles visibles dans la région courante
  const visibleTileRects = useMemo(() => {
    return Object.keys(tiles).map((key) => {
      const opacity = getOpacity(key);
      // Tuile totalement opaque = on la masque avec le fond, inutile de la dessiner
      if (opacity >= FOG_MAX_OPACITY) return null;

      const { latitude, longitude } = tileKeyToCoord(key);
      const { x, y } = geoToPixel(latitude, longitude, region, layout);

      // Clip grossier : ignorer les tuiles hors écran
      if (x < -tilePixelW || x > width + tilePixelW) return null;
      if (y < -tilePixelH || y > height + tilePixelH) return null;

      return (
        <Rect
          key={key}
          x={x}
          y={y}
          width={tilePixelW + 1} // +1 pour éviter les gaps entre tuiles
          height={tilePixelH + 1}
          fill={FOG_COLOR}
          fillOpacity={opacity}
        />
      );
    }).filter(Boolean);
  }, [tiles, getOpacity, region, layout, tilePixelW, tilePixelH]);

  if (!width || !height) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          {/* Dégradé radial pour adoucir le bord de révélation autour du joueur */}
          <RadialGradient id="revealGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"  stopColor={FOG_COLOR} stopOpacity="0" />
            <Stop offset="70%" stopColor={FOG_COLOR} stopOpacity="0.15" />
            <Stop offset="100%" stopColor={FOG_COLOR} stopOpacity={FOG_MAX_OPACITY} />
          </RadialGradient>
        </Defs>

        {/* Fond : brouillard total sur toute la carte */}
        <Rect
          x={0} y={0}
          width={width} height={height}
          fill={FOG_COLOR}
          fillOpacity={FOG_MAX_OPACITY}
        />

        {/* Trous : tuiles explorées avec leur opacité calculée (péremption) */}
        <G>
          {visibleTileRects}
        </G>
      </Svg>
    </View>
  );
};

export default FogOfWarLayer;
