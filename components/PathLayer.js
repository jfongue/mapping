// PathLayer — affiche les sillons (chemins battus) comme overlay sur la carte.
// Rendu SVG léger, visible uniquement dans la zone camera, max 200 tiles.
import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { MAP_W_PX, MAP_H_PX } from './TileLayer';
import { TILE_PX } from '../src/tilemap';

// Couleur et largeur selon le niveau de sillon
function sillonStyle(count, isWater) {
  if (isWater) {
    if (count < 10)  return null; // pas encore de pont
    if (count < 40)  return { color: 'rgba(120,200,240,0.35)', w: TILE_PX * 0.4 };
    if (count < 100) return { color: 'rgba(80,160,220,0.50)', w: TILE_PX * 0.6 };
    return               { color: 'rgba(50,130,200,0.65)', w: TILE_PX * 0.85 };
  }
  if (count < 5)   return null;
  if (count < 20)  return { color: 'rgba(180,140,80,0.25)',  w: TILE_PX * 0.30 };
  if (count < 60)  return { color: 'rgba(160,120,60,0.40)',  w: TILE_PX * 0.45 };
  if (count < 150) return { color: 'rgba(140,100,40,0.55)',  w: TILE_PX * 0.65 };
  return               { color: 'rgba(120,80,20,0.70)',   w: TILE_PX * 0.85 };
}

export default function PathLayer({ sillons }) {
  const rects = useMemo(() => {
    if (!sillons) return [];
    const out = [];
    for (const [key, data] of Object.entries(sillons)) {
      const [cx, cy] = key.split(',').map(Number);
      const count = data?.count ?? 0;
      if (count < 5) continue;
      const isWater = data?.tileType === 0;
      const style = sillonStyle(count, isWater);
      if (!style) continue;
      const margin = (TILE_PX - style.w) / 2;
      out.push(
        <Rect
          key={key}
          x={cx * TILE_PX + margin}
          y={cy * TILE_PX + margin}
          width={style.w}
          height={style.w}
          fill={style.color}
          rx={style.w * 0.3}
        />
      );
      if (out.length >= 200) break;
    }
    return out;
  }, [sillons]);

  if (!rects.length) return null;

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: MAP_W_PX, height: MAP_H_PX }} pointerEvents="none">
      <Svg width={MAP_W_PX} height={MAP_H_PX}>
        {rects}
      </Svg>
    </View>
  );
}
