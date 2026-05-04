// PRNG seedé (déterministe) — algorithme mulberry32.
// Renvoie une fonction () => number ∈ [0, 1).
export function rng(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bruit de valeur 2D : interpolation lissée d'une grille de valeurs aléatoires.
// Renvoie (x, y) → number ∈ [0, 1).
export function valueNoise(seed) {
  const cache = {};
  function valAt(ix, iy) {
    const k = ix + ',' + iy;
    if (cache[k] === undefined) {
      cache[k] = rng(seed + ix * 374761393 + iy * 668265263)();
    }
    return cache[k];
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  return function (x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const v00 = valAt(ix, iy);
    const v10 = valAt(ix + 1, iy);
    const v01 = valAt(ix, iy + 1);
    const v11 = valAt(ix + 1, iy + 1);
    const u = smooth(fx), v = smooth(fy);
    return (
      v00 * (1 - u) * (1 - v) +
      v10 * u * (1 - v) +
      v01 * (1 - u) * v +
      v11 * u * v
    );
  };
}
