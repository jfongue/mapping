import {
  getSillonLevel,
  getSpeedMul,
  incrementPath,
  erosionTick,
  sillonStats,
  SILLON_LEVELS,
  BRIDGE_LEVELS,
  EROSION_DELAY_MS,
} from '../sillons';
import { TILES } from '../tilemap';

// --- getSillonLevel ---
test('terrain vierge → level vierge', () => {
  expect(getSillonLevel(0, TILES.PLAIN).label).toBe('vierge');
});

test('5 passages → sentier', () => {
  expect(getSillonLevel(5, TILES.PLAIN).label).toBe('sentier');
});

test('150 passages → pavé', () => {
  expect(getSillonLevel(150, TILES.PLAIN).label).toBe('pavé');
});

test('eau 0 passages → vitesse 0.10', () => {
  expect(getSillonLevel(0, TILES.WATER).speedMul).toBe(0.10);
});

test('eau 100 passages → pont-pierre vitesse 1.00', () => {
  expect(getSillonLevel(100, TILES.WATER).label).toBe('pont-pierre');
  expect(getSillonLevel(100, TILES.WATER).speedMul).toBe(1.00);
});

// --- incrementPath ---
test('incrementPath ajoute 1 passage par cellule', () => {
  const path = [{ x: 10, y: 20 }, { x: 11, y: 20 }];
  const result = incrementPath({}, path);
  expect(result['10,20'].count).toBe(1);
  expect(result['11,20'].count).toBe(1);
});

test('incrementPath cumule les passages', () => {
  const base = { '5,5': { count: 4, lastUsed: Date.now() } };
  const result = incrementPath(base, [{ x: 5, y: 5 }]);
  expect(result['5,5'].count).toBe(5);
  expect(getSillonLevel(result['5,5'].count, TILES.PLAIN).label).toBe('sentier');
});

test('incrementPath ne dépasse pas 65535', () => {
  const base = { '1,1': { count: 65535, lastUsed: Date.now() } };
  const result = incrementPath(base, [{ x: 1, y: 1 }]);
  expect(result['1,1'].count).toBe(65535);
});

// --- erosionTick ---
test('érosion ne touche pas les cellules récentes', () => {
  const sillons = { '3,3': { count: 50, lastUsed: Date.now() } };
  const { changed } = erosionTick(sillons);
  expect(changed).toBe(false);
});

test('érosion décrémente cellule ancienne', () => {
  const old = Date.now() - EROSION_DELAY_MS - 1000;
  const sillons = { '3,3': { count: 10, lastUsed: old } };
  const { next, changed } = erosionTick(sillons);
  expect(changed).toBe(true);
  expect(next['3,3'].count).toBe(9);
});

test('érosion supprime cellule à count 1', () => {
  const old = Date.now() - EROSION_DELAY_MS - 1000;
  const sillons = { '3,3': { count: 1, lastUsed: old } };
  const { next } = erosionTick(sillons);
  expect(next['3,3']).toBeUndefined();
});

// --- getSpeedMul ---
test('getSpeedMul sans sillon → 1', () => {
  expect(getSpeedMul({}, 5, 5, TILES.PLAIN)).toBe(1);
});

test('getSpeedMul sentier → 1.15', () => {
  const sillons = { '5,5': { count: 10, lastUsed: Date.now() } };
  expect(getSpeedMul(sillons, 5, 5, TILES.PLAIN)).toBe(1.15);
});

// --- sillonStats ---
test('sillonStats objet vide', () => {
  const stats = sillonStats({});
  expect(stats.total).toBe(0);
});

test('sillonStats retourne le bon total', () => {
  const sillons = {
    '1,1': { count: 5, lastUsed: Date.now() },
    '2,2': { count: 60, lastUsed: Date.now() },
  };
  const stats = sillonStats(sillons);
  expect(stats.total).toBe(2);
  expect(stats.maxCount).toBe(60);
});
