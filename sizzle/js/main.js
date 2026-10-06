import { COLORS, createGameState } from './data.js';
import { drawPixelRect, drawPixelText, drawPixelButton, drawIcon } from './renderer.js';
import { initInput, updateInput, getMouse, isInRect } from './input.js';
import { enterKitchen, updateKitchen, renderKitchen, kitchenMouseDown, exitKitchen } from './scenes/kitchen.js';
import { enterDining, updateDining, renderDining, diningMouseDown, exitDining } from './scenes/dining.js';
import { enterMarket, updateMarket, renderMarket, marketMouseDown, exitMarket } from './scenes/market.js';
import { enterDayEnd, updateDayEnd, renderDayEnd, dayEndMouseDown, exitDayEnd } from './scenes/dayend.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const SCENES = {
  kitchen: { enter: enterKitchen, exit: exitKitchen, update: updateKitchen, render: renderKitchen, onMouseDown: kitchenMouseDown },
  dining: { enter: enterDining, exit: exitDining, update: updateDining, render: renderDining, onMouseDown: diningMouseDown },
  market: { enter: enterMarket, exit: exitMarket, update: updateMarket, render: renderMarket, onMouseDown: marketMouseDown },
  dayend: { enter: enterDayEnd, exit: exitDayEnd, update: updateDayEnd, render: renderDayEnd, onMouseDown: dayEndMouseDown },
  title: { enter: enterTitle, exit: exitTitle, update: updateTitle, render: renderTitle, onMouseDown: titleMouseDown },
};

let currentScene = 'title';
let gameState = createGameState();
let lastTime = 0;
let titleHoverStart = false;

function switchScene(newScene) {
  if (SCENES[currentScene] && SCENES[currentScene].exit) {
    SCENES[currentScene].exit(gameState);
  }
  currentScene = newScene;
  gameState.sceneParams = {};
  if (SCENES[currentScene] && SCENES[currentScene].enter) {
    SCENES[currentScene].enter(gameState);
  }
}

function gameLoop(timestamp) {
  const dt = lastTime ? Math.min(timestamp - lastTime, 50) : 16;
  lastTime = timestamp;

  updateInput();
  const mouse = getMouse();

  if (SCENES[currentScene] && SCENES[currentScene].update) {
    SCENES[currentScene].update(dt, gameState);
  }

  if (gameState.sceneParams.next) {
    const next = gameState.sceneParams.next;
    gameState.sceneParams.next = undefined;

    if (next === 'kitchen') {
      if ((gameState.customersServed > 0 || gameState.customersLost > 0) && gameState.phase !== 'dawn') {
        switchScene('dayend');
      } else {
        switchScene('kitchen');
      }
    } else {
      switchScene(next);
    }
  }

  if (mouse.justPressed && SCENES[currentScene] && SCENES[currentScene].onMouseDown) {
    SCENES[currentScene].onMouseDown(mouse.x, mouse.y, gameState);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (SCENES[currentScene] && SCENES[currentScene].render) {
    SCENES[currentScene].render(ctx, gameState);
  }

  requestAnimationFrame(gameLoop);
}

function enterTitle(state) { titleHoverStart = false; }
function exitTitle(state) {}

function updateTitle(dt, state) {
  const mouse = getMouse();
  titleHoverStart = isInRect(mouse.x, mouse.y, 270, 360, 260, 55);
}

function titleMouseDown(x, y, state) {
  if (titleHoverStart) {
    switchScene('kitchen');
    gameState.phase = 'dawn';
  }
}

function renderTitle(ctx, state) {
  const w = canvas.width, h = canvas.height;
  const cx = w / 2;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, COLORS.oceanDeep);
  grad.addColorStop(0.5, COLORS.seaBlue);
  grad.addColorStop(1, COLORS.sky);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.15})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }

  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(cx - 2, 35, 4, 210);

  ctx.fillStyle = '#5c3a1e';
  ctx.fillRect(cx - 40, 120, 80, 50);
  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(cx - 30, 128, 60, 34);

  ctx.fillStyle = COLORS.sizzle;
  ctx.fillRect(cx - 55, 55, 110, 8);

  drawPixelText(ctx, 'SEA SALT', cx, 200, 26, 'center', COLORS.white);
  drawPixelText(ctx, '& SIZZLE', cx, 235, 22, 'center', COLORS.foodGold);

  drawPixelRect(ctx, cx - 140, 260, 280, 36, COLORS.ink);
  drawPixelText(ctx, 'GRAND KITCHEN', cx, 280, 13, 'center', COLORS.palmOil);

  drawPixelText(ctx, 'Pepper Coast', cx, 320, 9, 'center', COLORS.sky);

  drawPixelButton(ctx, 270, 360, 260, 55, 'START COOKING!', COLORS.sizzle, COLORS.white, titleHoverStart);

  drawPixelText(ctx, 'Cook. Serve. Build a legend.', cx, 440, 7, 'center', '#7dd3fc');
  drawPixelText(ctx, 'Made in Abuja', cx, 458, 7, 'center', '#7dd3fc');

  drawIcon(ctx, '🚢', 80, h - 55, 36);
  drawIcon(ctx, '🍳', 720, h - 55, 36);
}

function init() {
  initInput(canvas);
  switchScene('title');
  requestAnimationFrame(gameLoop);
}

init();
