import { COLORS, INGREDIENT_NAMES, INGREDIENT_PRICES } from '../data.js';
import { drawPixelRect, drawPixelButton, drawPixelText, drawPanel, drawIcon,
         drawDoorway, drawGoldText } from '../renderer.js';
import { isInRect, getMouse } from '../input.js';

let buyButtons = [];
let hoveredBtn = null;

export function enterMarket(state) {
  buyButtons = [];
  hoveredBtn = null;
  buildButtons(state);
}

export function exitMarket(state) {}

export function updateMarket(dt, state) {
  const mouse = getMouse();
  hoveredBtn = null;
  buildButtons(state);

  for (const btn of buyButtons) {
    if (isInRect(mouse.x, mouse.y, btn.x, btn.y, btn.w, btn.h)) {
      hoveredBtn = btn;
    }
  }
}

function buildButtons(state) {
  buyButtons = [];
  const keys = Object.keys(INGREDIENT_PRICES);
  const startY = 140;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = 50 + col * 380;
    const by = startY + row * 55;
    const price = INGREDIENT_PRICES[key];
    const canAfford = state.money >= price;

    buyButtons.push({
      id: key,
      x: bx + 280,
      y: by + 12,
      w: 70,
      h: 26,
      ingredient: key,
      price,
      canAfford,
    });
  }
}

export function marketMouseDown(x, y, state) {
  buildButtons(state);

  for (const btn of buyButtons) {
    if (isInRect(x, y, btn.x, btn.y, btn.w, btn.h) && btn.canAfford) {
      state.money -= btn.price;
      state.inventory[btn.ingredient] = (state.inventory[btn.ingredient] || 0) + 1;
      return;
    }
  }

  if (isInRect(x, y, 580, 415, 70, 60)) {
    state.sceneParams.next = 'kitchen';
  }
}

export function renderMarket(ctx, state) {
  ctx.fillStyle = '#faf5e8';
  ctx.fillRect(0, 0, 800, 500);

  for (let x = 20; x < 800; x += 60) {
    ctx.fillStyle = '#e0d5c0';
    ctx.fillRect(x, 0, 1, 500);
  }

  drawPanel(ctx, 10, 10, 780, 45, COLORS.cream);
  drawPixelText(ctx, '🌅 DAWN MARKET — MAMA NKECHI', 400, 30, 11, 'center', COLORS.ink);
  drawGoldText(ctx, `₦${state.money}`, 730, 30, 12);

  drawPixelRect(ctx, 180, 65, 440, 52, COLORS.palmOil);
  drawIcon(ctx, '👩🏾', 220, 90, 30);
  drawPixelText(ctx, '"Welcome, my pikin! Make you buy well-oo!"', 430, 90, 8, 'center', COLORS.ink);

  buildButtons(state);

  const keys = Object.keys(INGREDIENT_PRICES);
  const startY = 140;
  const emojiMap = {
    beef: '🥩', rice: '🌾', tomato: '🍅', pepper: '🌶️',
    oil: '🫗', melonSeeds: '🫘', palmOil: '🍯', leaf: '🥬', crayfish: '🦐',
  };

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = 50 + col * 380;
    const by = startY + row * 55;
    const price = INGREDIENT_PRICES[key];
    const owned = state.inventory[key] || 0;

    drawPixelRect(ctx, bx, by, 330, 46, COLORS.white);

    drawIcon(ctx, emojiMap[key] || '📦', bx + 22, by + 23, 18);
    drawPixelText(ctx, INGREDIENT_NAMES[key], bx + 50, by + 14, 8, 'left', COLORS.ink);
    drawPixelText(ctx, `x${owned}`, bx + 240, by + 14, 7, 'center', owned > 0 ? COLORS.ink : '#ccc');

    const canAfford = state.money >= price;
    const isHovered = hoveredBtn && hoveredBtn.ingredient === key;
    const btnColor = canAfford ? (isHovered ? COLORS.green : COLORS.seaBlue) : '#aaa';
    drawPixelButton(ctx, bx + 262, by + 10, 58, 24, `₦${price}`, btnColor, COLORS.white, canAfford && isHovered);
  }

  drawDoorway(ctx, 580, 415, 70, 65, 'KITCHEN', COLORS.wood, 'right');
  drawPixelText(ctx, '◀ Kitchen', 580, 408, 6, 'left', COLORS.ink);
}
