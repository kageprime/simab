let mouseX = 0;
let mouseY = 0;
let mouseDown = false;
let mouseJustPressed = false;
let mouseJustReleased = false;
let prevMouseDown = false;

const downHandlers = [];
const upHandlers = [];
const moveHandlers = [];

export function initInput(canvas) {
  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  canvas.addEventListener('mousedown', (e) => {
    const pos = getCanvasPos(e);
    mouseX = pos.x;
    mouseY = pos.y;
    mouseDown = true;
    for (const h of downHandlers) h(pos.x, pos.y);
  });

  canvas.addEventListener('mouseup', (e) => {
    const pos = getCanvasPos(e);
    mouseX = pos.x;
    mouseY = pos.y;
    mouseDown = false;
    mouseJustReleased = true;
    for (const h of upHandlers) h(pos.x, pos.y);
  });

  canvas.addEventListener('mousemove', (e) => {
    const pos = getCanvasPos(e);
    mouseX = pos.x;
    mouseY = pos.y;
    for (const h of moveHandlers) h(pos.x, pos.y);
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const pos = getCanvasPos(e.touches[0]);
    mouseX = pos.x;
    mouseY = pos.y;
    mouseDown = true;
    for (const h of downHandlers) h(pos.x, pos.y);
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    mouseDown = false;
    mouseJustReleased = true;
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const pos = getCanvasPos(e.touches[0]);
    mouseX = pos.x;
    mouseY = pos.y;
    for (const h of moveHandlers) h(pos.x, pos.y);
  }, { passive: false });
}

export function updateInput() {
  mouseJustPressed = mouseDown && !prevMouseDown;
  mouseJustReleased = prevMouseDown && !mouseDown;
  prevMouseDown = mouseDown;
}

export function getMouse() {
  return { x: mouseX, y: mouseY, down: mouseDown, justPressed: mouseJustPressed, justReleased: mouseJustReleased };
}

export function onMouseDown(fn) { downHandlers.push(fn); }
export function onMouseUp(fn) { upHandlers.push(fn); }
export function onMouseMove(fn) { moveHandlers.push(fn); }

export function isInRect(mx, my, x, y, w, h) {
  return mx >= x && mx <= x + w && my >= y && my <= y + h;
}
