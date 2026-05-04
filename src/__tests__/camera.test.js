import {
  mapToScreen, screenToMap, cameraToCenter,
  clampScale, isInViewport, edgeArrowPosition,
} from '../camera';

describe('mapToScreen', () => {
  test('scale=1, cam=(0,0) → identité', () => {
    expect(mapToScreen(100, 50, 0, 0, 1)).toEqual({ x: 100, y: 50 });
  });

  test('scale=2 → doublé', () => {
    expect(mapToScreen(100, 50, 0, 0, 2)).toEqual({ x: 200, y: 100 });
  });

  test('translate puis scale', () => {
    // (50 + 100) * 2 = 300
    expect(mapToScreen(50, 50, 100, 0, 2)).toEqual({ x: 300, y: 100 });
  });
});

describe('screenToMap (inverse de mapToScreen)', () => {
  test.each([
    [0, 0, 1, [100, 50]],
    [0, 0, 2, [100, 50]],
    [50, 30, 1, [100, 50]],
    [-10, 20, 0.5, [100, 50]],
  ])('cam=(%i,%i) scale=%f, point=%p', (camX, camY, scale, point) => {
    const [x, y] = point;
    const screen = mapToScreen(x, y, camX, camY, scale);
    const back = screenToMap(screen.x, screen.y, camX, camY, scale);
    expect(back.x).toBeCloseTo(x);
    expect(back.y).toBeCloseTo(y);
  });
});

describe('cameraToCenter', () => {
  test('point au centre écran', () => {
    // vp = 800x600, scale = 1 → cam.x = 400 - mapX
    const cam = cameraToCenter(100, 100, 800, 600, 1);
    expect(cam.x).toBe(300);
    expect(cam.y).toBe(200);
    // Vérifie : screen = (100 + 300) * 1 = 400 = vp.w/2 ✓
    const screen = mapToScreen(100, 100, cam.x, cam.y, 1);
    expect(screen.x).toBe(400);
    expect(screen.y).toBe(300);
  });

  test('avec scale, le point reste centré', () => {
    const cam = cameraToCenter(500, 500, 400, 800, 2);
    const screen = mapToScreen(500, 500, cam.x, cam.y, 2);
    expect(screen.x).toBe(200);
    expect(screen.y).toBe(400);
  });
});

describe('clampScale', () => {
  test.each([
    [0.5, 0.5],
    [1, 1],
    [2.5, 2.5],
    [0.1, 0.4],
    [3, 2.5],
    [-1, 0.4],
  ])('clampScale(%f) === %f', (input, expected) => {
    expect(clampScale(input, 0.4, 2.5)).toBe(expected);
  });
});

describe('isInViewport', () => {
  test('point au centre → in', () => {
    expect(isInViewport(100, 100, 300, 200, 1, 800, 600)).toBe(true);
  });

  test('point hors écran → out', () => {
    expect(isInViewport(2000, 2000, 0, 0, 1, 800, 600)).toBe(false);
  });

  test('coin (0,0) écran → limite', () => {
    expect(isInViewport(0, 0, 0, 0, 1, 800, 600)).toBe(true);
  });
});

describe('edgeArrowPosition', () => {
  test('joueur à droite hors écran → flèche bord droit', () => {
    const a = edgeArrowPosition(2000, 300, 0, 0, 1, 800, 600, 0);
    expect(a.x).toBeCloseTo(800); // bord droit
    expect(a.angle).toBeCloseTo(0); // direction droite
  });

  test('joueur en haut → bord haut, angle -90', () => {
    const a = edgeArrowPosition(400, -1000, 0, 0, 1, 800, 600, 0);
    expect(a.y).toBeCloseTo(0);
    expect(a.angle).toBeCloseTo(-90);
  });

  test('avec padding, position décalée', () => {
    const a = edgeArrowPosition(2000, 300, 0, 0, 1, 800, 600, 28);
    expect(a.x).toBeLessThan(800);
    expect(a.x).toBeGreaterThan(700);
  });
});
