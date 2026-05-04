import {
  genPlayerId, randomName, randomColor, generateProfile,
  isPlayerOnline, currentPlayerPos,
} from '../profile';
import { PLAYER_COLORS, ANIMAL_NAMES, ONLINE_THRESHOLD_MS } from '../constants';
import { lerpFromTarget } from '../movement';

describe('genPlayerId', () => {
  test('commence par p_', () => {
    expect(genPlayerId().startsWith('p_')).toBe(true);
  });

  test('1000 IDs uniques', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) ids.add(genPlayerId());
    expect(ids.size).toBe(1000);
  });

  test('longueur cohérente (10-20 chars après p_)', () => {
    for (let i = 0; i < 50; i++) {
      const id = genPlayerId();
      expect(id.length).toBeGreaterThanOrEqual(10);
      expect(id.length).toBeLessThanOrEqual(25);
    }
  });
});

describe('randomName', () => {
  test('contient un nom d\'animal valide', () => {
    for (let i = 0; i < 50; i++) {
      const name = randomName();
      const found = ANIMAL_NAMES.some((a) => name.startsWith(a));
      expect(found).toBe(true);
    }
  });

  test('inclut un nombre', () => {
    expect(randomName()).toMatch(/\d+/);
  });

  test('format "Animal NNN"', () => {
    expect(randomName()).toMatch(/^[A-Za-zÀ-ÿ]+ \d+$/);
  });
});

describe('randomColor', () => {
  test('renvoie une couleur du pool', () => {
    for (let i = 0; i < 50; i++) {
      expect(PLAYER_COLORS).toContain(randomColor());
    }
  });

  test('couleur format hex valide', () => {
    expect(randomColor()).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('generateProfile', () => {
  test('a id, name, color', () => {
    const p = generateProfile();
    expect(p.id).toMatch(/^p_/);
    expect(typeof p.name).toBe('string');
    expect(p.name.length).toBeGreaterThan(0);
    expect(PLAYER_COLORS).toContain(p.color);
  });

  test('100 profils tous différents (id)', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(generateProfile().id);
    expect(ids.size).toBe(100);
  });
});

describe('isPlayerOnline', () => {
  const now = 1000000;
  const T = ONLINE_THRESHOLD_MS;

  test.each([
    [{ lastSeen: now - 1000 }, true, 'récent'],
    [{ lastSeen: now }, true, 'instantané'],
    [{ lastSeen: now - T + 1 }, true, 'juste avant seuil'],
    [{ lastSeen: now - T }, false, 'pile au seuil → offline'],
    [{ lastSeen: now - T - 1 }, false, 'au-delà seuil'],
    [{ lastSeen: now - 60000 }, false, 'ancien'],
    [{ lastSeen: 0 }, false, 'lastSeen=0 considéré faux'],
    [{}, false, 'pas de lastSeen'],
    [{ lastSeen: null }, false, 'null'],
    [{ lastSeen: undefined }, false, 'undefined'],
  ])('%o → online=%s (%s)', (player, expected) => {
    expect(isPlayerOnline(player, now, T)).toBe(expected);
  });
});

describe('currentPlayerPos', () => {
  test('sans target → renvoie x/y', () => {
    expect(currentPlayerPos({ x: 50, y: 60 }, lerpFromTarget)).toEqual({ x: 50, y: 60 });
  });

  test('avec target valide → interpole', () => {
    const player = {
      x: 0, y: 0,
      target: { fromX: 0, fromY: 0, toX: 100, toY: 0, startTs: 1000, durationMs: 1000 },
    };
    const r = currentPlayerPos(player, lerpFromTarget, 1500);
    expect(r.x).toBe(50);
    expect(r.y).toBe(0);
  });

  test('avec target valide à la fin → toX/toY', () => {
    const player = {
      x: 0, y: 0,
      target: { fromX: 0, fromY: 0, toX: 200, toY: 100, startTs: 1000, durationMs: 1000 },
    };
    const r = currentPlayerPos(player, lerpFromTarget, 5000);
    expect(r.x).toBe(200);
    expect(r.y).toBe(100);
  });

  test('avec target invalide → fallback x/y', () => {
    const player = { x: 50, y: 60, target: { fromX: 0 } };
    expect(currentPlayerPos(player, lerpFromTarget)).toEqual({ x: 50, y: 60 });
  });

  test('target null → fallback', () => {
    expect(currentPlayerPos({ x: 1, y: 2, target: null }, lerpFromTarget)).toEqual({ x: 1, y: 2 });
  });
});
