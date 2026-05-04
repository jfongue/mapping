// Tests d'intégration : flow complet d'un déplacement.
// Pas de React, on teste la chaîne de transformations pure.

import { movementDuration, lerpFromTarget, remainingDurationAt } from '../movement';
import { isPlayerOnline, currentPlayerPos, generateProfile } from '../profile';
import { mapToScreen, isInViewport, edgeArrowPosition, cameraToCenter } from '../camera';
import { formatMeters, formatDuration } from '../format';
import { ONLINE_THRESHOLD_MS } from '../constants';

describe('Flow : déplacement complet', () => {
  test('je clique pour aller à (800, 0), durée calculée puis lerp à mi-chemin', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 800, y: 0 };
    const { dist, durationMs } = movementDuration(from, to);
    expect(dist).toBe(800);
    expect(durationMs).toBeCloseTo(10000);

    // Simulate Firebase target
    const startTs = 1000000;
    const target = {
      fromX: from.x, fromY: from.y,
      toX: to.x, toY: to.y,
      startTs, durationMs,
    };

    // Au milieu : x=400
    const mid = lerpFromTarget(target, startTs + durationMs / 2);
    expect(mid.x).toBe(400);

    // Affichage
    expect(formatMeters(dist)).toBe('80 m');
    expect(formatDuration(Math.round(durationMs / 1000))).toBe('10s');
  });

  test('joueur online qui bouge, pos courante interpolée correctement', () => {
    const now = 1500;
    const player = {
      id: 'p1', x: 0, y: 0,
      lastSeen: now - 1000,
      target: { fromX: 0, fromY: 0, toX: 200, toY: 100, startTs: 1000, durationMs: 1000 },
    };
    expect(isPlayerOnline(player, now, ONLINE_THRESHOLD_MS)).toBe(true);
    const pos = currentPlayerPos(player, lerpFromTarget, now);
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(50);
  });

  test('joueur offline depuis longtemps, pos statique', () => {
    const now = 1000000;
    const player = {
      id: 'p1', x: 50, y: 60,
      lastSeen: now - 60000, // 1min ago
    };
    expect(isPlayerOnline(player, now, ONLINE_THRESHOLD_MS)).toBe(false);
    const pos = currentPlayerPos(player, lerpFromTarget, now);
    expect(pos).toEqual({ x: 50, y: 60 });
  });
});

describe('Flow : caméra & viewport', () => {
  test('recenter sur perso → perso au centre écran', () => {
    const playerMap = { x: 1500, y: 1500 };
    const cam = cameraToCenter(playerMap.x, playerMap.y, 800, 600, 1);
    const screen = mapToScreen(playerMap.x, playerMap.y, cam.x, cam.y, 1);
    expect(screen.x).toBeCloseTo(400);
    expect(screen.y).toBeCloseTo(300);
  });

  test('joueur in viewport → pas de flèche utile', () => {
    const cam = cameraToCenter(1500, 1500, 800, 600, 1);
    expect(isInViewport(1500, 1500, cam.x, cam.y, 1, 800, 600)).toBe(true);
  });

  test('joueur hors viewport → flèche au bord', () => {
    const cam = cameraToCenter(1500, 1500, 800, 600, 1);
    // Joueur très à droite
    expect(isInViewport(3000, 1500, cam.x, cam.y, 1, 800, 600)).toBe(false);
    const arrow = edgeArrowPosition(3000, 1500, cam.x, cam.y, 1, 800, 600, 0);
    expect(arrow.x).toBeCloseTo(800); // bord droit
    expect(arrow.angle).toBeCloseTo(0);
  });
});

describe('Flow : profil aléatoire généré valide', () => {
  test('100 profils, tous valides', () => {
    for (let i = 0; i < 100; i++) {
      const p = generateProfile();
      expect(p.id).toMatch(/^p_/);
      expect(typeof p.name).toBe('string');
      expect(typeof p.color).toBe('string');
    }
  });
});

describe('Flow : speedMul affecte durée mais pas distance affichée', () => {
  test('même distance, ×4 = 4x plus rapide', () => {
    const slow = movementDuration({ x: 0, y: 0 }, { x: 800, y: 0 }, 1);
    const fast = movementDuration({ x: 0, y: 0 }, { x: 800, y: 0 }, 4);
    expect(slow.dist).toBe(fast.dist);
    expect(fast.durationMs).toBeCloseTo(slow.durationMs / 4);
  });

  test('changement de speed à mi-chemin → reste cohérent', () => {
    const target = { toX: 800, toY: 0, durationMs: 10000 };
    const remaining = remainingDurationAt(target, 400, 0, 4); // mi-chemin, ×4
    expect(remaining).toBeCloseTo(1250); // 5000 / 4
  });
});
