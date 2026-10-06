import { COLORS, RECIPES, getCustomerTypes } from '../data.js';
import { drawPixelRect, drawPixelButton, drawPixelText, drawPanel, drawIcon,
         drawDoorway, drawTable, drawCustomer, drawThoughtBubble, drawProgressBar } from '../renderer.js';
import { isInRect, getMouse } from '../input.js';

const tables = [
  { id: 't1', x: 200, y: 130, chairs: [null, null] },
  { id: 't2', x: 520, y: 130, chairs: [null, null] },
  { id: 't3', x: 200, y: 310, chairs: [null, null] },
  { id: 't4', x: 520, y: 310, chairs: [null, null] },
];

let customers = [];
let spawnTimer = 0;
let spawnInterval = 2200;
let allSpawned = false;
let hoveredDoor = false;

export function enterDining(state) {
  customers = [];
  spawnTimer = 0;
  allSpawned = false;
  hoveredDoor = false;

  tables.forEach(t => { t.chairs[0] = null; t.chairs[1] = null; });

  const customerCount = 6 + Math.floor(Math.random() * 4);
  customers = getCustomerTypes(customerCount);

  customers.forEach(c => {
    c.spawned = false;
    c.hasOrdered = false;
    c.orderFulfilled = false;
    c.lost = false;
    c.hasBeenServed = false;
    c.seatedAt = null;
    c.order = null;
    c.patienceRemaining = 0;
  });

  spawnCustomer();
  spawnCustomer();
}

export function exitDining(state) {
  state.customersToday = [...customers];
}

export function updateDining(dt, state) {
  const mouse = getMouse();
  hoveredDoor = isInRect(mouse.x, mouse.y, 680, 410, 70, 70);

  if (!allSpawned) {
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      const remaining = customers.filter(c => !c.spawned);
      if (remaining.length === 0) {
        allSpawned = true;
      } else {
        spawnCustomer();
      }
    }
  }

  for (const c of customers) {
    if (!c.spawned || c.hasBeenServed) continue;

    if (!c.hasOrdered) {
      c.order = c.favDish;
      c.hasOrdered = true;
      c.patienceRemaining = c.patience;
    }

    if (!c.orderFulfilled) {
      c.patienceRemaining -= dt / 1000;
      if (c.patienceRemaining <= 0 && !c.lost) {
        c.lost = true;
        c.hasBeenServed = true;
        state.customersLost++;
      }
    }
  }
}

function spawnCustomer() {
  const availCust = customers.filter(c => !c.spawned);
  if (availCust.length === 0) return;
  const cust = availCust[0];

  for (const table of tables) {
    for (let i = 0; i < 2; i++) {
      if (table.chairs[i] === null) {
        table.chairs[i] = cust.id;
        cust.seatedAt = { table: table.id, chair: i };
        cust.spawned = true;
        cust.hasOrdered = false;
        cust.orderFulfilled = false;
        cust.lost = false;
        return;
      }
    }
  }
}

function getTableChairPos(tableId, chairIdx) {
  const table = tables.find(t => t.id === tableId);
  if (!table) return { x: 0, y: 0 };
  return {
    x: table.x + (chairIdx === 0 ? -75 : 75),
    y: table.y - 20,
  };
}

function findCustomerAt(x, y) {
  for (const table of tables) {
    for (let i = 0; i < 2; i++) {
      const cid = table.chairs[i];
      if (!cid) continue;
      const pos = getTableChairPos(table.id, i);
      if (isInRect(x, y, pos.x - 24, pos.y - 44, 48, 55)) {
        const cust = customers.find(c => c.id === cid);
        if (cust && !cust.hasBeenServed) {
          return { customer: cust, tableId: table.id, chairIdx: i };
        }
      }
    }
  }
  return null;
}

export function diningMouseDown(x, y, state) {
  if (hoveredDoor) {
    state.sceneParams.next = 'kitchen';
    return;
  }

  const hit = findCustomerAt(x, y);
  if (!hit || !hit.customer) return;

  const cust = hit.customer;
  if (!cust.spawned || cust.hasBeenServed) return;

  const orderedDish = cust.favDish;
  const dishIdx = state.preparedDishes.indexOf(orderedDish);
  if (dishIdx === -1) return;

  state.preparedDishes.splice(dishIdx, 1);
  cust.orderFulfilled = true;
  cust.hasBeenServed = true;
  state.customersServed++;

  const recipe = RECIPES[orderedDish];
  const tip = Math.floor(recipe.basePrice * cust.tipMult - recipe.basePrice);
  state.dayRevenue += recipe.basePrice;
  state.dayTips += Math.max(0, tip);
  state.money += recipe.basePrice + Math.max(0, tip);
  state.dishesServed++;
}

