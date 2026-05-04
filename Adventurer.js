// Aventurier SVG (port du POC Fantasy). Pas d'animation CSS (RN), juste statique
// + petit bobbing via Animated si moving (à passer en props).
import React from 'react';
import Svg, { G, Rect, Circle, Path, Line, Ellipse } from 'react-native-svg';
import { OUTFITS, SKINS, HAIRS } from '../src/character';

function HatShape({ type, hair, accent = '#c44b3d', isBack }) {
  if (type === 'none') {
    return isBack
      ? <Path d="M -4 -8 Q 0 -12 4 -8 L 4 -6 Q 0 -8 -4 -6 Z" fill={hair} />
      : <Path d="M -4 -9 Q 0 -13 4 -9 L 5 -7 Q 0 -10 -5 -7 Z" fill={hair} />;
  }
  if (type === 'cap') {
    return (
      <G>
        <Path d="M -4 -10 Q 0 -13 4 -10 L 5 -8 Q 0 -9 -5 -8 Z" fill={hair} />
        <Path d="M -5 -10 Q 0 -14 5 -10 L 5 -8 L -5 -8 Z" fill={accent} />
        <Rect x="-5" y="-9" width="10" height="1.5" fill="#3a2614" opacity="0.5" />
      </G>
    );
  }
  if (type === 'hood') {
    return (
      <G>
        <Path d="M -5 -9 Q 0 -13 5 -9 L 6 -4 Q 4 -6 0 -6 Q -4 -6 -6 -4 Z" fill={accent} />
        <Path d="M -3 -8 Q 0 -10 3 -8 L 3 -7 Q 0 -8 -3 -7 Z" fill={hair} opacity="0.6" />
      </G>
    );
  }
  if (type === 'wizard') {
    return (
      <G>
        <Path d="M -4 -9 Q 0 -12 4 -9 L 4 -8 Q 0 -9 -4 -8 Z" fill={hair} />
        <Path d="M -5 -8 L 0 -16 L 5 -8 Z" fill={accent} />
        <Circle cx="0" cy="-15.5" r="0.6" fill="#fff8d8" />
      </G>
    );
  }
  if (type === 'plume') {
    return (
      <G>
        <Path d="M -4 -10 Q 0 -13 4 -10 L 5 -8 Q 0 -9 -5 -8 Z" fill={hair} />
        <Ellipse cx="0" cy="-9.5" rx="5.5" ry="2" fill="#3a2614" />
        <Path d="M 4 -10 Q 7 -13 8 -16 Q 6 -14 5 -10 Z" fill="#c44b3d" />
      </G>
    );
  }
  if (type === 'crown') {
    return (
      <G>
        <Path d="M -4 -9 Q 0 -12 4 -9 L 4 -8 Q 0 -9 -4 -8 Z" fill={hair} />
        <Path d="M -4 -9 L -4 -12 L -2 -10 L 0 -13 L 2 -10 L 4 -12 L 4 -9 Z" fill="#e8c040" stroke="#8b6f1a" strokeWidth="0.4" />
        <Circle cx="0" cy="-12.5" r="0.6" fill="#c44b3d" />
      </G>
    );
  }
  return null;
}

// Aventurier brut SVG (à mettre dans un Svg parent qui définit la viewBox).
function AdventurerInnerImpl({ x = 0, y = 0, dir = 'down', moving = false, scale = 1, outfit = 'red', skin = 'light', hair = 'brown', hat = 'none' }) {
  const out = OUTFITS[outfit] || OUTFITS.red;
  const sk = SKINS[skin] || SKINS.light;
  const hairColor = HAIRS[hair] || HAIRS.brown;
  const isBack = dir === 'up';
  const flip = dir === 'left' ? -1 : 1;

  return (
    <G transform={`translate(${x}, ${y}) scale(${scale})`}>
      <Ellipse cx="0" cy="2" rx="6" ry="2" fill="#000" opacity="0.3" />
      <G transform={`scale(${flip}, 1)`}>
        {/* cape */}
        <Path d="M -5 -4 Q -6 2 -4 4 L 4 4 Q 6 2 5 -4 Z" fill={out.cape} />
        {/* tunic */}
        <Rect x="-3" y="-3" width="6" height="6" fill={out.tunic} />
        <Rect x="-1" y="-3" width="2" height="6" fill={out.stripe} />
        {/* belt */}
        <Rect x="-3" y="0" width="6" height="1.2" fill="#3a2614" />
        {/* head */}
        <Circle cx="0" cy="-7" r="3.8" fill={sk} />
        {/* hair / hat */}
        <HatShape type={hat} hair={hairColor} accent={out.tunic} isBack={isBack} />
        {/* eyes */}
        {!isBack && (
          <G>
            <Circle cx={dir === 'down' ? -1.2 : 0.5} cy="-7" r="0.6" fill="#1a1a1a" />
            {dir === 'down' && <Circle cx="1.2" cy="-7" r="0.6" fill="#1a1a1a" />}
          </G>
        )}
        {/* arms moving */}
        {moving && (
          <G>
            <Rect x="-5.5" y="-2" width="2" height="4" fill={sk} />
            <Rect x="3.5" y="-2" width="2" height="4" fill={sk} />
          </G>
        )}
        {/* sword */}
        {(dir === 'up' || dir === 'left' || dir === 'right') && (
          <G transform="translate(4, -2)">
            <Line x1="0" y1="0" x2="0" y2="-6" stroke="#d4d8e0" strokeWidth="1.2" strokeLinecap="round" />
            <Line x1="-1.5" y1="0" x2="1.5" y2="0" stroke="#8b6f3a" strokeWidth="1.2" />
          </G>
        )}
      </G>
    </G>
  );
}

export const AdventurerInner = React.memo(AdventurerInnerImpl);

// Sprite : Svg complet (taille fixe) + Adventurer dedans. Memoizé.
// À mettre dans un Animated.View parent qui s'occupe du translate.
export const AdventurerSprite = React.memo(function AdventurerSprite({
  size = 50, viewBoxScale = 1.4,
  dir = 'down', moving = false,
  outfit, skin, hair, hat,
}) {
  return (
    <Svg width={size} height={size} viewBox="-15 -20 30 30">
      <AdventurerInner
        x={0} y={5}
        dir={dir} moving={moving}
        scale={viewBoxScale}
        outfit={outfit} skin={skin} hair={hair} hat={hat}
      />
    </Svg>
  );
});

// Wrapper "preview" : Svg complet (utilisable hors map).
export function AdventurerPreview({ outfit, skin, hair, hat, size = 80 }) {
  return (
    <Svg width={size} height={size} viewBox="-15 -20 30 30">
      <AdventurerInner x={0} y={5} dir="down" moving={false} scale={1.6} outfit={outfit} skin={skin} hair={hair} hat={hat} />
    </Svg>
  );
}

export default AdventurerPreview;
