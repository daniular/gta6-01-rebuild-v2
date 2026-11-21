// Keyboard + mouse state for Crest Bay Heat. The rest of the game reads
// this object; nothing else touches the DOM events.
//
// Two kinds of key state: `keys` (held down right now, for movement and
// driving) and `justPressed` (an edge that fired since the last frame, for
// actions like entering a car). The edge set matters because a quick tap
// can land and lift between two animation frames — held state alone
// would lose it. The game clears the edges once per frame.

export function createInput(canvas) {
  const input = {
    keys: Object.create(null),
    justPressed: Object.create(null),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false, // set for one frame when the left button goes down
    anyKey: false,
  };

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (!input.keys[k]) input.justPressed[k] = true;
    input.keys[k] = true;
    input.anyKey = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    input.keys[keyName(e)] = false;
  });
  window.addEventListener('blur', () => {
    input.keys = Object.create(null);
    input.mouseDown = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.clicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}

export function pressed(input, ...names) {
  return names.some((n) => input.keys[n]);
}

// True once for a tap, then the edge is spent.
export function wasPressed(input, ...names) {
  for (const n of names) {
    if (input.justPressed[n]) {
      input.justPressed[n] = false;
      return true;
    }
  }
  return false;
}

// Called once per frame after the game has read the input.
export function endFrame(input) {
  input.justPressed = Object.create(null);
  input.clicked = false;
}

export function consumeClick(input) {
  const c = input.clicked;
  input.clicked = false;
  return c;
}
