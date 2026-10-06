// Shared constants, enemy/weapon/upgrade definitions
export const TILE = 32;
export const MAP_W = 40;
export const MAP_H = 30;
export const MAX_FLOOR = 5;

export const COLORS = {
  ink: '#0b0b14',
  wall: '#312e81',
  wallTop: '#4c1d95',
  floorA: '#1c1917',
  floorB: '#292524',
  floorC: '#1e1b4b',
  hp: '#ef4444',
  hpBg: '#450a0a',
  xp: '#22c55e',
  xpBg: '#052e16',
  gold: '#f59e0b',
  white: '#fff',
  purple: '#a855f7',
  cyan: '#22d3ee',
};

export const WEAPONS = {
  sword: {
    id: 'sword', name: 'Knight Sword', icon: '🗡️',
    damage: 22, cooldown: 0.32, range: 78, arc: 1.9,
    projectile: false, color: '#e2e8f0',
    desc: 'Wide melee arc',
  },
  bow: {
    id: 'bow', name: 'Hunter Bow', icon: '🏹',
    damage: 14, cooldown: 0.22, range: 420, speed: 520,
    projectile: true, multishot: 1, color: '#a3e635',
    desc: 'Fast arrows',
  },
  staff: {
    id: 'staff', name: 'Fire Staff', icon: '🔥',
    damage: 30, cooldown: 0.55, range: 380, speed: 340,
    projectile: true, multishot: 1, pierce: 2, radius: 7, color: '#fb923c',
    desc: 'Piercing fireball',
  },
};

export const ENEMIES = {
  slime: { hp: 30, speed: 70, damage: 10, xp: 8, gold: 5, radius: 12, color: '#4ade80', icon: '🟢', name: 'Slime' },
  bat: { hp: 18, speed: 135, damage: 8, xp: 7, gold: 6, radius: 10, color: '#c084fc', icon: '🦇', name: 'Cave Bat', erratic: true },
  skeleton: { hp: 40, speed: 60, damage: 12, xp: 14, gold: 10, radius: 12, color: '#e7e5e4', icon: '💀', name: 'Skeleton', ranged: true, shootCd: 2.2 },
  brute: { hp: 90, speed: 45, damage: 20, xp: 22, gold: 16, radius: 16, color: '#f87171', icon: '👹', name: 'Brute', charge: true },
  boss: { hp: 420, speed: 55, damage: 25, xp: 120, gold: 150, radius: 22, color: '#dc2626', icon: '🐲', name: 'Dungeon Lord', ranged: true, shootCd: 1.4, spawns: true },
};

export const UPGRADES = [
  { id: 'dmg', name: '+25% Damage', icon: '⚔️', desc: 'All attacks hit harder', apply: (p) => { p.dmgMult *= 1.25; } },
  { id: 'rate', name: '+20% Speed', icon: '🥾', desc: 'Attack + move faster', apply: (p) => { p.rateMult *= 0.83; p.speed *= 1.08; } },
  { id: 'hp', name: '+30 Max HP', icon: '❤️', desc: 'Heal 30 now', apply: (p) => { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); } },
  { id: 'multi', name: '+1 Projectile', icon: '🔱', desc: 'Bow/Staff shoot extra', apply: (p) => { p.bonusShots += 1; } },
  { id: 'dash', name: 'Quick Dash', icon: '💨', desc: '-30% dash cooldown', apply: (p) => { p.dashCdMax = Math.max(0.5, p.dashCdMax * 0.7); } },
  { id: 'pierce', name: 'Piercing', icon: '🎯', desc: 'Shots pierce +1', apply: (p) => { p.bonusPierce += 1; } },
  { id: 'regen', name: 'Regen', icon: '✨', desc: '+1 HP / sec', apply: (p) => { p.regen += 1; } },
  { id: 'magnet', name: 'Magnet', icon: '🧲', desc: '+60 pickup range', apply: (p) => { p.magnet += 60; } },
  { id: 'crit', name: '+10% Crit', icon: '💥', desc: 'Crits deal 2x', apply: (p) => { p.crit += 0.10; } },
];

export function makePlayer() {
  return {
    x: 0, y: 0, radius: 13,
    hp: 100, maxHp: 100,
    speed: 210,
    level: 1, xp: 0, xpNext: 30,
    gold: 0, kills: 0,
    weapon: 'sword',
    weaponsOwned: ['sword'],
    dmgMult: 1, rateMult: 1,
    bonusShots: 0, bonusPierce: 0,
    crit: 0.05, regen: 0, magnet: 90,
    dashCd: 0, dashCdMax: 1.4, dashTime: 0, dashDx: 0, dashDy: 0,
    iframes: 0, attackCd: 0, faceX: 1, faceY: 0,
    swingT: 0,
  };
}

export function xpForLevel(level) {
  return Math.floor(30 * Math.pow(1.35, level - 1));
}

// ---- Seeded RNG (procedural-gen Pattern 1) ----
// One dedicated RNG per run: same seed + floor => same dungeon.
// Gameplay visuals (particles) may still use Math.random; generation must not.
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function rngPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function getSeedFromURL() {
  try {
    const m = /[?&]seed=([^&#]*)/.exec(window.location.search || '');
    if (m && m[1]) return decodeURIComponent(m[1]).slice(0, 24);
  } catch (e) { /* file:// has no query — ignore */ }
  return null;
}

export function randomSeed() {
  return Math.floor(Math.random() * 1e9).toString(36);
}
