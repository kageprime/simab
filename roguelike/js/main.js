import { TILE, MAP_W, MAP_H, MAX_FLOOR, COLORS, WEAPONS, UPGRADES, makePlayer, xpForLevel, hashSeed, makeRng, getSeedFromURL, randomSeed } from './data.js';
import { genDungeon, collideCircle } from './dungeon.js';
import { spawnFloorEntities, makeEnemy, burst } from './entities.js';
import { initInput, keys, moveVec, getAim, updateMouseEdge, consumePressed, clearPressed } from './input.js';
import { pxRect, pxText, pxButton, bar, emoji, particles as drawParticles, damageNumbers } from './renderer.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const FOV_RADIUS = 9;

// ---- Profile (save-systems): run state is wiped on death; only this persists ----
const PROFILE_KEY = 'dungeon-delver-profile-v1';
const PROFILE_VERSION = 1;
function loadProfile() {
  const d = { version: 1, bestFloor: 0, bestKills: 0, bestGold: 0, fastestWin: 0, totalRuns: 0, wins: 0 };
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return d;
    const p = JSON.parse(raw);
    if (typeof p !== 'object' || p === null) return d;
    for (const k of ['bestFloor', 'bestKills', 'bestGold', 'fastestWin', 'totalRuns', 'wins']) {
      if (typeof p[k] === 'number' && isFinite(p[k]) && p[k] >= 0) d[k] = Math.floor(p[k]);
    }
    return d;
  } catch (e) { return d; }
}
function saveProfile() {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, version: PROFILE_VERSION })); } catch (e) { /* private mode — ignore */ }
}
let profile = loadProfile();
function recordRun(won) {
  profile.totalRuns++;
  profile.bestFloor = Math.max(profile.bestFloor, floor);
  profile.bestKills = Math.max(profile.bestKills, player.kills);
  profile.bestGold = Math.max(profile.bestGold, player.gold);
  if (won) {
    profile.wins++;
    if (!profile.fastestWin || runTime < profile.fastestWin) profile.fastestWin = Math.floor(runTime);
  }
  saveProfile();
}

let state = 'title'; // title | playing | levelup | dead | win
let floor = 1;
let player = makePlayer();
let runSeed = getSeedFromURL() || randomSeed();
let pendingSeed = runSeed; // seed the next run will use (N = reroll on title)
let floorRng = Math.random;
let explored = new Set(); // tile idx ever seen this floor
let visible = new Set(); // tile idx visible right now
let dungeon = null;
let enemies = [], pickups = [], chests = [], shots = [], pshots = [];
let particleList = [], dmgNums = [];
let trauma = 0, shake = 0, time = 0, hitStop = 0;
let levelChoices = [];
let stairsMsg = 0, chestMsg = '', chestMsgT = 0;
let runTime = 0;

function addTrauma(a) { trauma = Math.min(1, trauma + a); }

function startRun(seed = null) {
  runSeed = seed || pendingSeed || randomSeed();
  pendingSeed = runSeed;
  floor = 1;
  player = makePlayer();
  runTime = 0;
  trauma = 0; hitStop = 0;
  loadFloor(1);
  state = 'playing';
}

function loadFloor(f) {
  floor = f;
  floorRng = makeRng(hashSeed(`${runSeed}:${f}`));
  dungeon = genDungeon(f, runSeed);
  const s = spawnFloorEntities(dungeon, f, player, floorRng);
  enemies = s.enemies; pickups = s.pickups; chests = s.chests; shots = [];
  pshots = []; particleList = []; dmgNums = [];
  player.x = dungeon.start.x * TILE + TILE / 2;
  player.y = dungeon.start.y * TILE + TILE / 2;
  player.dashCd = 0; player.iframes = 0; player.attackCd = 0;
  stairsMsg = 0;
  explored = new Set(); visible = new Set();
  computeFov();
}

function offerLevels() {
  const pool = [...UPGRADES];
  // don't offer owned weapons logic — all upgrades stackable, fine
  levelChoices = [];
  for (let i = 0; i < 3; i++) {
    const k = Math.floor(Math.random() * pool.length);
    levelChoices.push(pool.splice(k, 1)[0]);
  }
  state = 'levelup';
}

function gainXp(v) {
  player.xp += v;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext;
    player.level++;
    player.xpNext = xpForLevel(player.level);
    offerLevels();
    break; // handle one at a time; leftover xp kept
  }
}

