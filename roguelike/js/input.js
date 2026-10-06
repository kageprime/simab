// Keyboard + mouse input (WASD/arrows, mouse aim, dash, interact)
export const keys = {};
let mouseX = 0, mouseY = 0, mouseDown = false, mousePressed = false, prevDown = false;

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    // prevent page scroll on game keys
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    // expose single-press events
    keys['__pressed_' + k] = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  function toGame(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  }
  canvas.addEventListener('mousedown', (e) => { const p = toGame(e); mouseX = p.x; mouseY = p.y; mouseDown = true; });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('mousemove', (e) => { const p = toGame(e); mouseX = p.x; mouseY = p.y; });
  canvas.addEventListener('touchstart', (e) => { const p = toGame(e.touches[0]); mouseX = p.x; mouseY = p.y; mouseDown = true; }, { passive: true });
  canvas.addEventListener('touchend', () => { mouseDown = false; }, { passive: true });
}

export function consumePressed(key) {
  const k = '__pressed_' + key.toLowerCase();
  if (keys[k]) { keys[k] = false; return true; }
  return false;
}

export function clearPressed() {
  for (const k of Object.keys(keys)) if (k.startsWith('__pressed_')) keys[k] = false;
}

export function moveVec() {
  let x = 0, y = 0;
  if (keys['a'] || keys['arrowleft']) x -= 1;
  if (keys['d'] || keys['arrowright']) x += 1;
  if (keys['w'] || keys['arrowup']) y -= 1;
  if (keys['s'] || keys['arrowdown']) y += 1;
  if (x !== 0 && y !== 0) { x *= 0.7071; y *= 0.7071; }
  return { x, y };
}

export function updateMouseEdge() {
  mousePressed = mouseDown && !prevDown;
  prevDown = mouseDown;
}

export function getAim() {
  return { x: mouseX, y: mouseY, down: mouseDown, pressed: mousePressed };
}
