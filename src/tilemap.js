// Système de tiles : map 128×128 procédurale + pathfinding A*.

export const TILES = {
  WATER: 0,
  BEACH: 1,
  PLAIN: 2,
  FOREST: 3,
  ROCK: 4,
  VOLCANO: 5,
};

export const WALKABLE = {
  0: false,
  1: true,
  2: true,
  3: true,
  4: false,
  5: false,
};

export const WALK_COST   = { 1: 1.0, 2: 1.0, 3: 1.33 };
export const SPEED_MUL_TILE = { 1: 1.0, 2: 1.0, 3: 0.75 };

export const TILE_COLORS = {
  0: '#bce0e8', // water
  1: '#faead0', // beach
  2: '#e0eaa8', // plain
  3: '#9ec99e', // forest
  4: '#bcb6b0', // rock
  5: '#8a7a7e', // volcano
};

export const TILE_PX = 50;
export const MAP_W   = 128;
export const MAP_H   = 128;

// PRNG LCG seedé
function makeRand(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// Bruit lissé (interpolation bilinéaire sur grille basse résolution)
function smoothedNoise(W, H, scale, rand) {
  const lW = Math.ceil(W / scale) + 2;
  const lH = Math.ceil(H / scale) + 2;
  const low = new Float32Array(lW * lH);
  for (let i = 0; i < low.length; i++) low[i] = rand();
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = x / scale, fy = y / scale;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy;
      const a = low[iy * lW + ix],       b = low[iy * lW + (ix+1)];
      const c = low[(iy+1) * lW + ix],   d = low[(iy+1) * lW + (ix+1)];
      const sx = tx*tx*(3-2*tx), sy = ty*ty*(3-2*ty);
      out[y*W+x] = (a*(1-sx)+b*sx)*(1-sy) + (c*(1-sx)+d*sx)*sy;
    }
  }
  return out;
}

