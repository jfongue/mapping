// Rendu de la map en Views natives (compositor RN, pas de SVG).
// Couche 1 : base terrain (greedy-merge des rects, ultra léger).
// Couche 2 : décor déterministe (arbres, herbe, rochers, lave, vagues, écume de plage).
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { TILES_DATA, TILE_COLORS, TILE_PX, MAP_W, MAP_H } from '../src/tilemap';
import { generateDecor } from '../src/biomeDecor';

export const MAP_W_PX = MAP_W * TILE_PX;
export const MAP_H_PX = MAP_H * TILE_PX;

// Densité/plafond volontairement modérés : un layer statique de quelques milliers
// de Views reste fluide, et le rendu est mémoïsé une seule fois.
const DECOR_DENSITY = 0.6;
const DECOR_MAX = 3000;

// --- Rendu d'une décoration selon son type ---
function DecorItem({ d }) {
  const base = { position: 'absolute', left: d.left, top: d.top };

  switch (d.type) {
    case 'tree':
      // Ombre + feuillage (cercle) + tronc + reflet.
      return (
        <View pointerEvents="none" style={[base, { width: d.w, height: d.h }]}>
          <View style={{
            position: 'absolute', left: d.w * 0.15, top: d.h * 0.78,
            width: d.w * 0.7, height: d.h * 0.16, borderRadius: d.h * 0.08,
            backgroundColor: 'rgba(40,60,30,0.18)',
          }} />
          <View style={{
            position: 'absolute', left: d.w * 0.42, top: d.h * 0.45,
            width: d.w * 0.16, height: d.h * 0.4, borderRadius: 2,
            backgroundColor: '#6b4a2b',
          }} />
          <View style={{
            position: 'absolute', left: 0, top: 0,
            width: d.w, height: d.w, borderRadius: d.w / 2,
            backgroundColor: d.color,
          }} />
          <View style={{
            position: 'absolute', left: d.w * 0.18, top: d.w * 0.1,
            width: d.w * 0.4, height: d.w * 0.4, borderRadius: d.w * 0.2,
            backgroundColor: 'rgba(255,255,255,0.18)',
          }} />
        </View>
      );

    case 'grass':
      return (
        <View pointerEvents="none" style={[base, {
          width: d.w, height: d.h, borderTopLeftRadius: d.w, borderTopRightRadius: d.w,
          backgroundColor: d.color, opacity: 0.8,
        }]} />
      );

    case 'rock':
      return (
        <View pointerEvents="none" style={[base, { width: d.w, height: d.h }]}>
          <View style={{
            position: 'absolute', left: 0, top: d.h * 0.25,
            width: d.w, height: d.h * 0.85, borderRadius: d.w * 0.4,
            backgroundColor: d.color,
          }} />
          <View style={{
            position: 'absolute', left: d.w * 0.15, top: 0,
            width: d.w * 0.55, height: d.h * 0.55, borderRadius: d.w * 0.3,
            backgroundColor: 'rgba(255,255,255,0.22)',
          }} />
        </View>
      );

    case 'lavaGlow':
    case 'lavaCore':
      return (
        <View pointerEvents="none" style={[base, {
          width: d.w, height: d.h, borderRadius: d.w / 2,
          backgroundColor: d.color, opacity: d.op,
        }]} />
      );

    case 'wave':
      return (
        <View pointerEvents="none" style={[base, {
          width: d.w, height: d.h, borderRadius: d.h, backgroundColor: d.color,
        }]} />
      );

    case 'foam':
      return (
        <View pointerEvents="none" style={[base, {
          width: d.w, height: d.h, backgroundColor: d.color,
        }]} />
      );

    default:
      return null;
  }
}

const DecorLayer = React.memo(function DecorLayer() {
  const decor = useMemo(
    () => generateDecor({
      tiles: TILES_DATA, W: MAP_W, H: MAP_H, tilePx: TILE_PX,
      density: DECOR_DENSITY, maxItems: DECOR_MAX,
    }),
    []
  );
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: MAP_W_PX, height: MAP_H_PX }}>
      {decor.map((d, i) => <DecorItem key={i} d={d} />)}
    </View>
  );
});

function TileLayerImpl() {
  const rects = useMemo(() => {
    // Merge 2D greedy : étend à droite (max run même type), puis vers le bas tant que
    // toute la tranche a le même type. Réduit massivement le nb de Views sur grande map.
    const visited = new Uint8Array(MAP_W * MAP_H);
    const out = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (visited[y * MAP_W + x]) continue;
        const t = TILES_DATA[y * MAP_W + x];
        let xEnd = x;
        while (xEnd < MAP_W && !visited[y * MAP_W + xEnd] && TILES_DATA[y * MAP_W + xEnd] === t) xEnd++;
        let yEnd = y + 1;
        outer: while (yEnd < MAP_H) {
          for (let xx = x; xx < xEnd; xx++) {
            if (visited[yEnd * MAP_W + xx] || TILES_DATA[yEnd * MAP_W + xx] !== t) break outer;
          }
          yEnd++;
        }
        for (let yy = y; yy < yEnd; yy++) {
          for (let xx = x; xx < xEnd; xx++) {
            visited[yy * MAP_W + xx] = 1;
          }
        }
        out.push({
          left: x * TILE_PX,
          top: y * TILE_PX,
          width: (xEnd - x) * TILE_PX,
          height: (yEnd - y) * TILE_PX,
          backgroundColor: TILE_COLORS[t],
        });
      }
    }
    return out;
  }, []);

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: MAP_W_PX, height: MAP_H_PX }}
    >
      {rects.map((r, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: r.left, top: r.top,
            width: r.width, height: r.height,
            backgroundColor: r.backgroundColor,
          }}
        />
      ))}
      <DecorLayer />
    </View>
  );
}

export default React.memo(TileLayerImpl);
