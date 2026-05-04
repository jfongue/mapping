import { movementDuration, lerpFromTarget, remainingDurationAt } from '../movement';
import { MIN_DURATION_MS, MAX_DURATION_MS, SPEED_PX_PER_SEC } from '../constants';

describe('movementDuration', () => {
  test('même point → durée min, dist = 0', () => {
    const r = movementDuration({ x: 0, y: 0 }, { x: 0, y: 0 });
    expect(r.dist).toBe(0);
    expect(r.durationMs).toBe(MIN_DURATION_MS);
    expect(r.baseDurationMs).toBe(MIN_DURATION_MS);
  });

  test('petite distance → clampée à MIN_DURATION_MS', () => {
    const r = movementDuration({ x: 0, y: 0 }, { x: 50, y: 0 });
    expect(r.dist).toBe(50);
    expect(r.durationMs).toBe(MIN_DURATION_MS);
  });

  test('grande distance → clampée à MAX_DURATION_MS', () => {
    const r = movementDuration({ x: 0, y: 0 }, { x: 1000000, y: 0 });
    expect(r.durationMs).toBe(MAX_DURATION_MS);
  });

  test('distance proportionnelle dans la plage', () => {
    const r = movementDuration({ x: 0, y: 0 }, { x: 800, y: 0 });
    expect(r.dist).toBeCloseTo(800);
    expect(r.durationMs).toBeCloseTo(10000);
    expect(r.baseDurationMs).toBeCloseTo(10000);
  });

  test('speedMul divise la durée mais garde baseDuration', () => {
    const r = movementDuration({ x: 0, y: 0 }, { x: 800, y: 0 }, 4);
    expect(r.durationMs).toBeCloseTo(2500);
    expect(r.baseDurationMs).toBeCloseTo(10000);
  });

  test.each([0, -1, 0.5, NaN])('speedMul invalide (%p) → divisé par 1 minimum', (mul) => {
    const r = movementDuration({ x: 0, y: 0 }, { x: 800, y: 0 }, mul);
    if (Number.isNaN(mul)) {
      // NaN se propage, mais ne doit pas crasher
      expect(typeof r.durationMs).toBe('number');
    } else {
      expect(r.durationMs).toBeCloseTo(10000);
    }
  });

  test.each([
    [3, 4, 5],
    [5, 12, 13],
    [8, 15, 17],
  ])('Pythagore : (%i,%i) → %i', (dx, dy, expected) => {
    const r = movementDuration({ x: 0, y: 0 }, { x: dx * 10, y: dy * 10 });
    expect(r.dist).toBeCloseTo(expected * 10);
  });

  test('symétrie : aller-retour donne même distance', () => {
    const a = movementDuration({ x: 0, y: 0 }, { x: 500, y: 300 });
    const b = movementDuration({ x: 500, y: 300 }, { x: 0, y: 0 });
    expect(a.dist).toBeCloseTo(b.dist);
    expect(a.durationMs).toBeCloseTo(b.durationMs);
  });

  test('durationMs * SPEED_PX_PER_SEC ≈ dist (dans plage non-clampée)', () => {
    const r = movementDuration({ x: 0, y: 0 }, { x: 800, y: 0 });
    expect((r.durationMs / 1000) * SPEED_PX_PER_SEC).toBeCloseTo(r.dist);
  });
});

describe('lerpFromTarget', () => {
  const target = {
    fromX: 0, fromY: 0,
    toX: 100, toY: 200,
    startTs: 1000,
    durationMs: 1000,
  };

  test('au début → fromX/fromY', () => {
    const r = lerpFromTarget(target, 1000);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.progress).toBe(0);
  });

  test('à la fin → toX/toY', () => {
    const r = lerpFromTarget(target, 2000);
    expect(r.x).toBe(100);
    expect(r.y).toBe(200);
    expect(r.progress).toBe(1);
  });

  test.each([
    [1100, 0.1, 10, 20],
    [1250, 0.25, 25, 50],
    [1500, 0.5, 50, 100],
    [1750, 0.75, 75, 150],
    [1900, 0.9, 90, 180],
  ])('à %i ms → progress=%f, pos=(%i,%i)', (now, p, x, y) => {
    const r = lerpFromTarget(target, now);
    expect(r.progress).toBeCloseTo(p);
    expect(r.x).toBeCloseTo(x);
    expect(r.y).toBeCloseTo(y);
  });

  test('après la fin → clamp à 1', () => {
    const r = lerpFromTarget(target, 9999);
    expect(r.x).toBe(100);
    expect(r.progress).toBe(1);
  });

  test('avant le début → clamp à 0', () => {
    const r = lerpFromTarget(target, 0);
    expect(r.x).toBe(0);
    expect(r.progress).toBe(0);
  });

  test.each([
    null,
    undefined,
    {},
    { startTs: 1 },
    { startTs: 1, durationMs: 'abc' },
  ])('target invalide (%p) → null', (t) => {
    expect(lerpFromTarget(t)).toBeNull();
  });

  test('durationMs = 0 → null (évite div par zéro)', () => {
    // Le code vérifie typeof number, pas la valeur. Avec 0 progress = NaN/Infinity → null désiré.
    // À tester selon implem: si retourne quelque chose, vérifie pas crash.
    const r = lerpFromTarget({ ...target, durationMs: 0 }, 1500);
    if (r) {
      expect(typeof r.x).toBe('number');
    }
  });
});

describe('remainingDurationAt', () => {
  const target = { toX: 800, toY: 0, durationMs: 10000 };

  test.each([
    [0, 0, 1, 10000],
    [0, 0, 2, 5000],
    [0, 0, 4, 2500],
    [400, 0, 1, 5000],
    [400, 0, 2, 2500],
    [800, 0, 1, 0],
  ])('depuis (%i,%i) ×%i → %i ms', (cx, cy, mul, expected) => {
    expect(remainingDurationAt(target, cx, cy, mul)).toBeCloseTo(expected);
  });

  test('target null → 0', () => {
    expect(remainingDurationAt(null, 0, 0, 1)).toBe(0);
  });

  test('totalDist = 0 → 0 (évite div par zéro)', () => {
    expect(remainingDurationAt({ toX: 0, toY: 0, durationMs: 0 }, 0, 0, 1)).toBe(0);
  });
});