function buildDemoMap() {
  const tiles = new Uint8Array(MAP_W * MAP_H);
  tiles.fill(TILES.PLAIN);

  const cx = MAP_W / 2, cy = MAP_H / 2;
  const noiseCoast = smoothedNoise(MAP_W, MAP_H, MAP_W / 6, makeRand(2222));
  const noiseFor   = smoothedNoise(MAP_W, MAP_H, MAP_W / 9, makeRand(3333));
  const noiseMtn   = smoothedNoise(MAP_W, MAP_H, MAP_W / 14, makeRand(9999));
  const noiseLake  = smoothedNoise(MAP_W, MAP_H, MAP_W / 10, makeRand(6543));
  const noiseRiv   = smoothedNoise(MAP_W, MAP_H, MAP_W / 12, makeRand(8888));

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const ndx = (x - cx) / (MAP_W * 0.46);
      const ndy = (y - cy) / (MAP_H * 0.46);
      const dist = Math.sqrt(ndx*ndx + ndy*ndy);
      const coast = noiseCoast[y*MAP_W+x];
      const edgeDist = dist + (coast - 0.5) * 0.18;
      if (edgeDist > 0.95) {
        tiles[y*MAP_W+x] = TILES.WATER;
      } else if (edgeDist > 0.82) {
        tiles[y*MAP_W+x] = TILES.BEACH;
      }
    }
  }

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = tiles[y*MAP_W+x];
      if (t !== TILES.PLAIN) continue;
      if (noiseFor[y*MAP_W+x] > 0.42) tiles[y*MAP_W+x] = TILES.FOREST;
    }
  }

  {
    const rand = makeRand(4321);
    const MARGIN = 8;
    for (let c = 0; c < 10; c++) {
      const qx = MARGIN + Math.floor(rand() * (MAP_W - MARGIN*2));
      const qy = MARGIN + Math.floor(rand() * (MAP_H - MARGIN*2));
      const r  = 3 + Math.floor(rand() * 3);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = qx+dx, y = qy+dy;
          if (x < MARGIN || y < MARGIN || x >= MAP_W-MARGIN || y >= MAP_H-MARGIN) continue;
          const tt = tiles[y*MAP_W+x];
          if (tt === TILES.WATER || tt === TILES.BEACH) continue;
          const n = noiseMtn[y*MAP_W+x];
          if (Math.sqrt(dx*dx+dy*dy) <= r*(0.5+n*0.6)) tiles[y*MAP_W+x] = TILES.ROCK;
        }
      }
    }
    for (let v = 0; v < 2; v++) {
      const qx = MARGIN + Math.floor(rand() * (MAP_W - MARGIN*2));
      const qy = MARGIN + Math.floor(rand() * (MAP_H - MARGIN*2));
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = qx+dx, y = qy+dy;
          if (x < MARGIN || y < MARGIN || x >= MAP_W-MARGIN || y >= MAP_H-MARGIN) continue;
          if (Math.sqrt(dx*dx+dy*dy) <= 2) tiles[y*MAP_W+x] = TILES.VOLCANO;
        }
      }
    }
  }

  {
    const LMARGIN = 12;
    for (let y = LMARGIN; y < MAP_H-LMARGIN; y++) {
      for (let x = LMARGIN; x < MAP_W-LMARGIN; x++) {
        if (tiles[y*MAP_W+x] === TILES.WATER || tiles[y*MAP_W+x] === TILES.BEACH) continue;
        if (noiseLake[y*MAP_W+x] > 0.79) tiles[y*MAP_W+x] = TILES.WATER;
      }
    }
  }

  {
    const rand = makeRand(1122);
    const MARGIN = 10;
    for (let i = 0; i < 3; i++) {
      const sx = MARGIN + Math.floor(rand() * (MAP_W - MARGIN*2));
      const sy = MARGIN + Math.floor(rand() * (MAP_H - MARGIN*2));
      const side = Math.floor(rand() * 4);
      let ex, ey;
      switch (side) {
        case 0: ex = Math.floor(rand()*MAP_W); ey = 0; break;
        case 1: ex = Math.floor(rand()*MAP_W); ey = MAP_H-1; break;
        case 2: ex = 0; ey = Math.floor(rand()*MAP_H); break;
        default: ex = MAP_W-1; ey = Math.floor(rand()*MAP_H); break;
      }
      const ddx = ex-sx, ddy = ey-sy;
      const len = Math.sqrt(ddx*ddx+ddy*ddy) || 1;
      for (let s = 0; s <= MAP_W; s++) {
        const t  = s / MAP_W;
        const bx = sx + ddx*t, by = sy + ddy*t;
        const off = (noiseRiv[Math.min(MAP_W*MAP_H-1, Math.floor(by)*MAP_W+Math.floor(bx))]-0.5)*8;
        const px = Math.round(Math.max(0, Math.min(MAP_W-1, bx + off*(-ddy/len))));
        const py = Math.round(Math.max(0, Math.min(MAP_H-1, by + off*(ddx/len))));
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (Math.abs(ox)+Math.abs(oy) > 1) continue;
            const nx = px+ox, ny = py+oy;
            if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
            tiles[ny*MAP_W+nx] = TILES.WATER;
          }
        }
      }
    }
  }

  const tmp = new Uint8Array(MAP_W * MAP_H);
  const counts = new Uint8Array(6);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        counts.fill(0);
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = x+ox, ny = y+oy;
            if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
            counts[tiles[ny*MAP_W+nx]]++;
          }
        }
        let best = tiles[y*MAP_W+x], bestC = 0;
        for (let k = 0; k < 6; k++) { if (counts[k] > bestC) { bestC = counts[k]; best = k; } }
        tmp[y*MAP_W+x] = best;
      }
    }
    tiles.set(tmp);
  }

  const spawnX = Math.floor(MAP_W/2), spawnY = Math.floor(MAP_H/2);
  const spawnR = Math.max(3, Math.floor(MAP_W/50));
  for (let oy = -spawnR; oy <= spawnR; oy++) {
    for (let ox = -spawnR; ox <= spawnR; ox++) {
      const xx = spawnX+ox, yy = spawnY+oy;
      if (xx >= 0 && xx < MAP_W && yy >= 0 && yy < MAP_H) tiles[yy*MAP_W+xx] = TILES.PLAIN;
    }
  }

  return tiles;
}

export const TILES_DATA = buildDemoMap();

// === Pathfinding A* + tas binaire min ===
function octile(ax, ay, bx, by) {
  const dx = Math.abs(ax-bx), dy = Math.abs(ay-by);
  return (dx+dy) + (Math.SQRT2-2)*Math.min(dx,dy);
}

