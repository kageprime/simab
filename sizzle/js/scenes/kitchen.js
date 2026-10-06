import { COLORS, RECIPES } from '../data.js';
import { drawPixelRect, drawPixelButton, drawPixelText, drawStation, drawPanel, drawIcon,
         drawDoorway, drawProgressBar } from '../renderer.js';
import { isInRect, getMouse } from '../input.js';
import { startMinigame, getMinigame, updateMinigame, renderMinigame, setMinigameMouse } from './minigames.js';

const stations = [
  { id: 'suya', x: 20, y: 60, w: 240, h: 170, icon: '🥩', color: COLORS.pepper },
  { id: 'jollof', x: 280, y: 60, w: 240, h: 170, icon: '🍚', color: COLORS.foodGold },
  { id: 'egusi', x: 540, y: 60, w: 240, h: 170, icon: '🍲', color: COLORS.green },
];

let hoveredStation = null;
let hoveredDoor = null;
let failMsg = null;
let failTimer = 0;

export function enterKitchen(state) {
  hoveredStation = null;
  hoveredDoor = null;
  failMsg = null;
  failTimer = 0;
}

export function exitKitchen(state) {}

export function updateKitchen(dt, state) {
  const mouse = getMouse();
  hoveredStation = null;
  hoveredDoor = null;

  const mg = getMinigame();
  if (mg && mg.active) {
    setMinigameMouse(mouse.x, mouse.y);
    updateMinigame(dt, mouse);
    return;
  }

  for (const s of stations) {
    if (isInRect(mouse.x, mouse.y, s.x, s.y, s.w, s.h)) {
      hoveredStation = s;
    }
  }

  if (isInRect(mouse.x, mouse.y, 580, 395, 70, 85)) {
    hoveredDoor = 'dining';
  } else if (isInRect(mouse.x, mouse.y, 20, 395, 70, 85)) {
    hoveredDoor = 'market';
  }

  if (failTimer > 0) failTimer -= dt;
  if (failTimer <= 0) failMsg = null;
}

export function kitchenMouseDown(x, y, state) {
  const mg = getMinigame();
  if (mg && mg.active) return;

  for (const s of stations) {
    const recipe = RECIPES[s.id];
    if (!recipe) continue;

    if (isInRect(x, y, s.x, s.y, s.w, s.h)) {
      const hasIngredients = Object.entries(recipe.ingredients).every(
        ([ing, qty]) => (state.inventory[ing] || 0) >= qty
      );

      if (!hasIngredients) {
        failMsg = `Need more ingredients for ${recipe.name}!`;
        failTimer = 2000;
        return;
      }

      for (const [ing, qty] of Object.entries(recipe.ingredients)) {
        state.inventory[ing] -= qty;
      }

      startMinigame(s.id, (result) => {
        if (result && result.stars >= 2) {
          state.preparedDishes.push(s.id);
        }
      });
      return;
    }
  }

  if (isInRect(x, y, 580, 395, 70, 85)) {
    state.sceneParams.next = 'dining';
  } else if (isInRect(x, y, 20, 395, 70, 85)) {
    state.sceneParams.next = 'market';
  }
}

export function renderKitchen(ctx, state) {
  ctx.fillStyle = '#f5e6d3';
  ctx.fillRect(0, 0, 800, 500);

  for (let x = 20; x < 800; x += 40) {
    for (let y = 20; y < 500; y += 40) {
      ctx.fillStyle = '#e8d5b8';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  drawPanel(ctx, 5, 5, 790, 42, COLORS.cream);
  drawPixelText(ctx, `🧑‍🍳 DAY ${state.day} — GRAND KITCHEN`, 400, 25, 10, 'center', COLORS.ink);
  drawGoldText(ctx, `₦${state.money}`, 720, 25, 10);

  for (const s of stations) {
    const recipe = RECIPES[s.id];
    const prepped = state.preparedDishes.filter(d => d === s.id).length;
    const isHovered = hoveredStation === s;
    const bgColor = isHovered ? '#ffffff' : '#fafafa';
    const borderColor = isHovered ? COLORS.sizzle : COLORS.ink;

    drawPixelRect(ctx, s.x, s.y, s.w, s.h, bgColor, borderColor, 3);

    ctx.fillStyle = s.color + '18';
    ctx.fillRect(s.x + 3, s.y + 3, s.w - 6, s.h - 38);

    drawIcon(ctx, recipe.icon, s.x + s.w / 2, s.y + s.h / 2 - 10, 42);
    drawPixelText(ctx, recipe.name, s.x + s.w / 2, s.y + s.h - 26, 9, 'center');

    const ingList = Object.entries(recipe.ingredients)
      .map(([ing, q]) => `${q}x ${ing.slice(0, 5)}`)
      .join(' ');
    drawPixelText(ctx, ingList, s.x + s.w / 2, s.y + s.h - 14, 5, 'center', '#888');

    if (prepped > 0) {
      drawPixelText(ctx, `✅ READY x${prepped}`, s.x + s.w / 2, s.y + 10, 7, 'center', COLORS.green);
    }
  }

  drawPanel(ctx, 10, 245, 780, 140, COLORS.cream);
  drawPixelText(ctx, '📦 INGREDIENTS', 30, 260, 9, 'left', COLORS.ink);

  const invKeys = Object.keys(state.inventory);
  for (let i = 0; i < invKeys.length; i++) {
    const key = invKeys[i];
    const qty = state.inventory[key] || 0;
    const col = i % 4;
    const row = Math.floor(i / 4);
    drawPixelText(ctx, `${key}: ${qty}`, 30 + col * 195, 282 + row * 24, 7, 'left', qty > 0 ? COLORS.ink : '#ccc');
  }

  const prepText = state.preparedDishes.length > 0
    ? `🍽️ Prepped: ${state.preparedDishes.map(d => RECIPES[d].name.split(' ')[0]).join(', ')}`
    : 'No dishes prepped — cook at the stations above';
  drawPixelText(ctx, prepText, 30, 370, 7, 'left', state.preparedDishes.length > 0 ? COLORS.brown : '#aaa');

  if (failMsg) {
    drawPixelRect(ctx, 250, 440, 300, 30, COLORS.palmOil);
    drawPixelText(ctx, failMsg, 400, 455, 9, 'center', COLORS.pepper);
  }

  const mg = getMinigame();
  if (mg && mg.active) {
    renderMinigame(ctx);
    return;
  }

  drawDoorway(ctx, 580, 395, 70, 85, 'DINING', COLORS.seaBlue, 'right');
  drawDoorway(ctx, 20, 395, 70, 85, 'MARKET', COLORS.brown, 'left');
}
