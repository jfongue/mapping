import {
  MAP_SIZE, GRID_STEP, SPEED_PX_PER_SEC,
  MIN_DURATION_MS, MAX_DURATION_MS,
  MIN_SCALE, MAX_SCALE,
  ONLINE_THRESHOLD_MS, TAP_PLAYER_RADIUS,
  SPEED_LEVELS, PLAYER_COLORS, ANIMAL_NAMES,
  PX_PER_METER, SPAWN, TOP_SAFE,
} from '../constants';

describe('constants : sanity checks', () => {
  test('MAP_SIZE > 0', () => {
    expect(MAP_SIZE).toBeGreaterThan(0);
  });

  test('GRID_STEP divise MAP_SIZE', () => {
    expect(MAP_SIZE % GRID_STEP).toBe(0);
  });

  test('SPEED_PX_PER_SEC > 0', () => {
    expect(SPEED_PX_PER_SEC).toBeGreaterThan(0);
  });

  test('MIN_DURATION < MAX_DURATION', () => {
    expect(MIN_DURATION_MS).toBeLessThan(MAX_DURATION_MS);
  });

  test('MIN_SCALE < MAX_SCALE et tous deux positifs', () => {
    expect(MIN_SCALE).toBeLessThan(MAX_SCALE);
    expect(MIN_SCALE).toBeGreaterThan(0);
  });

  test('ONLINE_THRESHOLD_MS > 0', () => {
    expect(ONLINE_THRESHOLD_MS).toBeGreaterThan(0);
  });

  test('TAP_PLAYER_RADIUS > 0', () => {
    expect(TAP_PLAYER_RADIUS).toBeGreaterThan(0);
  });

  test('SPEED_LEVELS commence à 1 et croît', () => {
    expect(SPEED_LEVELS[0]).toBe(1);
    for (let i = 1; i < SPEED_LEVELS.length; i++) {
      expect(SPEED_LEVELS[i]).toBeGreaterThan(SPEED_LEVELS[i - 1]);
    }
  });

  test('PLAYER_COLORS : tous des hex valides', () => {
    expect(PLAYER_COLORS.length).toBeGreaterThan(5);
    for (const c of PLAYER_COLORS) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  test('PLAYER_COLORS uniques', () => {
    expect(new Set(PLAYER_COLORS).size).toBe(PLAYER_COLORS.length);
  });

  test('ANIMAL_NAMES non vide, strings uniques', () => {
    expect(ANIMAL_NAMES.length).toBeGreaterThan(3);
    expect(new Set(ANIMAL_NAMES).size).toBe(ANIMAL_NAMES.length);
    for (const n of ANIMAL_NAMES) {
      expect(typeof n).toBe('string');
      expect(n.length).toBeGreaterThan(0);
    }
  });

  test('PX_PER_METER > 0', () => {
    expect(PX_PER_METER).toBeGreaterThan(0);
  });

  test('SPAWN au centre de la map', () => {
    expect(SPAWN.x).toBe(MAP_SIZE / 2);
    expect(SPAWN.y).toBe(MAP_SIZE / 2);
  });

  test('TOP_SAFE > 0', () => {
    expect(TOP_SAFE).toBeGreaterThan(0);
  });
});
