// Composant isolé pour la preview du trajet (avant confirmation).
// React.memo garantit qu'aucun re-render de App ne le fait re-render
// si pendingTarget n'a pas changé.
import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { MAP_W_PX, MAP_H_PX } from './TileLayer';
import AnimatedDottedLine from './AnimatedDottedLine';

function PreviewLayerImpl({ pendingTarget, pos, dashPhase }) {
  // Pour la preview on utilise les waypoints bruts (wps) — pas les samples lissés.
  // Beaucoup moins de points → repaint SVG négligeable.
  const pointsStr = useMemo(() => {
    const wps = pendingTarget?.wps;
    if (!wps || wps.length < 2) return '';
    return wps.map((p) => `${p.x},${p.y}`).join(' ');
  }, [pendingTarget?.wps]);

  if (!pendingTarget) return null;

  return (
    <>
      {/* Courbe preview (waypoints bruts A* — léger) */}
      {pointsStr ? (
        <Svg
          width={MAP_W_PX}
          height={MAP_H_PX}
          style={{ position: 'absolute', top: 0, left: 0 }}
          pointerEvents="none"
        >
          <Polyline
            points={pointsStr}
            stroke="#3a7ea8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.95}
            strokeDasharray="10,8"
          />
        </Svg>
      ) : null}

      {/* Pointillés animés */}
      <AnimatedDottedLine from={pos} to={pendingTarget} phase={dashPhase} />

      {/* Marqueurs destination */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: pendingTarget.x - 18,
          top: pendingTarget.y - 18,
          width: 36, height: 36, borderRadius: 18,
          borderWidth: 2, borderColor: '#ffd93d',
          backgroundColor: 'rgba(255,217,61,0.18)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: pendingTarget.x - 6,
          top: pendingTarget.y - 6,
          width: 12, height: 12, borderRadius: 6,
          backgroundColor: '#ffd93d',
        }}
      />
    </>
  );
}

export default React.memo(PreviewLayerImpl);
