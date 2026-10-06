import { COLORS, RECIPES } from '../data.js';
import { drawPixelRect, drawPixelText, drawProgressBar, drawIcon, drawMinigameOverlay } from '../renderer.js';

let mg = null;

export function startMinigame(recipeId, onComplete) {
  const recipe = RECIPES[recipeId];
  const miniType = recipeId === 'suya' ? 'tapRhythm' : recipeId === 'jollof' ? 'heatSlider' : 'stirCircle';

  mg = {
    active: true,
    recipeId,
    recipe,
    miniType,
    onComplete,
    score: 0,
    elapsed: 0,
    result: null,
    snapshots: [],
    shakeTimer: 0,
    smokeParticles: [],
  };

  if (miniType === 'tapRhythm') {
    mg.skewers = [];
    for (let i = 0; i < 5; i++) {
      mg.skewers.push({
        beat: (i + 1) * 1000 + Math.random() * 500,
        active: false,
        revealed: false,
        result: null,
      });
    }
    mg.currentBeat = 0;
    mg.beatElapsed = 0;
  }

  if (miniType === 'heatSlider') {
    mg.heat = 0.3;
    mg.goldenLow = 0.45;
    mg.goldenHigh = 0.75;
    mg.holding = false;
    mg.burnAccum = 0;
    mg.rawAccum = 0;
    mg.totalDuration = 8000;
  }

  if (miniType === 'stirCircle') {
    mg.totalDuration = 7000;
    mg.circleRadius = 60;
    mg.circleCenterX = 400;
    mg.circleCenterY = 200;
    mg.targetAngle = 0;
    mg.playerAngle = 0;
    mg.followScore = 0;
    mg.frameCount = 0;
  }
}

export function getMinigame() { return mg; }

export function updateMinigame(dt, mouse) {
  if (!mg || !mg.active) return;
  mg.elapsed += dt;

  if (mg.miniType === 'tapRhythm') updateTapRhythm(dt, mouse);
  if (mg.miniType === 'heatSlider') updateHeatSlider(dt, mouse);
  if (mg.miniType === 'stirCircle') updateStirCircle(dt, mouse);

  if (mg.shakeTimer > 0) mg.shakeTimer -= dt;
  mg.smokeParticles = mg.smokeParticles.filter(p => p.life > 0);
  for (const p of mg.smokeParticles) {
    p.x += p.vx * dt / 16;
    p.y += p.vy * dt / 16;
    p.life -= dt;
    p.alpha = Math.max(0, p.life / p.maxLife);
  }
}

function updateTapRhythm(dt, mouse) {
  if (mg.currentBeat >= 5) {
    finishMinigame();
    return;
  }

  mg.beatElapsed += dt;
  const beat = mg.skewers[mg.currentBeat];

  if (!beat.revealed && mg.beatElapsed >= beat.beat) {
    beat.active = true;
    beat.revealed = true;
  }

  if (beat.active && mouse.justPressed) {
    const diff = Math.abs(mg.beatElapsed - beat.beat);
    if (diff < 250) {
      beat.result = 'PERFECT';
      mg.score += 20;
    } else if (diff < 500) {
      beat.result = 'GOOD';
      mg.score += 12;
    } else if (diff < 800) {
      beat.result = 'OK';
      mg.score += 5;
    } else {
      beat.result = 'MISS';
    }
    beat.active = false;
    mg.currentBeat++;
    mg.beatElapsed = 0;

    if (beat.result !== 'PERFECT') {
      mg.shakeTimer = 100;
      mg.smokeParticles.push(...createSmoke(mg.skewers.length));
    }
  }

  const totalTime = mg.skewers[4].beat + 1200;
  if (mg.elapsed > totalTime) {
    if (mg.currentBeat < 5) {
      mg.skewers[mg.currentBeat].result = 'MISS';
      mg.currentBeat++;
    }
    finishMinigame();
  }
}

