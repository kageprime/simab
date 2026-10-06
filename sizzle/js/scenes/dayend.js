import { COLORS } from '../data.js';
import { drawPixelRect, drawPixelButton, drawPixelText, drawPanel, drawIcon, drawGoldText } from '../renderer.js';
import { isInRect, getMouse } from '../input.js';

let hoveredNext = false;

export function enterDayEnd(state) {
  hoveredNext = false;
}

export function exitDayEnd(state) {}

export function updateDayEnd(dt, state) {
  const mouse = getMouse();
  hoveredNext = isInRect(mouse.x, mouse.y, 300, 415, 200, 48);
}

export function dayEndMouseDown(x, y, state) {
  if (hoveredNext) {
    state.day++;
    state.phase = 'dawn';
    state.preparedDishes = [];
    state.customersToday = [];
    state.customersServed = 0;
    state.customersLost = 0;
    state.dayRevenue = 0;
    state.dayTips = 0;
    state.dishesServed = 0;
    state.sceneParams.next = 'kitchen';
  }
}

export function renderDayEnd(ctx, state) {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 800, 500);

  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * 800, Math.random() * 500, 2, 2);
  }

  drawPixelRect(ctx, 80, 40, 640, 430, COLORS.cream);

  drawPixelText(ctx, `DAY ${state.day} COMPLETE`, 400, 72, 15, 'center', COLORS.ink);

  const stars = state.customersServed >= 8 ? 3 : state.customersServed >= 5 ? 2 : state.customersServed >= 2 ? 1 : 0;
  drawPixelText(ctx, '★'.repeat(stars) + '☆'.repeat(3 - stars), 400, 108, 20, 'center', COLORS.foodGold);

  const items = [
    { icon: '🍽️', label: 'Dishes Served', value: `${state.dishesServed}` },
    { icon: '👥', label: 'Customers Happy', value: `${state.customersServed}` },
    { icon: '😡', label: 'Customers Lost', value: `${state.customersLost}` },
    { icon: '💰', label: 'Earnings', value: `₦${state.dayRevenue}` },
    { icon: '💝', label: 'Tips', value: `₦${state.dayTips}` },
    { icon: '🏦', label: 'Total Money', value: `₦${state.money}` },
  ];

  items.forEach((item, i) => {
    const ix = 140 + (i % 2) * 300;
    const iy = 140 + Math.floor(i / 2) * 48;
    drawIcon(ctx, item.icon, ix, iy + 12, 20);
    drawPixelText(ctx, item.label, ix + 70, iy + 6, 6, 'left', '#666');
    drawPixelText(ctx, item.value, ix + 70, iy + 22, 10, 'left', COLORS.ink);
  });

  const msg = state.customersServed >= 8
    ? '🔥 Legendary day! The kitchen is singing!'
    : state.customersServed >= 5
      ? '👍 Solid service. The regulars are happy.'
      : '😅 Room to grow. Cook more dishes tomorrow!';
  drawPixelText(ctx, msg, 400, 340, 7, 'center', COLORS.brown);

  drawPixelButton(ctx, 300, 415, 200, 48, 'NEXT DAY ▶', COLORS.green, COLORS.white, hoveredNext);
}
