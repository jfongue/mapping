import { formatMeters, formatDuration } from '../format';
import { PX_PER_METER } from '../constants';

describe('formatMeters', () => {
  describe('< 1 km : mètres entiers', () => {
    test.each([
      [0, '0 m'],
      [10, '1 m'],
      [50, '5 m'],
      [150, '15 m'],
      [9999, '1000 m'],
    ])('formatMeters(%i) === %s', (px, expected) => {
      expect(formatMeters(px)).toBe(expected);
    });
  });

  describe('>= 1 km : 1 décimale', () => {
    test.each([
      [10000, '1.0 km'],
      [15000, '1.5 km'],
      [25430, '2.5 km'],
      [99999, '10.0 km'],
    ])('formatMeters(%i) === %s', (px, expected) => {
      expect(formatMeters(px)).toBe(expected);
    });
  });

  test('arrondit les mètres correctement', () => {
    expect(formatMeters(54)).toBe('5 m');
    expect(formatMeters(55)).toBe('6 m');
    expect(formatMeters(549)).toBe('55 m');
  });

  test('PX_PER_METER cohérent', () => {
    expect(formatMeters(PX_PER_METER)).toBe('1 m');
    expect(formatMeters(PX_PER_METER * 100)).toBe('100 m');
    expect(formatMeters(PX_PER_METER * 1000)).toBe('1.0 km');
  });

  test('valeurs négatives → mètres négatifs', () => {
    // edge case : on ne devrait pas en avoir mais ne doit pas planter
    expect(typeof formatMeters(-100)).toBe('string');
  });
});

describe('formatDuration', () => {
  describe('< 60s : sec', () => {
    test.each([
      [0, '0s'],
      [1, '1s'],
      [30, '30s'],
      [59, '59s'],
    ])('formatDuration(%i) === %s', (sec, expected) => {
      expect(formatDuration(sec)).toBe(expected);
    });
  });

  describe('>= 60s : mm:ss', () => {
    test.each([
      [60, '1:00'],
      [61, '1:01'],
      [90, '1:30'],
      [125, '2:05'],
      [605, '10:05'],
      [3600, '60:00'],
      [3661, '61:01'],
    ])('formatDuration(%i) === %s', (sec, expected) => {
      expect(formatDuration(sec)).toBe(expected);
    });
  });

  test('valeur exacte 60s → 1:00 (pas 60s)', () => {
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(60)).not.toBe('60s');
  });

  test('format mm:ss correct (pad zéros)', () => {
    for (let s = 60; s < 70; s++) {
      const out = formatDuration(s);
      expect(out).toMatch(/^\d+:\d{2}$/);
    }
  });
});