function playerAttack(aimWx, aimWy) {
  const w = WEAPONS[player.weapon];
  if (player.attackCd > 0) return;
  player.attackCd = w.cooldown * player.rateMult;
  const dx = aimWx - player.x, dy = aimWy - player.y;
  const ang = Math.atan2(dy, dx);
  player.faceX = Math.cos(ang); player.faceY = Math.sin(ang);
  const dmg = Math.round(w.damage * player.dmgMult);

  if (!w.projectile) {
    player.swingT = 0.18;
    addTrauma(0.08);
    let hitAny = false;
    for (const e of enemies) {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d > w.range + e.radius) continue;
      const ea = Math.atan2(e.y - player.y, e.x - player.x);
      let diff = Math.abs(ea - ang);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < w.arc) {
        damageEnemy(e, dmg, ang);
        hitAny = true;
      }
    }
    burst(particleList, player.x + Math.cos(ang) * 40, player.y + Math.sin(ang) * 40, '#e2e8f0', hitAny ? 8 : 3, 120);
  } else {
    const n = (w.multishot || 1) + player.bonusShots;
    const pierce = (w.pierce || 0) + player.bonusPierce;
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * 0.12;
      const a = ang + spread + (Math.random() - 0.5) * 0.03;
      pshots.push({
        x: player.x, y: player.y, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
        damage: dmg, life: w.range / w.speed, pierce, color: w.color,
        radius: w.radius || 4, fire: player.weapon === 'staff',
      });
    }
  }
}

function damageEnemy(e, dmg, ang) {
  let crit = false;
  if (Math.random() < player.crit) { dmg *= 2; crit = true; }
  e.hp -= dmg;
  e.hitT = 0.12;
  e.knockX += Math.cos(ang) * 220;
  e.knockY += Math.sin(ang) * 220;
  dmgNums.push({ x: e.x, y: e.y - 14, text: crit ? dmg + '!' : dmg, color: crit ? '#fbbf24' : '#fff', life: 0.7, max: 0.7, crit });
  burst(particleList, e.x, e.y, e.color, 4, 140);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  player.kills++;
  player.gold += e.gold;
  burst(particleList, e.x, e.y, e.color, 14, 200);
  // drop gem + maybe heart/gold
  pickups.push({ x: e.x, y: e.y, type: 'gem', val: e.xp, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, bob: 0 });
  if (Math.random() < 0.12) pickups.push({ x: e.x, y: e.y, type: 'heart', val: 12, vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100, bob: 0 });
  if (e.type === 'boss') {
    for (let i = 0; i < 5; i++) pickups.push({ x: e.x + (Math.random() - 0.5) * 40, y: e.y + (Math.random() - 0.5) * 40, type: 'gold', val: 20, vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 140, bob: 0 });
    pickups.push({ x: e.x, y: e.y - 20, type: 'heart', val: 40, vx: 0, vy: -40, bob: 0 });
  }
  if (e.type === 'boss') { addTrauma(0.7); hitStop = Math.max(hitStop, 0.14); }
  else { addTrauma(0.25); hitStop = Math.max(hitStop, 0.05); }
}

function hurtPlayer(dmg) {
  if (player.iframes > 0 || player.dashTime > 0 || state !== 'playing') return;
  player.hp -= dmg;
  player.iframes = 0.6;
  addTrauma(0.45);
  hitStop = Math.max(hitStop, 0.07);
  burst(particleList, player.x, player.y, '#ef4444', 10, 180);
  dmgNums.push({ x: player.x, y: player.y - 18, text: '-' + dmg, color: '#f87171', life: 0.7, max: 0.7, crit: false });
  if (player.hp <= 0) { player.hp = 0; state = 'dead'; recordRun(false); }
}

function openChest(c) {
  c.opened = true;
  const locked = ['sword', 'bow', 'staff'].filter((w) => !player.weaponsOwned.includes(w));
  if (locked.length && Math.random() < 0.45) {
    const w = locked[Math.floor(Math.random() * locked.length)];
    player.weaponsOwned.push(w);
    player.weapon = w;
    chestMsg = `${WEAPONS[w].icon} Found ${WEAPONS[w].name}! (press 1-3)`;
  } else {
    const r = Math.random();
    if (r < 0.4) { player.gold += 40 + floor * 15; chestMsg = `💰 +${40 + floor * 15} gold!`; }
    else if (r < 0.7) { player.maxHp += 10; player.hp = Math.min(player.maxHp, player.hp + 40); chestMsg = '❤️ Max HP up + healed!'; }
    else { player.dmgMult *= 1.1; chestMsg = '⚔️ Damage +10%!'; }
  }
  chestMsgT = 3;
  burst(particleList, c.x, c.y, '#fbbf24', 16, 180);
}

