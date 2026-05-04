// Conversions et calculs caméra (pur, testable).
// La map applique : screen = (mapPoint + camOffset) * scale.

// Convertit un point map → écran.
export const mapToScreen = (mapX, mapY, camX, camY, scale) => ({
  x: (mapX + camX) * scale,
  y: (mapY + camY) * scale,
});

// Inverse : écran → map.
export const screenToMap = (screenX, screenY, camX, camY, scale) => ({
  x: screenX / scale - camX,
  y: screenY / scale - camY,
});

// Offset caméra à appliquer pour que un point map soit au centre écran.
// Vu que la map fait translate AVANT scale : screen = (map + cam) * s
// → on veut screen = vp/2, donc cam = vp/(2*s) - map
export const cameraToCenter = (mapX, mapY, viewportW, viewportH, scale) => ({
  x: viewportW / (2 * scale) - mapX,
  y: viewportH / (2 * scale) - mapY,
});

// Clamp un scale dans [min, max].
export const clampScale = (s, min, max) => Math.max(min, Math.min(max, s));

// Vérifie qu'un point map est dans le viewport actuel.
export const isInViewport = (mapX, mapY, camX, camY, scale, viewportW, viewportH) => {
  const { x, y } = mapToScreen(mapX, mapY, camX, camY, scale);
  return x >= 0 && x <= viewportW && y >= 0 && y <= viewportH;
};

// Position d'une flèche au bord de l'écran pointant vers un point map hors viewport.
// Renvoie { x, y, angle } en coords écran (angle en degrés).
export const edgeArrowPosition = (mapX, mapY, camX, camY, scale, viewportW, viewportH, padding = 28) => {
  const { x: sx, y: sy } = mapToScreen(mapX, mapY, camX, camY, scale);
  const cx = viewportW / 2, cy = viewportH / 2;
  const vx = sx - cx, vy = sy - cy;
  const len = Math.hypot(vx, vy) || 1;
  const ux = vx / len, uy = vy / len;
  const halfW = viewportW / 2 - padding;
  const halfH = viewportH / 2 - padding;
  const t1 = ux !== 0 ? halfW / Math.abs(ux) : Infinity;
  const t2 = uy !== 0 ? halfH / Math.abs(uy) : Infinity;
  const t = Math.min(t1, t2);
  return {
    x: cx + ux * t,
    y: cy + uy * t,
    angle: Math.atan2(uy, ux) * 180 / Math.PI,
  };
};