class MinHeap {
  constructor() { this.a = []; }
  push(item) {
    const a = this.a; a.push(item); let i = a.length-1;
    while (i > 0) { const p=(i-1)>>1; if (a[i][0]<a[p][0]) { const t=a[i];a[i]=a[p];a[p]=t;i=p; } else break; }
  }
  pop() {
    const a = this.a; if (!a.length) return null;
    const top = a[0], last = a.pop();
    if (a.length) {
      a[0]=last; let i=0, n=a.length;
      while (true) {
        const l=2*i+1, r=2*i+2; let b=i;
        if (l<n&&a[l][0]<a[b][0]) b=l;
        if (r<n&&a[r][0]<a[b][0]) b=r;
        if (b!==i) { const t=a[i];a[i]=a[b];a[b]=t;i=b; } else break;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

// findPath avec support sillons optionnel.
// sillons = objet { 'cx,cy': { count } } — optionnel, passe null si non disponible.
export function findPath(tiles, W, H, sx, sy, tx, ty, sillons = null) {
  sx=Math.round(sx); sy=Math.round(sy); tx=Math.round(tx); ty=Math.round(ty);
  if (sx===tx&&sy===ty) return [{x:tx,y:ty}];
  if (tx<0||tx>=W||ty<0||ty>=H) return null;
  if (!WALKABLE[tiles[ty*W+tx]]) {
    let best=null, bestD=Infinity;
    for (let r=1; r<6; r++) {
      for (let yy=ty-r; yy<=ty+r; yy++) for (let xx=tx-r; xx<=tx+r; xx++) {
        if (xx<0||xx>=W||yy<0||yy>=H) continue;
        if (WALKABLE[tiles[yy*W+xx]]) { const d=Math.hypot(xx-tx,yy-ty); if (d<bestD){bestD=d;best={x:xx,y:yy};} }
      }
      if (best) break;
    }
    if (!best) return null;
    tx=best.x; ty=best.y;
  }
  const N=W*H;
  const gScore=new Float32Array(N); gScore.fill(Infinity);
  const prev=new Int32Array(N); prev.fill(-1);
  const closed=new Uint8Array(N);
  const startIdx=sy*W+sx, targetIdx=ty*W+tx;
  gScore[startIdx]=0;
  const open=new MinHeap();
  open.push([octile(sx,sy,tx,ty),startIdx]);
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
  let found=false;
  while (open.size>0) {
    const [,idx]=open.pop();
    if (closed[idx]) continue;
    if (idx===targetIdx){found=true;break;}
    closed[idx]=1;
    const x=idx%W, y=(idx/W)|0, gCur=gScore[idx];
    for (let d=0;d<8;d++) {
      const ddx=dirs[d][0],ddy=dirs[d][1],nx=x+ddx,ny=y+ddy;
      if (nx<0||nx>=W||ny<0||ny>=H) continue;
      const ni=ny*W+nx; if (closed[ni]) continue;
      const tt=tiles[ni];
      // L'eau est désormais traversable grâce aux sillons/ponts
      if (tt === 0 /* WATER */) {
        if (!sillons) continue; // Pas de sillons → infranchissable comme avant
        const count = sillons[`${nx},${ny}`]?.count ?? 0;
        if (count < 10) continue; // Pas assez de passages pour un pont
      } else if (!WALKABLE[tt]) continue;
      if (ddx&&ddy&&(!WALKABLE[tiles[y*W+nx]]||!WALKABLE[tiles[ny*W+x]])) continue;
      const stepDist=(ddx&&ddy)?Math.SQRT2:1;
      const baseCost = WALK_COST[tt] || 1;
      // Coût réduit par les sillons (chemin rapide = moins coûteux pour A*)
      let sillonMul = 1;
      if (sillons) {
        const count = sillons[`${nx},${ny}`]?.count ?? 0;
        if (count >= 5)   sillonMul = 1 / 1.15;
        if (count >= 20)  sillonMul = 1 / 1.50;
        if (count >= 60)  sillonMul = 1 / 2.00;
        if (count >= 150) sillonMul = 1 / 3.00;
      }
      const ng=gCur+stepDist*baseCost*sillonMul;
      if (ng<gScore[ni]) {
        gScore[ni]=ng; prev[ni]=idx;
        open.push([ng+octile(nx,ny,tx,ty),ni]);
      }
    }
  }
  if (!found) return null;
  const path=[]; let cur=targetIdx;
  while (cur!==-1){path.push({x:cur%W,y:(cur/W)|0});cur=prev[cur];}
  return path.reverse();
}

function lineOfSight(a, b, tiles, W) {
  const dx=b.x-a.x, dy=b.y-a.y;
  const steps=Math.max(Math.abs(dx),Math.abs(dy))*2;
  for (let i=1;i<steps;i++) {
    const t=i/steps;
    if (!WALKABLE[tiles[Math.round(a.y+dy*t)*W+Math.round(a.x+dx*t)]]) return false;
  }
  return true;
}