function updateHeatSlider(dt, mouse) {
  mg.heat -= 0.0004 * dt;
  if (mouse.down) {
    mg.heat += 0.0025 * dt;
    mg.holding = true;
  } else {
    mg.holding = false;
  }
  mg.heat = Math.max(0, Math.min(1, mg.heat));

  if (mg.heat > mg.goldenHigh + 0.05) {
    mg.burnAccum += dt;
    if (Math.random() < 0.1) mg.smokeParticles.push(...createSmoke(3));
  } else if (mg.heat < mg.goldenLow - 0.1) {
    mg.rawAccum += dt;
  }

  if (mg.elapsed >= mg.totalDuration) {
    const inZone = mg.elapsed - (mg.burnAccum + mg.rawAccum);
    mg.score = Math.round((inZone / mg.elapsed) * 100);
    finishMinigame();
  }
}

function updateStirCircle(dt, mouse) {
  mg.targetAngle += 0.003 * dt;
  mg.playerAngle = Math.atan2(mouse.y - mg.circleCenterY, mouse.x - mg.circleCenterX);
  if (mg.playerAngle < 0) mg.playerAngle += Math.PI * 2;

  let diff = Math.abs(mg.playerAngle - (mg.targetAngle % (Math.PI * 2)));
  if (diff > Math.PI) diff = Math.PI * 2 - diff;

  const dist = Math.hypot(mouse.x - mg.circleCenterX, mouse.y - mg.circleCenterY);
  const distOk = Math.abs(dist - mg.circleRadius) < 40;
  const angleOk = diff < 0.8;

  if (distOk && angleOk) mg.followScore++;
  mg.frameCount++;

  if (mg.elapsed >= mg.totalDuration) {
    mg.score = Math.round((mg.followScore / mg.frameCount) * 100);
    finishMinigame();
  }
}

function finishMinigame() {
  let stars = 1;
  if (mg.score >= 80) stars = 3;
  else if (mg.score >= 50) stars = 2;

  mg.result = { score: mg.score, stars, recipeId: mg.recipeId };
  mg.active = false;

  if (mg.onComplete) {
    setTimeout(() => mg.onComplete(mg.result), 600);
  }
}

export function renderMinigame(ctx) {
  if (!mg) return;

  if (mg.shakeTimer > 0) {
    ctx.save();
    const s = mg.shakeTimer / 100 * 4;
    ctx.translate(Math.random() * s * 2 - s, Math.random() * s * 2 - s);
  }

  drawMinigameOverlay(ctx);

  if (mg.miniType === 'tapRhythm') renderTapRhythm(ctx);
  if (mg.miniType === 'heatSlider') renderHeatSlider(ctx);
  if (mg.miniType === 'stirCircle') renderStirCircle(ctx);

  if (mg.shakeTimer > 0) ctx.restore();
}

function renderTapRhythm(ctx) {
  const cx = 400, cy = 120;
  drawPixelRect(ctx, cx - 120, cy - 10, 240, 20, COLORS.cream);
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(cx - 115, cy - 7, 50, 14);
  ctx.fillRect(cx + 35, cy - 7, 80, 14);

  drawPixelText(ctx, '🎯 TAP WHEN IN GREEN!', cx, cy + 40, 10);

  for (let i = 0; i < mg.skewers.length; i++) {
    const sk = mg.skewers[i];
    const sx = 150 + i * 130;
    const sy = 260;

    drawIcon(ctx, '🥩', sx, sy, 36);
    drawPixelText(ctx, `${i + 1}`, sx, sy + 30, 8);

    const indicatorX = mg.beatElapsed / (sk.beat + 500) * 180 * (i + 1 <= mg.currentBeat ? 1 : 0);

    if (sk.result) {
      const color = sk.result === 'PERFECT' ? COLORS.green : sk.result === 'GOOD' ? COLORS.foodGold : sk.result === 'OK' ? COLORS.ember : COLORS.pepper;
      drawPixelText(ctx, sk.result, sx, sy - 40, 9, 'center', color);
    }
  }

  drawPixelText(ctx, mg.recipe.name.toUpperCase(), 400, 80, 14, 'center', COLORS.white);
  const scoreText = `Score: ${mg.score}`;
  drawPixelText(ctx, scoreText, 400, 460, 12, 'center', COLORS.foodGold);
}