export function renderDining(ctx, state) {
  ctx.fillStyle = '#f0e0c0';
  ctx.fillRect(0, 0, 800, 500);

  for (let x = 20; x < 800; x += 50) {
    ctx.fillStyle = '#d4a57422';
    ctx.fillRect(x, 0, 1, 500);
  }

  drawPanel(ctx, 10, 10, 780, 42, COLORS.cream);
  drawPixelText(ctx, `🍽️ DINING ROOM — DAY ${state.day}`, 400, 25, 10, 'center', COLORS.ink);
  drawPixelText(ctx, `₦${state.money}`, 730, 25, 10, 'center', COLORS.foodGold);

  for (const table of tables) {
    drawTable(ctx, table.x, table.y);
  }

  for (const table of tables) {
    for (let i = 0; i < 2; i++) {
      const cid = table.chairs[i];
      if (!cid) continue;
      const cust = customers.find(c => c.id === cid);
      if (!cust) continue;

      const pos = getTableChairPos(table.id, i);
      const col = cust.hasBeenServed
        ? (cust.lost ? '#999' : COLORS.green)
        : cust.portraitColor;

      drawCustomer(ctx, pos.x, pos.y, cust.icon, col);

      if (cust.hasBeenServed) {
        const emoji = cust.lost ? '😡' : '💚';
        drawPixelText(ctx, emoji, pos.x, pos.y - 28, 14, 'center');
        continue;
      }

      if (cust.hasOrdered && !cust.orderFulfilled) {
        const recipe = RECIPES[cust.order];
        if (recipe) {
          drawThoughtBubble(ctx, pos.x, pos.y - 26, recipe.name, recipe.icon);
          const patienceRatio = cust.patienceRemaining / cust.patience;
          const pColor = patienceRatio > 0.4 ? COLORS.green : patienceRatio > 0.2 ? COLORS.foodGold : COLORS.pepper;
          drawProgressBar(ctx, pos.x - 24, pos.y - 37, 48, 5, cust.patienceRemaining, cust.patience, pColor);
        }
      }
    }
  }

  drawDoorway(ctx, 680, 410, 70, 70, 'KITCHEN', COLORS.seaBlue, 'left');
  drawPixelText(ctx, '◀ Kitchen', 672, 400, 6, 'left', COLORS.ink);

  drawPanel(ctx, 580, 60, 195, 90, COLORS.palmOil);
  drawPixelText(ctx, '📋 PREPPED', 677, 72, 8, 'center', COLORS.ink);
  const prepCounts = {};
  for (const d of state.preparedDishes) {
    prepCounts[d] = (prepCounts[d] || 0) + 1;
  }
  let prepY = 86;
  for (const [dish, count] of Object.entries(prepCounts)) {
    const recipe = RECIPES[dish];
    drawPixelText(ctx, `${recipe.icon} x${count}`, 677, prepY, 7, 'center', COLORS.ink);
    prepY += 16;
  }
  if (Object.keys(prepCounts).length === 0) {
    drawPixelText(ctx, 'Nothing prepped!', 677, prepY, 7, 'center', COLORS.pepper);
  }

  drawPanel(ctx, 10, 420, 660, 65, COLORS.white);
  const totalCust = customers.length;
  const happy = customers.filter(c => c.hasBeenServed && !c.lost).length;
  const lost = customers.filter(c => c.lost).length;
  drawPixelText(ctx, `🍽️ Served: ${happy}/${totalCust}`, 60, 442, 7, 'left', COLORS.ink);
  drawPixelText(ctx, `😡 Lost: ${lost}`, 60, 460, 7, 'left', COLORS.pepper);
  drawPixelText(ctx, `💰 ₦${state.dayRevenue}`, 250, 442, 8, 'left', COLORS.foodGold);
  drawPixelText(ctx, `💝 Tips: ₦${state.dayTips}`, 250, 460, 7, 'left', COLORS.green);

  drawPixelText(ctx, 'Click customers to serve prepped dishes', 400, 485, 7, 'center', '#999');
}