function update(dt) {
  time += dt;
  if (state !== 'playing') return;
  runTime += dt;

  // regen
  if (player.regen > 0) player.hp = Math.min(player.maxHp, player.hp + player.regen * dt);

  // movement
  const mv = moveVec();
  const dashing = player.dashTime > 0;
  const spd = dashing ? 520 : player.speed;
  let nx = player.x + (dashing ? player.dashDx * spd * dt : mv.x * spd * dt);
  let ny = player.y + (dashing ? player.dashDy * spd * dt : mv.y * spd * dt);
  const res = collideCircle(dungeon.grid, nx, ny, player.radius, TILE);
  player.x = res.x; player.y = res.y;

  if (player.dashTime > 0) player.dashTime -= dt;
  if (player.dashCd > 0) player.dashCd -= dt;
  if (player.iframes > 0) player.iframes -= dt;
  if (player.attackCd > 0) player.attackCd -= dt;
  if (player.swingT > 0) player.swingT -= dt;

  // dash trigger
  if ((consumePressed(' ') || consumePressed('shift')) && player.dashCd <= 0) {
    let dx = mv.x, dy = mv.y;
    if (dx === 0 && dy === 0) { dx = player.faceX; dy = player.faceY; }
    const l = Math.hypot(dx, dy) || 1;
    player.dashDx = dx / l; player.dashDy = dy / l;
    player.dashTime = 0.16; player.dashCd = player.dashCdMax; player.iframes = Math.max(player.iframes, 0.22);
    burst(particleList, player.x, player.y, '#22d3ee', 8, 140);
  }

  // camera-relative aim -> world
  const cam = getCam();
  const aim = getAim();
  const aimWx = aim.x + cam.x, aimWy = aim.y + cam.y;

  // attack
  if (aim.pressed || keys['j']) {
    const dx = aimWx - player.x, dy = aimWy - player.y;
    if (Math.hypot(dx, dy) > 4) { player.faceX = dx / Math.hypot(dx, dy); player.faceY = dy / Math.hypot(dx, dy); }
    playerAttack(aimWx, aimWy);
  } else if (aim.down) {
    const dx = aimWx - player.x, dy = aimWy - player.y;
    if (Math.hypot(dx, dy) > 4) { player.faceX = dx / Math.hypot(dx, dy); player.faceY = dy / Math.hypot(dx, dy); }
    playerAttack(aimWx, aimWy);
  }

  // weapon swap
  if (consumePressed('1') && player.weaponsOwned[0]) player.weapon = player.weaponsOwned[0];
  if (consumePressed('2') && player.weaponsOwned[1]) player.weapon = player.weaponsOwned[1];
  if (consumePressed('3') && player.weaponsOwned[2]) player.weapon = player.weaponsOwned[2];

  // interact: chest + stairs
  if (consumePressed('e')) {
    for (const c of chests) {
      if (!c.opened && Math.hypot(c.x - player.x, c.y - player.y) < 52) { openChest(c); break; }
    }
    const sx = dungeon.stairs.x * TILE + 16, sy = dungeon.stairs.y * TILE + 16;
    if (Math.hypot(sx - player.x, sy - player.y) < 52) {
      if (enemies.some((e) => !e.dead && e.type === 'boss' && floor % 3 === 0)) { stairsMsg = 2; chestMsg = '🐲 Slay the boss first!'; chestMsgT = 2; }
      else if (floor >= MAX_FLOOR) { state = 'win'; recordRun(true); }
      else { loadFloor(floor + 1); chestMsg = `⬇️ Floor ${floor}!`; chestMsgT = 2; }
    }
  }
  if (stairsMsg > 0) stairsMsg -= dt;
  if (chestMsgT > 0) chestMsgT -= dt;

  updateEnemies(dt);
  updateShots(dt);
  updatePickups(dt);
  computeFov();

  // particles
  for (const p of particleList) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
  particleList = particleList.filter((p) => p.life > 0);
  for (const d of dmgNums) d.life -= dt;
  dmgNums = dmgNums.filter((d) => d.life > 0);
  // trauma shake (game-feel): quadratic, decays to rest
  trauma = Math.max(0, trauma - dt * 1.4);
  shake = trauma * trauma * 14;
  clearPressed();
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.hitT > 0) e.hitT -= dt;
    e.stateT += dt;
    // knockback decay
    e.x += e.knockX * dt; e.y += e.knockY * dt;
    e.knockX *= 0.86; e.knockY *= 0.86;

    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist, ny = dy / dist;
    let mx = 0, my = 0;

    if (e.erratic) {
      const w = Math.sin(e.stateT * 6) * 0.8;
      mx = nx * Math.cos(w) - ny * Math.sin(w);
      my = nx * Math.sin(w) + ny * Math.cos(w);
    } else if (e.charge && e.chargeT > 0) {
      e.chargeT -= dt;
      mx = e.chargeDx; my = e.chargeDy;
    } else if (e.charge && dist < 260 && dist > 90 && Math.random() < dt * 0.5) {
      e.chargeT = 0.6; e.chargeDx = nx; e.chargeDy = ny;
    } else if (e.ranged && dist < 320) {
      // strafe, keep distance — only fire with line-of-sight (fog matters)
      mx = -ny * Math.sin(e.stateT * 1.5) * 0.5 + (dist > 240 ? nx * 0.6 : -nx * 0.4);
      my = nx * Math.sin(e.stateT * 1.5) * 0.5 + (dist > 240 ? ny * 0.6 : -ny * 0.4);
      e.shootT -= dt;
      if (e.shootT <= 0) {
        const etx = Math.floor(e.x / TILE), ety = Math.floor(e.y / TILE);
        const ptx2 = Math.floor(player.x / TILE), pty2 = Math.floor(player.y / TILE);
        if (!hasLos(etx, ety, ptx2, pty2)) { e.shootT = 0.4; }
        else {
        e.shootT = e.type === 'boss' ? 1.3 : 2.2;
        if (e.type === 'boss') {
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + e.stateT;
            shots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, damage: e.damage, life: 2.5, radius: 6, color: '#f87171' });
          }
          // spawn minions occasionally
          if (enemies.filter((x) => !x.dead).length < 8) {
            const m = makeEnemy('bat', e.x + 30, e.y, floor);
            enemies.push(m);
          }
        } else {
          shots.push({ x: e.x, y: e.y, vx: nx * 200, vy: ny * 200, damage: e.damage, life: 2.5, radius: 5, color: '#e7e5e4' });
        }
        }
      }
    } else {
      mx = nx; my = ny;
    }

    const r = collideCircle(dungeon.grid, e.x + mx * e.speed * dt, e.y + my * e.speed * dt, e.radius, TILE);
    e.x = r.x; e.y = r.y;

    // contact damage
    if (dist < e.radius + player.radius + 2) hurtPlayer(e.damage);
  }
  enemies = enemies.filter((e) => !e.dead || e.hp > -50);
  // prune long-dead (keep array small)
  if (enemies.length > 60) enemies = enemies.filter((e) => !e.dead).slice(-40).concat(enemies.filter((e) => !e.dead));
  enemies = enemies.filter((e) => !e.dead);
}