function renderHeatSlider(ctx) {
  const cx = 340, cy = 140, barW = 40, barH = 240;

  drawPixelRect(ctx, cx - 5, cy - 30, barW + 10, barH + 60, COLORS.cream);

  drawPixelRect(ctx, cx + barW + 20, cy + (1 - mg.goldenHigh) * barH, 16, (mg.goldenHigh - mg.goldenLow) * barH, COLORS.green);

  const heatY = cy + (1 - mg.heat) * barH;
  drawPixelRect(ctx, cx, cy + barH - 3, barW, 6, COLORS.steel);
  drawPixelRect(ctx, cx - 5, heatY - 8, barW + 10, 16, COLORS.ember);
  ctx.fillStyle = mg.heat > mg.goldenHigh + 0.1 ? COLORS.pepper : COLORS.ember;
  ctx.fillRect(cx, heatY - 3, barW, 6);

  drawIcon(ctx, '🍚', 400, cy + barH / 2, 64);
  drawIcon(ctx, '🔥', cx - 60, heatY, 24);

  drawPixelText(ctx, '🔥 HOLD TO HEAT THE POT', 500, cy - 10, 9, 'center');

  if (mg.heat > mg.goldenHigh + 0.1) {
    drawPixelText(ctx, '⚠️ BURNING!', 500, cy + 40, 9, 'center', COLORS.pepper);
  } else if (mg.heat < mg.goldenLow - 0.05) {
    drawPixelText(ctx, '❄️ TOO COLD!', 500, cy + 40, 9, 'center', COLORS.seaBlue);
  } else if (mg.heat >= mg.goldenLow && mg.heat <= mg.goldenHigh) {
    drawPixelText(ctx, '✨ GOLDEN!', 500, cy + 40, 9, 'center', COLORS.foodGold);
  }

  const timeLeft = Math.max(0, mg.totalDuration - mg.elapsed);
  drawProgressBar(ctx, 200, 420, 400, 16, timeLeft, mg.totalDuration, COLORS.sizzle);
  drawPixelText(ctx, mg.recipe.name.toUpperCase(), 400, 60, 14, 'center', COLORS.white);
  drawPixelText(ctx, `Quality: ${mg.score}%`, 400, 460, 10, 'center', COLORS.foodGold);
}

function renderStirCircle(ctx) {
  drawPixelText(ctx, mg.recipe.name.toUpperCase(), 400, 60, 14, 'center', COLORS.white);

  const cx = mg.circleCenterX, cy = mg.circleCenterY, r = mg.circleRadius;

  ctx.strokeStyle = COLORS.cream + '88';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = COLORS.brown + '66';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.wood;
  ctx.lineWidth = 3;
  ctx.stroke();

  const tx = cx + Math.cos(mg.targetAngle) * r;
  const ty = cy + Math.sin(mg.targetAngle) * r;
  ctx.fillStyle = COLORS.foodGold;
  ctx.beginPath();
  ctx.arc(tx, ty, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  ctx.stroke();

  const mx = mouseCanvasX || cx, my = mouseCanvasY || cy;
  ctx.fillStyle = COLORS.sizzle;
  ctx.beginPath();
  ctx.arc(mx, my, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  drawPixelText(ctx, '🔄 FOLLOW THE GOLDEN DOT', 400, cy + r + 60, 10);

  const timeLeft = Math.max(0, mg.totalDuration - mg.elapsed);
  drawProgressBar(ctx, 200, 420, 400, 16, timeLeft, mg.totalDuration, COLORS.green);
  drawPixelText(ctx, `Stir: ${mg.followScore}/${mg.frameCount}`, 400, 460, 10, 'center', COLORS.foodGold);
}

let mouseCanvasX = 0, mouseCanvasY = 0;

export function setMinigameMouse(x, y) {
  mouseCanvasX = x;
  mouseCanvasY = y;
}

function createSmoke(count) {
  const p = [];
  for (let i = 0; i < count; i++) {
    p.push({
      x: 400 + Math.random() * 80 - 40,
      y: 300 + Math.random() * 40,
      vx: Math.random() * 2 - 1,
      vy: -Math.random() * 3 - 1,
      life: 500 + Math.random() * 500,
      maxLife: 500 + Math.random() * 500,
      alpha: 1,
      color: ['#999', '#666', '#aaa'][Math.floor(Math.random() * 3)],
    });
  }
  return p;
}
