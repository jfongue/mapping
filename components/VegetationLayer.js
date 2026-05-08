// VegetationLayer — éléments de végétation procéduraux par biome.
// Rendu en Views natives (pas de SVG), painter's sort par Y.
// Chaque élément est généré une seule fois via useMemo (seedé, déterministe).
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { TILES_DATA, TILE_PX, MAP_W, MAP_H, WALKABLE } from '../src/tilemap';
import { BIOMES, Z_OFFSET, getBiomeAt } from '../src/biomes';
import { rng } from '../src/random';

const MAX_ELEMENTS = 1200;

// ─── Formes procédurales ────────────────────────────────────────────────────

function shiftLightness(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amount);
  const g = Math.min(255, ((n >> 8)  & 0xff) + amount);
  const b = Math.min(255, ( n        & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function Tree({ x, y, seed, tint }) {
  const r = rng(seed);
  const h = 18 + r() * 14;
  const spread = 9 + r() * 7;
  const lean = (r() - 0.5) * 5;
  const darkCrown = tint || '#2D5A3D';
  const midCrown  = tint ? shiftLightness(tint, 10) : '#3D6B4F';
  const litCrown  = tint ? shiftLightness(tint, 20) : '#4A7C5F';
  return (
    <View style={{ position: 'absolute', left: x - spread, top: y - h - spread, width: spread * 2, height: h + spread }}>
      <View style={{
        position: 'absolute', left: spread + lean * 1.5 - spread * 0.7,
        top: h + spread * 0.6, width: spread * 1.4, height: spread * 0.5,
        borderRadius: spread, backgroundColor: 'rgba(0,0,0,0.12)',
      }} />
      <View style={{
        position: 'absolute', left: spread + lean - 2, top: spread * 0.8,
        width: 4, height: h * 0.7, backgroundColor: '#5C4033', borderRadius: 2,
      }} />
      <View style={{
        position: 'absolute', left: spread - spread * 0.95, top: 0,
        width: spread * 1.9, height: spread * 1.9, borderRadius: spread,
        backgroundColor: darkCrown,
      }} />
      <View style={{
        position: 'absolute', left: spread - spread * 0.8, top: spread * 0.15,
        width: spread * 1.4, height: spread * 1.4, borderRadius: spread,
        backgroundColor: midCrown,
      }} />
      <View style={{
        position: 'absolute', left: spread - spread * 0.5, top: spread * 0.3,
        width: spread * 1.1, height: spread * 1.1, borderRadius: spread,
        backgroundColor: litCrown,
      }} />
    </View>
  );
}

function Palm({ x, y, seed }) {
  const r = rng(seed);
  const h = 22 + r() * 12;
  const lean = (r() - 0.5) * 8;
  return (
    <View style={{ position: 'absolute', left: x - 20, top: y - h - 10, width: 40, height: h + 10 }}>
      <View style={{
        position: 'absolute', left: 20 + lean - 2, top: 8,
        width: 4, height: h, backgroundColor: '#8B6914', borderRadius: 2,
      }} />
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <View key={i} style={{
          position: 'absolute',
          left: 20 + lean + Math.cos(deg * Math.PI / 180) * 10 - 10,
          top: 4 + Math.sin(deg * Math.PI / 180) * 4,
          width: 20, height: 6,
          backgroundColor: '#3A7A2A',
          borderRadius: 3,
          transform: [{ rotate: `${deg}deg` }],
        }} />
      ))}
    </View>
  );
}

function Cactus({ x, y, seed }) {
  const r = rng(seed);
  const h = 14 + r() * 10;
  const hasArm = r() > 0.4;
  return (
    <View style={{ position: 'absolute', left: x - 8, top: y - h, width: 16, height: h }}>
      <View style={{
        position: 'absolute', left: 5, top: 0,
        width: 6, height: h, backgroundColor: '#4A8A3A', borderRadius: 3,
      }} />
      {hasArm && (
        <>
          <View style={{
            position: 'absolute', left: 3, top: h * 0.35,
            width: 10, height: 4, backgroundColor: '#4A8A3A', borderRadius: 2,
          }} />
          <View style={{
            position: 'absolute', left: 3, top: h * 0.15,
            width: 4, height: h * 0.25, backgroundColor: '#4A8A3A', borderRadius: 2,
          }} />
        </>
      )}
      <View style={{
        position: 'absolute', left: 1, top: h * 0.5,
        width: 8, height: 3, backgroundColor: '#4A8A3A', borderRadius: 2,
      }} />
    </View>
  );
}