function updateShots(dt) {
  // player shots
  for (const s of pshots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.fire && Math.random() < 0.5) particleList.push({ x: s.x, y: s.y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 0.25, max: 0.25, color: '#fdba74', size: 3 });
    // wall check
    const tx = Math.floor(s.x / TILE), ty = Math.floor(s.y / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || dungeon.grid[ty * MAP_W + tx] === 0) { s.life = 0; burst(particleList, s.x, s.y, s.color, 4, 100); continue; }
    for (const e of enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - s.x, e.y - s.y) < e.radius + s.radius) {
        const a = Math.atan2(s.vy, s.vx);
        damageEnemy(e, s.damage, a);
        if (s.pierce > 0) s.pierce--;
        else { s.life = 0; break; }
      }
    }
  }
  pshots = pshots.filter((s) => s.life > 0);
  // enemy shots
  for (const s of shots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    const tx = Math.floor(s.x / TILE), ty = Math.floor(s.y / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || dungeon.grid[ty * MAP_W + tx] === 0) { s.life = 0; continue; }
    if (Math.hypot(player.x - s.x, player.y - s.y) < player.radius + s.radius) { hurtPlayer(s.damage); s.life = 0; }
  }
  shots = shots.filter((s) => s.life > 0);
}

function updatePickups(dt) {
  for (const p of pickups) {
    p.bob += dt * 4;
    // friction
    p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
    p.vx = (p.vx || 0) * 0.9; p.vy = (p.vy || 0) * 0.9;
    const d = Math.hypot(player.x - p.x, player.y - p.y);
    if (d < player.magnet) { // magnet
      const a = Math.atan2(player.y - p.y, player.x - p.x);
      p.x += Math.cos(a) * 260 * dt; p.y += Math.sin(a) * 260 * dt;
    }
    if (d < player.radius + 10) {
      p.taken = true;
      if (p.type === 'gem') gainXp(p.val);
      else if (p.type === 'heart') { player.hp = Math.min(player.maxHp, player.hp + p.val); dmgNums.push({ x: player.x, y: player.y - 16, text: '+' + p.val, color: '#4ade80', life: 0.6, max: 0.6, crit: false }); }
      else if (p.type === 'gold') player.gold += p.val;
    }
  }
  pickups = pickups.filter((p) => !p.taken);
}

