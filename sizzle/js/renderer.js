import { COLORS } from './data.js';

export function drawPixelRect(ctx, x, y, w, h, color, borderColor = COLORS.ink, borderWidth = 3) {
  ctx.fillStyle = borderColor;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + borderWidth, y + borderWidth, w - borderWidth * 2, h - borderWidth * 2);
}

export function drawPixelButton(ctx, x, y, w, h, text, color, textColor = COLORS.white, isHovered = false) {
  const shadowOffset = isHovered ? 2 : 4;
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(x + shadowOffset, y + shadowOffset, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = textColor;
  drawPixelText(ctx, text, x + w / 2, y + h / 2 + 4, 11, 'center');
}

export function drawPixelText(ctx, text, x, y, size = 12, align = 'center', color = COLORS.ink) {
  ctx.font = `${size}px 'Press Start 2P', monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function drawProgressBar(ctx, x, y, w, h, value, max, fillColor, bgColor = '#ddd') {
  drawPixelRect(ctx, x, y, w, h, bgColor, COLORS.ink, 2);
  const fillW = Math.max(0, Math.min(w - 6, ((w - 6) * value) / max));
  if (fillW > 0) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(x + 3, y + 3, fillW, h - 6);
  }
}

export function drawIcon(ctx, icon, x, y, size = 32) {
  ctx.font = `${size}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, x, y);
}

export function drawDoorway(ctx, x, y, w, h, label, color = COLORS.wood, side = 'right') {
  drawPixelRect(ctx, x, y, w, h, color);
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(x + 6, y + 8, w - 12, h - 8);
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(x + 8, y + 10, w - 16, h - 10);

  if (side === 'right') {
    drawPixelText(ctx, '▶', x + w / 2, y + h / 2 - 8, 16, 'center', COLORS.white);
  } else {
    drawPixelText(ctx, '◀', x + w / 2, y + h / 2 - 8, 16, 'center', COLORS.white);
  }
  drawPixelText(ctx, label, x + w / 2, y + h - 6, 7, 'center', COLORS.white);
}

export function drawThoughtBubble(ctx, x, y, text, dishIcon) {
  const bubbleW = Math.max(120, ctx.measureText(text).width + 30);
  const bubbleH = 44;

  ctx.fillStyle = COLORS.white;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.roundRect(x - bubbleW / 2, y - bubbleH - 10, bubbleW, bubbleH, 6);
  ctx.fill();
  ctx.stroke();

  const triangleX = x;
  const triangleY = y - 5;
  ctx.beginPath();
  ctx.moveTo(triangleX - 8, triangleY - 5);
  ctx.lineTo(triangleX + 8, triangleY - 5);
  ctx.lineTo(triangleX, triangleY + 5);
  ctx.closePath();
  ctx.fillStyle = COLORS.white;
  ctx.fill();
  ctx.stroke();

  drawPixelText(ctx, dishIcon, x - bubbleW / 2 + 18, y - bubbleH / 2 - 5, 16, 'center');
  drawPixelText(ctx, text, x + 8, y - bubbleH / 2 - 5, 7, 'left');
}

export function drawStation(ctx, x, y, w, h, label, icon, count, color = COLORS.foodGold) {
  drawPixelRect(ctx, x, y, w, h, COLORS.white);
  ctx.fillStyle = color + '22';
  ctx.fillRect(x + 3, y + 3, w - 6, h - 40);
  drawIcon(ctx, icon, x + w / 2, y + 40, 36);
  drawPixelText(ctx, label, x + w / 2, y + h - 28, 10, 'center');
  if (count > 0) {
    drawPixelText(ctx, `x${count}`, x + w / 2, y + h - 14, 8, 'center', COLORS.green);
  }
}

export function drawPanel(ctx, x, y, w, h, color = COLORS.cream) {
  drawPixelRect(ctx, x, y, w, h, color);
}

export function drawTable(ctx, x, y, chairs = 2) {
  drawPixelRect(ctx, x - 50, y - 20, 100, 40, COLORS.brown, COLORS.ink, 3);
  ctx.fillStyle = COLORS.wood;
  ctx.fillRect(x - 40, y - 15, 80, 30);

  for (let i = 0; i < chairs; i++) {
    const cx = i === 0 ? x - 70 : x + 70;
    const cy = y - 30;
    drawPixelRect(ctx, cx - 10, cy, 20, 20, COLORS.steel, COLORS.ink, 2);
    drawPixelRect(ctx, cx - 12, cy - 12, 24, 14, COLORS.white, COLORS.ink, 2);
  }
}

export function drawCustomer(ctx, x, y, icon, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - 12, y - 24, 24, 24);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 12, y - 24, 24, 24);
  drawIcon(ctx, icon, x, y - 12, 18);
}

export function drawGoldText(ctx, text, x, y, size = 14) {
  ctx.font = `${size}px 'Press Start 2P', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.ink;
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillStyle = COLORS.foodGold;
  ctx.fillText(text, x, y);
}

export function drawSceneTitle(ctx, text, x, y, color = COLORS.ink) {
  ctx.font = `20px 'Press Start 2P', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLORS.ink;
  ctx.fillText(text, x + 3, y + 3);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function drawMinigameOverlay(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, 800, 500);
}

export function screenShake(ctx, intensity = 4) {
  const ox = Math.floor(Math.random() * intensity * 2 - intensity);
  const oy = Math.floor(Math.random() * intensity * 2 - intensity);
  ctx.translate(ox, oy);
}

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}
