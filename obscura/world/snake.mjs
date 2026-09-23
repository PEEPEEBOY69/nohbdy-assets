// world/snake.mjs — something to play while the world is being built.
//
// The build hands over in about a minute; that minute used to be a line of
// text that did not move. The rules live here with no canvas in sight, so they
// are tested; world/buildscreen.mjs draws them.
const DIRS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

export function createSnake(opts = {}) {
  const cols = opts.cols || 20;
  const rows = opts.rows || 14;
  const y = Math.floor(rows / 2);
  const x = Math.max(2, Math.floor(cols / 3));
  const s = {
    cols, rows,
    body: [{ x, y }, { x: x - 1, y }, { x: x - 2, y }],
    dir: { ...DIRS.right },
    next: { ...DIRS.right },
    food: null,
    score: 0,
    over: false,
  };
  placeFood(s, opts.rand || Math.random);
  return s;
}

// Turning straight back into your own neck is ignored, not fatal.
export function turn(s, name) {
  const d = DIRS[name];
  if (!d || s.over) return s;
  if (d.x === -s.dir.x && d.y === -s.dir.y) return s;
  s.next = { ...d };
  return s;
}

export function placeFood(s, rand = Math.random) {
  const taken = new Set(s.body.map(p => `${p.x},${p.y}`));
  const free = [];
  for (let yy = 0; yy < s.rows; yy++) {
    for (let xx = 0; xx < s.cols; xx++) if (!taken.has(`${xx},${yy}`)) free.push({ x: xx, y: yy });
  }
  s.food = free.length ? free[Math.min(free.length - 1, Math.floor(rand() * free.length))] : null;
  return s;
}

export function tick(s, rand = Math.random) {
  if (s.over) return s;
  s.dir = { ...s.next };
  const head = { x: s.body[0].x + s.dir.x, y: s.body[0].y + s.dir.y };
  const eats = s.food && head.x === s.food.x && head.y === s.food.y;
  // The tail moves out of the way this tick unless the snake is growing.
  const body = eats ? s.body : s.body.slice(0, -1);
  const hitsWall = head.x < 0 || head.y < 0 || head.x >= s.cols || head.y >= s.rows;
  const hitsSelf = body.some(p => p.x === head.x && p.y === head.y);
  if (hitsWall || hitsSelf) { s.over = true; return s; }
  s.body = [head, ...body];
  if (eats) { s.score += 1; placeFood(s, rand); }
  return s;
}