function getCam() {
  const x = Math.max(0, Math.min(MAP_W * TILE - canvas.width, player.x - canvas.width / 2));
  const y = Math.max(0, Math.min(MAP_H * TILE - canvas.height, player.y - canvas.height / 2));
  return { x, y };
}

// ---- FOV + explored memory (roguelike Pattern 3, real-time variant) ----
// Symmetric-ish LOS: Bresenham line from player tile; walls block sight.
function tileBlocked(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  return dungeon.grid[ty * MAP_W + tx] === 0;
}
function hasLos(x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  while (!(x === x1 && y === y1)) {
    if (!((x === x0 && y === y0) || (x === x1 && y === y1)) && tileBlocked(x, y)) return false;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return true;
}
function computeFov() {
  if (!dungeon) return;
  visible = new Set();
  const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
  for (let y = Math.max(0, pty - FOV_RADIUS); y <= Math.min(MAP_H - 1, pty + FOV_RADIUS); y++) {
    for (let x = Math.max(0, ptx - FOV_RADIUS); x <= Math.min(MAP_W - 1, ptx + FOV_RADIUS); x++) {
      const d = Math.hypot(x - ptx, y - pty);
      if (d > FOV_RADIUS) continue;
      if (hasLos(ptx, pty, x, y)) {
        const i = y * MAP_W + x;
        visible.add(i);
        explored.add(i);
      }
    }
  }
}

// ---------- RENDER ----------
function render() {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state === 'title') { renderTitle(); ctx.restore(); return; }

  const cam = getCam();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  // tiles: visible -> lit; explored-but-not-visible -> dim; never-seen -> black
  const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + canvas.width) / TILE));
  const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + canvas.height) / TILE));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const i = ty * MAP_W + tx;
      if (!explored.has(i)) continue; // never seen -> pitch black
      const isVis = visible.has(i);
      const px = tx * TILE - cam.x, py = ty * TILE - cam.y;
      if (dungeon.grid[i] === 1) {
        const checker = (tx + ty) % 2 === 0;
        ctx.fillStyle = checker ? '#211d2e' : '#1a1727';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(px + 3, py + 3, 4, 4);
      } else {
        // wall: only draw if adjacent to floor (avoid solid black)
        let near = false;
        for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1 && !near; ox++) {
          const nx2 = tx + ox, ny2 = ty + oy;
          if (nx2 >= 0 && ny2 >= 0 && nx2 < MAP_W && ny2 < MAP_H && dungeon.grid[ny2 * MAP_W + nx2] === 1) near = true;
        }
        if (!near) continue;
        ctx.fillStyle = '#312e81';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#4c1d95';
        ctx.fillRect(px, py, TILE, 8);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(px, py + TILE - 6, TILE, 6);
      }
      if (!isVis) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(px, py, TILE, TILE); }
    }
  }

  const tileSeen = (wx, wy) => {
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    return visible.has(ty * MAP_W + tx);
  };
  const tileExplored = (wx, wy) => {
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    return explored.has(ty * MAP_W + tx);
  };

  // stairs (only if explored)
  const stx = dungeon.stairs.x * TILE + 16 - cam.x, sty = dungeon.stairs.y * TILE + 16 - cam.y;
  if (tileExplored(dungeon.stairs.x * TILE + 16, dungeon.stairs.y * TILE + 16)) {
  ctx.fillStyle = '#000';
  ctx.fillRect(stx - 16, sty - 16, 32, 32);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(stx - 13, sty - 13, 26, 26);
  ctx.fillStyle = '#0b0b14';
  ctx.fillRect(stx - 8, sty - 4, 16, 12);
  ctx.fillRect(stx - 4, sty - 12, 8, 20);
  pxText(ctx, floor >= MAX_FLOOR ? 'ESCAPE!' : 'DOWN [E]', stx, sty - 26, 7, 'center', '#fde68a');
  }

  // chests (only if explored)
  for (const c of chests) {
    if (!tileExplored(c.x, c.y)) continue;
    const cx = c.x - cam.x, cy = c.y - cam.y + Math.sin(time * 2 + c.bob) * 2;
    if (!tileSeen(c.x, c.y)) ctx.globalAlpha = 0.45;
    emoji(ctx, c.opened ? '📭' : '🎁', cx, cy, 26);
    ctx.globalAlpha = 1;
  }

  // pickups (gems only if seen; hearts/gold if explored)
  for (const p of pickups) {
    const needSeen = p.type === 'gem';
    if (needSeen ? !tileSeen(p.x, p.y) : !tileExplored(p.x, p.y)) continue;
    const px = p.x - cam.x, py = p.y - cam.y + Math.sin(p.bob) * 2;
    if (p.type === 'gem') { ctx.fillStyle = '#22c55e'; ctx.save(); ctx.translate(px, py); ctx.rotate(time * 3); ctx.fillRect(-5, -5, 10, 10); ctx.restore(); }
    else if (p.type === 'heart') emoji(ctx, '❤️', px, py, 18);
    else emoji(ctx, '🪙', px, py, 16);
  }

  // enemies (only if currently visible — fog hides them)
  for (const e of enemies) {
    if (!tileSeen(e.x, e.y)) continue;
    const ex = e.x - cam.x, ey = e.y - cam.y;
    if (ex < -40 || ey < -40 || ex > canvas.width + 40 || ey > canvas.height + 40) continue;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(ex, ey + e.radius, e.radius, 5, 0, 0, Math.PI * 2); ctx.fill();
    // body flash on hit
    ctx.fillStyle = e.hitT > 0 ? '#fff' : e.color;
    ctx.beginPath(); ctx.arc(ex, ey, e.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke();
    emoji(ctx, e.icon, ex, ey, e.radius * 1.5);
    // hp mini bar
    if (e.hp < e.maxHp) bar(ctx, ex - 16, ey - e.radius - 12, 32, 6, e.hp, e.maxHp, '#ef4444');
  }

  // player projectiles
  for (const s of pshots) {
    const sx = s.x - cam.x, sy = s.y - cam.y;
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(sx, sy, s.radius + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, s.radius - 2), 0, Math.PI * 2); ctx.fill();
  }
  // enemy shots
  for (const s of shots) {
    const sx = s.x - cam.x, sy = s.y - cam.y;
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(sx, sy, s.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  }

  // player
  const plx = player.x - cam.x, ply = player.y - cam.y;
  if (player.iframes <= 0 || Math.floor(time * 12) % 2 === 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(plx, ply + 13, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    // dash trail
    if (player.dashTime > 0) {
      ctx.fillStyle = 'rgba(34,211,238,0.5)';
      ctx.beginPath(); ctx.arc(plx - player.dashDx * 18, ply - player.dashDy * 18, 12, 0, Math.PI * 2); ctx.fill();
    }
    // swing arc
    if (player.swingT > 0 && !WEAPONS[player.weapon].projectile) {
      const a = Math.atan2(player.faceY, player.faceX);
      ctx.fillStyle = 'rgba(226,232,240,0.45)';
      ctx.beginPath(); ctx.moveTo(plx, ply); ctx.arc(plx, ply, WEAPONS[player.weapon].range, a - 0.9, a + 0.9); ctx.closePath(); ctx.fill();
    }
    // body
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(plx, ply, player.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#0c4a6e'; ctx.stroke();
    // aim indicator
    const ax = plx + player.faceX * 20, ay = ply + player.faceY * 20;
    ctx.fillStyle = WEAPONS[player.weapon].color;
    ctx.fillRect(ax - 3, ay - 3, 6, 6);
    emoji(ctx, '🧙', plx, ply, 20);
  }

  drawParticles(ctx, particleList.map((p) => ({ ...p, x: p.x - cam.x, y: p.y - cam.y })));
  damageNumbers(ctx, dmgNums.map((d) => ({ ...d, x: d.x - cam.x, y: d.y - cam.y })));

  ctx.restore(); // undo shake (cam kept manual)
  renderHUD();
  if (state === 'levelup') renderLevelUp();
  if (state === 'dead') renderDead();
  if (state === 'win') renderWin();
}

function renderHUD() {
  // top bars
  pxRect(ctx, 8, 8, 250, 54, 'rgba(0,0,0,0.65)', '#000', 2);
  bar(ctx, 16, 14, 200, 12, player.hp, player.maxHp, COLORS.hp, '#450a0a');
  pxText(ctx, `${Math.ceil(player.hp)}/${player.maxHp}`, 116, 20, 8, 'center', '#fff');
  bar(ctx, 16, 30, 200, 10, player.xp, player.xpNext, COLORS.xp, '#052e16');
  pxText(ctx, `Lv ${player.level}  Floor ${floor}/${MAX_FLOOR}`, 116, 48, 8, 'center', '#fde68a');

  pxRect(ctx, canvas.width - 218, 8, 210, 54, 'rgba(0,0,0,0.65)', '#000', 2);
  const w = WEAPONS[player.weapon];
  pxText(ctx, `${w.icon} ${w.name}`, canvas.width - 113, 22, 8, 'center', '#fff');
  pxText(ctx, `💰${player.gold}  💀${player.kills}  ⏱️${Math.floor(runTime)}s`, canvas.width - 113, 40, 8, 'center', '#fbbf24');
  pxText(ctx, player.weaponsOwned.map((id) => WEAPONS[id].icon).join(' ') + '  [1-3]', canvas.width - 113, 54, 7, 'center', '#a5b4fc');

  // dash cooldown bottom + seed
  const dw = 120;
  bar(ctx, 16, canvas.height - 24, dw, 12, player.dashCdMax - player.dashCd, player.dashCdMax, '#22d3ee', '#083344');
  pxText(ctx, player.dashCd <= 0 ? 'DASH READY' : 'DASH...', 76, canvas.height - 18, 7, 'center', '#fff');
  pxText(ctx, `seed ${runSeed}`, 76, canvas.height - 34, 7, 'center', '#64748b');

  // minimap (explored only — fog applies here too)
  const mw = 110, mh = 82, mx = canvas.width - mw - 10, my = canvas.height - mh - 10;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
  const sx = mw / MAP_W, sy = mh / MAP_H;
  ctx.fillStyle = '#4c1d95';
  for (let ty = 0; ty < MAP_H; ty += 1) for (let tx = 0; tx < MAP_W; tx += 1)
    if (dungeon.grid[ty * MAP_W + tx] === 1 && explored.has(ty * MAP_W + tx)) ctx.fillRect(mx + tx * sx, my + ty * sy, 1.6, 1.6);
  if (tileExplored(dungeon.stairs.x * TILE + 16, dungeon.stairs.y * TILE + 16)) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(mx + dungeon.stairs.x * sx - 2, my + dungeon.stairs.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(mx + (player.x / TILE) * sx - 2, my + (player.y / TILE) * sy - 2, 4, 4);

  if (chestMsgT > 0) pxText(ctx, chestMsg, canvas.width / 2, 84, 9, 'center', '#fef08a');

  // interact hint
  const sxw = dungeon.stairs.x * TILE + 16, syw = dungeon.stairs.y * TILE + 16;
  if (Math.hypot(sxw - player.x, syw - player.y) < 52) pxText(ctx, '[E] Descend', canvas.width / 2, canvas.height - 44, 9, 'center', '#fde68a');
  for (const c of chests) {
    if (!c.opened && Math.hypot(c.x - player.x, c.y - player.y) < 52) { pxText(ctx, '[E] Open chest', canvas.width / 2, canvas.height - 44, 9, 'center', '#fde68a'); break; }
  }
}

let titleHover = false, deadHover = false, winHover = false;
function bestLine() {
  const fw = profile.fastestWin ? `${profile.fastestWin}s` : '--';
  return `BEST F${profile.bestFloor} • ${profile.bestKills} kills • ${profile.bestGold} gold • win ${fw} • runs ${profile.totalRuns}`;
}
function renderTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#1e1b4b'); g.addColorStop(1, '#0b0b14');
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.2})`;
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
  }
  pxText(ctx, '⚔️ DUNGEON', canvas.width / 2, 140, 34, 'center', '#fbbf24');
  pxText(ctx, 'DELVER', canvas.width / 2, 190, 34, 'center', '#a855f7');
  pxText(ctx, `Clear ${MAX_FLOOR} floors. Death is permanent.`, canvas.width / 2, 245, 9, 'center', '#c4b5fd');
  pxText(ctx, 'WASD move • Click attack • Space dash • E loot/stairs', canvas.width / 2, 272, 8, 'center', '#93c5fd');
  pxText(ctx, '🗡️ Sword  🏹 Bow  🔥 Staff  •  ❤️ gems level you up', canvas.width / 2, 295, 8, 'center', '#93c5fd');
  pxText(ctx, `seed ${pendingSeed}  [N] new  •  ?seed=xxx for shared/daily`, canvas.width / 2, 322, 7, 'center', '#64748b');
  const m = getAim();
  titleHover = m.x > 270 && m.x < 530 && m.y > 350 && m.y < 410;
  pxButton(ctx, 270, 350, 260, 60, 'ENTER DUNGEON', '#7c3aed', titleHover);
  pxText(ctx, bestLine(), canvas.width / 2, 440, 7, 'center', '#fbbf24');
  pxText(ctx, 'Bosses every 3rd floor. Enemies lurk in the dark.', canvas.width / 2, 462, 8, 'center', '#64748b');
}

function renderLevelUp() {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  pxText(ctx, `LEVEL ${player.level}! Choose:`, canvas.width / 2, 130, 14, 'center', '#fbbf24');
  const m = getAim();
  levelChoices.forEach((u, i) => {
    const x = 110 + i * 200, y = 180, w = 180, h = 200;
    const hov = m.x > x && m.x < x + w && m.y > y && m.y < y + h;
    pxRect(ctx, x, y, w, h, hov ? '#312e81' : '#1e1b4b', hov ? '#fbbf24' : '#000', 3);
    pxText(ctx, `[${i + 1}]`, x + w / 2, y + 28, 9, 'center', '#93c5fd');
    emoji(ctx, u.icon, x + w / 2, y + 70, 40);
    pxText(ctx, u.name, x + w / 2, y + 115, 8, 'center', '#fff');
    // wrap desc
    pxText(ctx, u.desc.slice(0, 18), x + w / 2, y + 140, 7, 'center', '#c4b5fd');
    pxText(ctx, u.desc.slice(18, 40), x + w / 2, y + 156, 7, 'center', '#c4b5fd');
  });
}

function renderDead() {
  ctx.fillStyle = 'rgba(120,0,0,0.55)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  pxText(ctx, '💀 YOU DIED', canvas.width / 2, 200, 28, 'center', '#ef4444');
  pxText(ctx, `Floor ${floor} • Lv ${player.level} • ${player.kills} kills • ${player.gold} gold • ${Math.floor(runTime)}s`, canvas.width / 2, 258, 9, 'center', '#fff');
  pxText(ctx, `seed ${runSeed} • [T] retry seed  [R] new seed`, canvas.width / 2, 284, 8, 'center', '#fca5a5');
  pxText(ctx, bestLine(), canvas.width / 2, 308, 7, 'center', '#fbbf24');
  const m = getAim();
  deadHover = m.x > 270 && m.x < 530 && m.y > 350 && m.y < 410;
  pxButton(ctx, 270, 350, 260, 60, 'TRY AGAIN [R]', '#dc2626', deadHover);
}

function renderWin() {
  ctx.fillStyle = 'rgba(0,60,0,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  pxText(ctx, '🏆 LEGEND!', canvas.width / 2, 200, 28, 'center', '#fbbf24');
  pxText(ctx, `Escaped all ${MAX_FLOOR} floors! ${player.kills} kills • ${player.gold} gold • ${Math.floor(runTime)}s`, canvas.width / 2, 258, 9, 'center', '#fff');
  pxText(ctx, `seed ${runSeed} • [T] replay seed  [R] new seed`, canvas.width / 2, 284, 8, 'center', '#bbf7d0');
  pxText(ctx, bestLine(), canvas.width / 2, 308, 7, 'center', '#fde68a');
  const m = getAim();
  winHover = m.x > 270 && m.x < 530 && m.y > 350 && m.y < 410;
  pxButton(ctx, 270, 350, 260, 60, 'PLAY AGAIN [R]', '#16a34a', winHover);
}

function onClick(x, y) {
  if (state === 'title' && titleHover) startRun(pendingSeed);
  else if (state === 'dead' && deadHover) { pendingSeed = randomSeed(); startRun(pendingSeed); }
  else if (state === 'win' && winHover) { pendingSeed = randomSeed(); startRun(pendingSeed); }
  else if (state === 'levelup') {
    levelChoices.forEach((u, i) => {
      const bx = 110 + i * 200, by = 180;
      if (x > bx && x < bx + 180 && y > by && y < by + 200) {
        u.apply(player);
        state = 'playing';
      }
    });
  }
}

// ---------- LOOP ----------
initInput(canvas);
canvas.addEventListener('mousedown', (e) => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (canvas.width / r.width);
  const y = (e.clientY - r.top) * (canvas.height / r.height);
  onClick(x, y);
});

let last = 0;
function loop(ts) {
  const rawDt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016);
  last = ts;
  updateMouseEdge();

  if (state === 'levelup') {
    if (consumePressed('1') && levelChoices[0]) { levelChoices[0].apply(player); state = 'playing'; }
    if (consumePressed('2') && levelChoices[1]) { levelChoices[1].apply(player); state = 'playing'; }
    if (consumePressed('3') && levelChoices[2]) { levelChoices[2].apply(player); state = 'playing'; }
    clearPressed();
  }
  if (state === 'title' && consumePressed('n')) { pendingSeed = randomSeed(); clearPressed(); }
  if ((state === 'dead' || state === 'win')) {
    if (consumePressed('t')) { pendingSeed = runSeed; startRun(pendingSeed); clearPressed(); }
    else if (consumePressed('r') || consumePressed('enter')) { pendingSeed = randomSeed(); startRun(pendingSeed); clearPressed(); }
  }
  if (state === 'title' && (consumePressed('enter') || consumePressed(' '))) { startRun(pendingSeed); clearPressed(); }

  // hit-stop (game-feel): freeze sim briefly on impact, input still buffers
  let dt = rawDt;
  if (hitStop > 0) { hitStop -= rawDt; dt = rawDt * 0.06; }
  update(dt);
  render();
  requestAnimationFrame(loop);
}
// pre-generate a backdrop dungeon so HUD/minimap don't crash on title
dungeon = genDungeon(1, pendingSeed);
computeFov();
requestAnimationFrame(loop);
