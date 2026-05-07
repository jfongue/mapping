import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect, G } from 'react-native-svg';
import { tileKeyToCoord } from './fogUtils';
import { FOG_COLOR, FOG_MAX_OPACITY, TILE_SIZE_DEG } from './fogConstants';

const geoToPixel = (latitude, longitude, region, layout) => {
  const { latitude: cLat, longitude: cLon, latitudeDelta, longitudeDelta } = region;
  const { width, height } = layout;
  const x = ((longitude - cLon) / longitudeDelta + 0.5) * width;
  const y = ((cLat - latitude)  / latitudeDelta  + 0.5) * height;
  return { x, y };
};

const FogOfWarLayer = ({ tiles, getOpacity, region, layout }) => {
  const { width, height } = layout;

  // Garde : ne rien rendre si les valeurs ne sont pas exploitables
  if (
    !width || !height ||
    !region ||
    !region.latitudeDelta  || region.latitudeDelta  <= 0 ||
    !region.longitudeDelta || region.longitudeDelta <= 0 ||
    isNaN(region.latitude)  || isNaN(region.longitude)
  ) {
    return null;
  }

  const tilePixelW = (TILE_SIZE_DEG / region.longitudeDelta) * width;
  const tilePixelH = (TILE_SIZE_DEG / region.latitudeDelta)  * height;

  // Ne rendre que les tuiles visibles
  const visibleTileRects = Object.keys(tiles).map((key) => {
    const opacity = getOpacity(key);
    if (opacity >= FOG_MAX_OPACITY) return null;

    const { latitude, longitude } = tileKeyToCoord(key);
    const { x, y } = geoToPixel(latitude, longitude, region, layout);

    if (
      isNaN(x) || isNaN(y) ||
      x < -tilePixelW * 2 || x > width  + tilePixelW * 2 ||
      y < -tilePixelH * 2 || y > height + tilePixelH * 2
    ) return null;

    return (
      <Rect
        key={key}
        x={x}
        y={y}
        width={Math.max(1, tilePixelW + 1)}
        height={Math.max(1, tilePixelH + 1)}
        fill={FOG_COLOR}
        fillOpacity={Math.max(0, Math.min(1, opacity))}
      />
    );
  }).filter(Boolean);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        {/* Fond opaque total */}
        <Rect x={0} y={0} width={width} height={height}
          fill={FOG_COLOR} fillOpacity={FOG_MAX_OPACITY} />
        {/* Trous : zones explorées */}
        <G>{visibleTileRects}</G>
      </Svg>
    </View>
  );
};

export default FogOfWarLayer;