function Bush({ x, y, seed, color }) {
  const r = rng(seed);
  const s = 7 + r() * 6;
  const c = color || '#5A8A4A';
  return (
    <View style={{ position: 'absolute', left: x - s, top: y - s * 0.8, width: s * 2, height: s * 1.2 }}>
      <View style={{
        position: 'absolute', left: 0, top: s * 0.2,
        width: s * 2, height: s, borderRadius: s,
        backgroundColor: c,
      }} />
      <View style={{
        position: 'absolute', left: s * 0.4, top: 0,
        width: s * 1.2, height: s, borderRadius: s,
        backgroundColor: shiftLightness(c, 8),
      }} />
    </View>
  );
}

function Reed({ x, y, seed }) {
  const r = rng(seed);
  const h = 16 + r() * 10;
  const count = 2 + Math.floor(r() * 2);
  return (
    <View style={{ position: 'absolute', left: x - 8, top: y - h, width: 16, height: h }}>
      {Array.from({ length: count }).map((_, i) => {
        const ox = (i - count / 2) * 5;
        return (
          <View key={i} style={{
            position: 'absolute', left: 8 + ox - 1, top: 0,
            width: 2, height: h, backgroundColor: '#7A9A4A', borderRadius: 1,
          }} />
        );
      })}
    </View>
  );
}

function Flower({ x, y, seed }) {
  const r = rng(seed);
  const colors = ['#FFD700', '#FF6B8A', '#FF8C42', '#C8E15A', '#A8D8EA'];
  const c = colors[Math.floor(r() * colors.length)];
  return (
    <View style={{
      position: 'absolute', left: x - 4, top: y - 6,
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: c, opacity: 0.85,
    }} />
  );
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

function VegElement({ type, x, y, seed, biome }) {
  const biomeCfg = BIOMES[biome] || BIOMES.plains;
  switch (type) {
    case 'tree':     return <Tree x={x} y={y} seed={seed} tint={biomeCfg.ground.shadow} />;
    case 'palm':     return <Palm x={x} y={y} seed={seed} />;
    case 'cactus':   return <Cactus x={x} y={y} seed={seed} />;
    case 'bush':     return <Bush x={x} y={y} seed={seed} color={biomeCfg.ground.accent} />;
    case 'shrub':    return <Bush x={x} y={y} seed={seed + 1} color='#6A9B6A' />;
    case 'reed':     return <Reed x={x} y={y} seed={seed} />;
    case 'lily':     return <Flower x={x} y={y} seed={seed} />;
    case 'flower':   return <Flower x={x} y={y} seed={seed} />;
    case 'fern':     return <Bush x={x} y={y} seed={seed} color='#2A6A2A' />;
    case 'vine':     return <Bush x={x} y={y} seed={seed + 2} color='#3A7A3A' />;
    case 'deadwood': return <Bush x={x} y={y} seed={seed} color='#8A7060' />;
    default:         return null;
  }
}

// ─── Composant principal ────────────────────────────────────────────────────

export default function VegetationLayer() {
  const elements = useMemo(() => {
    const out = [];
    // Seed valide (0xVE6E74 était invalide — remplacé par 0xE6E740)
    const cellRng = rng(0xE6E740);

    for (let cy = 0; cy < MAP_H && out.length < MAX_ELEMENTS; cy++) {
      for (let cx = 0; cx < MAP_W && out.length < MAX_ELEMENTS; cx++) {
        const tileType = TILES_DATA[cy * MAP_W + cx];
        if (!WALKABLE[tileType]) continue;

        // getBiomeAt(cx, cy) — depuis biomes.js, pas tilemap.js
        const biome = getBiomeAt(cx, cy);
        if (!biome) continue;
        const cfg = BIOMES[biome];

        const roll = cellRng();
        if (roll > cfg.vegDensity) continue;

        const vegTypes = cfg.vegetation;
        const typeIdx = Math.floor(cellRng() * vegTypes.length);
        const type = vegTypes[typeIdx];

        const offsetX = (cellRng() - 0.5) * TILE_PX * 0.6;
        const offsetY = (cellRng() - 0.5) * TILE_PX * 0.6;
        const px = cx * TILE_PX + TILE_PX / 2 + offsetX;
        const py = cy * TILE_PX + TILE_PX / 2 + offsetY;

        const seed = (cy * MAP_W + cx) * 31 + typeIdx;
        const sortY = py + (Z_OFFSET[type] || 0);

        out.push({ type, px, py, seed, biome, sortY });
      }
    }

    out.sort((a, b) => a.sortY - b.sortY);
    return out;
  }, []);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
      {elements.map((el, i) => (
        <VegElement key={i} type={el.type} x={el.px} y={el.py} seed={el.seed} biome={el.biome} />
      ))}
    </View>
  );
}
