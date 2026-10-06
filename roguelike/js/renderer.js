// Pixel-art helpers (same vibe as Sizzle game)
import { COLORS } from './data.js';

export function pxRect(ctx, x, y, w, h, color, border = '#000', bw = 3) {
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + bw, y + bw, w - bw * 2, h - bw * 2);
}

export function pxText(ctx, text, x, y, size = 12, align = 'center', color = '#fff') {
  ctx.font = `${size}px 'Press Start 2P', monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function pxButton(ctx, x, y, w, h, text, color, hovered) {
  const s = hovered ? 2 : 4;
  ctx.fillStyle = '#000';
  ctx.fillRect(x + s, y + s, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  pxText(ctx, text, x + w / 2, y + h / 2 + 1, 11, 'center', '#fff');
}

export function bar(ctx, x, y, w, h, v, max, fill, bg = '#222') {
  pxRect(ctx, x, y, w, h, bg, '#000', 2);
  const fw = Math.max(0, Math.min(w - 6, ((w - 6) * v) / Math.max(1, max)));
  if (fw > 0) { ctx.fillStyle = fill; ctx.fillRect(x + 3, y + 3, fw, h - 6); }
}

export function emoji(ctx, icon, x, y, size = 28) {
  ctx.font = `${size}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, x, y);
}

export function particles(ctx, list) {
  for (const p of list) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

export function damageNumbers(ctx, list) {
  for (const d of list) {
    ctx.globalAlpha = Math.max(0, Math.min(1, d.life * 2));
    pxText(ctx, String(d.text), d.x, d.y - (d.max - d.life) * 30, d.crit ? 11 : 9, 'center', d.color);
  }
  ctx.globalAlpha = 1;
}
