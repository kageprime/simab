// Spawning + combat helpers
import { TILE, ENEMIES } from './data.js';

export function spawnFloorEntities(dungeon, floor, player, rng = Math.random) {
  const enemies = [];
  const pickups = []; // {x,y,type:'gem'|'heart'|'gold', val, vx,vy}
  const chests = [];
  const shots = []; // enemy projectiles handled in main (shared array pattern)
  const isBossFloor = floor % 3 === 0;

  const count = 6 + floor * 3 + Math.floor(rng() * 3);
  const startPx = { x: dungeon.start.x * TILE + TILE / 2, y: dungeon.start.y * TILE + TILE / 2 };

  for (let i = 0; i < count; i++) {
    const t = dungeon.randomFloorTile([{ x: dungeon.start.x, y: dungeon.start.y }]);
    const px = t.x * TILE + TILE / 2, py = t.y * TILE + TILE / 2;
    if (Math.hypot(px - startPx.x, py - startPx.y) < 220) continue;
    // pick type by floor (weighted table — procedural-gen Pattern 3)
    let type = 'slime';
    const r = rng();
    if (floor >= 4 && r < 0.18) type = 'brute';
    else if (floor >= 2 && r < 0.38) type = 'skeleton';
    else if (r < 0.55) type = 'bat';
    else type = 'slime';
    enemies.push(makeEnemy(type, px, py, floor, rng));
  }

  if (isBossFloor) {
    const t = dungeon.randomFloorTile([{ x: dungeon.start.x, y: dungeon.start.y }]);
    enemies.push(makeEnemy('boss', t.x * TILE + 16, t.y * TILE + 16, floor, rng));
  }

  // chests: 2 per floor
  for (let i = 0; i < 2; i++) {
    const t = dungeon.randomFloorTile([{ x: dungeon.start.x, y: dungeon.start.y }]);
    chests.push({ x: t.x * TILE + 16, y: t.y * TILE + 16, opened: false, bob: rng() * 6 });
  }

  // loose hearts
  const hearts = 1 + (rng() < 0.5 ? 1 : 0);
  for (let i = 0; i < hearts; i++) {
    const t = dungeon.randomFloorTile([]);
    pickups.push({ x: t.x * TILE + 16, y: t.y * TILE + 16, type: 'heart', val: 25, vx: 0, vy: 0, bob: 0 });
  }

  return { enemies, pickups, chests, shots };
}

export function makeEnemy(type, x, y, floor, rng = Math.random) {
  const base = ENEMIES[type];
  const scale = 1 + (floor - 1) * 0.15;
  return {
    type,
    x, y,
    hp: Math.floor(base.hp * scale),
    maxHp: Math.floor(base.hp * scale),
    speed: base.speed * (0.9 + rng() * 0.2),
    damage: Math.floor(base.damage * (1 + (floor - 1) * 0.12)),
    xp: base.xp, gold: base.gold,
    radius: base.radius,
    color: base.color, icon: base.icon, name: base.name,
    erratic: !!base.erratic, ranged: !!base.ranged, charge: !!base.charge,
    shootCd: base.shootCd || 0, shootT: 1 + rng() * 2,
    chargeT: 0, chargeDx: 0, chargeDy: 0, stateT: rng() * 2,
    hitT: 0, knockX: 0, knockY: 0,
    spawnT: 0,
  };
}

export function burst(particles, x, y, color, n = 10, spd = 160) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = spd * (0.3 + Math.random() * 0.7);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.3, max: 0.7, color, size: 3 + Math.random() * 3 });
  }
}
