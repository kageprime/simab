// Procedural dungeon: rooms + corridors on a tile grid. 0=wall, 1=floor.
// Deterministic: pass an rng() (procedural-gen Pattern 1). Same seed+floor => same map.
import { MAP_W, MAP_H } from './data.js';
import { hashSeed, makeRng } from './data.js';

export function genDungeon(floor, seed = 'daily', rng = null) {
  const rand = rng || makeRng(hashSeed(`${seed}:${floor}`));
  const grid = new Uint8Array(MAP_W * MAP_H); // 0 wall
  const rooms = [];
  const roomCount = 7 + Math.min(5, floor);
  let tries = 0;
  while (rooms.length < roomCount && tries < 300) {
    tries++;
    const w = 4 + Math.floor(rand() * 7);
    const h = 4 + Math.floor(rand() * 6);
    const x = 1 + Math.floor(rand() * (MAP_W - w - 2));
    const y = 1 + Math.floor(rand() * (MAP_H - h - 2));
    // overlap check (1 tile padding)
    let overlap = false;
    for (const o of rooms) {
      if (x - 1 < o.x + o.w && x + w + 1 > o.x && y - 1 < o.y + o.h && y + h + 1 > o.y) { overlap = true; break; }
    }
    if (overlap) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++)
        grid[yy * MAP_W + xx] = 1;
  }
  // connect rooms in order + one loop
  function hCorr(x1, x2, y) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      grid[y * MAP_W + x] = 1;
      if (y + 1 < MAP_H) grid[(y + 1) * MAP_W + x] = 1;
    }
  }
  function vCorr(y1, y2, x) {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      grid[y * MAP_W + x] = 1;
      if (x + 1 < MAP_W) grid[y * MAP_W + x + 1] = 1;
    }
  }
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    if (rand() < 0.5) { hCorr(a.cx, b.cx, a.cy); vCorr(a.cy, b.cy, b.cx); }
    else { vCorr(a.cy, b.cy, a.cx); hCorr(a.cx, b.cx, b.cy); }
  }
  if (rooms.length > 3) {
    const a = rooms[0], b = rooms[rooms.length - 1];
    hCorr(a.cx, b.cx, a.cy);
  }
  // connectivity: flood-fill from start, carve to any unreachable floor (pitfall fix)
  (function ensureConnected() {
    const start = rooms[0].cx + rooms[0].cy * MAP_W;
    const seen = new Uint8Array(MAP_W * MAP_H);
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const c = stack.pop();
      const cx = c % MAP_W, cy = (c / MAP_W) | 0;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [ox, oy] of nb) {
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const ni = ny * MAP_W + nx;
        if (!seen[ni] && grid[ni] === 1) { seen[ni] = 1; stack.push(ni); }
      }
    }
    // any floor tile unseen => carve L-corridor from it to start center
    const sx = rooms[0].cx, sy = rooms[0].cy;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (grid[y * MAP_W + x] === 1 && !seen[y * MAP_W + x]) {
        for (let xx = Math.min(x, sx); xx <= Math.max(x, sx); xx++) grid[sy * MAP_W + xx] = 1;
        for (let yy = Math.min(y, sy); yy <= Math.max(y, sy); yy++) grid[yy * MAP_W + x] = 1;
        return ensureConnected(); // re-check after repair (depth 1-2 max)
      }
    }
  })();

  const idx = (x, y) => y * MAP_W + x;
  const isFloor = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && grid[idx(x, y)] === 1;

  function randomFloorTile(avoidRooms = []) {
    for (let t = 0; t < 500; t++) {
      const rm = rooms[Math.floor(rand() * rooms.length)];
      const x = rm.x + Math.floor(rand() * rm.w);
      const y = rm.y + Math.floor(rand() * rm.h);
      let bad = false;
      for (const a of avoidRooms) { if (Math.abs(a.x - x) + Math.abs(a.y - y) < 4) { bad = true; break; } }
      if (!bad) return { x, y };
    }
    const r0 = rooms[0];
    return { x: r0.cx, y: r0.cy };
  }

  const startRoom = rooms[0];
  const endRoom = rooms[rooms.length - 1];
  const start = { x: startRoom.cx, y: startRoom.cy };
  const stairs = { x: endRoom.cx, y: endRoom.cy };

  return { grid, rooms, start, stairs, isFloor, randomFloorTile };
}

export function collideCircle(grid, x, y, radius, tileSize) {
  // resolve vs walls, returns corrected x,y
  const minTx = Math.floor((x - radius) / tileSize);
  const maxTx = Math.floor((x + radius) / tileSize);
  const minTy = Math.floor((y - radius) / tileSize);
  const maxTy = Math.floor((y + radius) / tileSize);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const wall = tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || grid[ty * MAP_W + tx] === 0;
      if (!wall) continue;
      const nx = Math.max(tx * tileSize, Math.min(x, tx * tileSize + tileSize));
      const ny = Math.max(ty * tileSize, Math.min(y, ty * tileSize + tileSize));
      const dx = x - nx, dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        x += dx * push; y += dy * push;
      }
    }
  }
  return { x, y };
}
