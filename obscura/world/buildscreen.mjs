// world/buildscreen.mjs — the minute between "Build it" and a world.
//
// The build hands over in about a minute now (the rest is written while the
// player plays, world/writer.mjs). That minute gets a bar that moves, the step
// it is on, an estimate that is honest about a slow step, and Snake. When the
// world is ready the player enters it - by the button, or on their own after a
// moment if nobody is mid-game.
import { createSnake, turn, tick } from './snake.mjs';

// Expectations from perchance.org (2026-09-23): a call there costs 20-30 s
// whatever its size, and the first call of a page also warms the plugin up.
// Places are named after the hand-over, so they are not a step here.
export const BUILD_STEPS = [
  { key: 'words', label: 'Choosing the words this world uses', expectMs: 22000 },
  { key: 'names', label: 'Finding the names people here have', expectMs: 1500 },
  { key: 'layout', label: 'Laying the world out', expectMs: 3000 },
  { key: 'save', label: 'Keeping it safe', expectMs: 1500 },
];

// Where the bar is and how long is left. A step that runs long holds the bar
// short of its end and still counts every step after it.
export function timeline(steps, state, now) {
  const done = new Set(state.done || []);
  const total = steps.reduce((n, s) => n + s.expectMs, 0) || 1;
  let before = 0; let part = 0; let left = 0; let after = 0;
  steps.forEach((s, i) => {
    if (done.has(s.key)) { before += s.expectMs; return; }
    if (i === state.index) {
      const elapsed = Math.max(0, now - (state.startedAt ?? now));
      part = Math.min(elapsed, s.expectMs * 0.9);
      left = elapsed >= s.expectMs ? 1500 : s.expectMs - elapsed;
      return;
    }
    after += s.expectMs;
  });
  return { fraction: Math.min(1, (before + part) / total), etaMs: left + after };
}

export function etaText(ms) {
  if (!ms || ms <= 0) return 'Almost there';
  if (ms < 10000) return 'A few seconds left';
  if (ms < 60000) return `About ${Math.round(ms / 10000) * 10} seconds left`;
  const min = Math.round(ms / 60000);
  return min <= 1 ? 'About a minute left' : `About ${min} minutes left`;
}

// Nobody is dragged out of a game: the world opens by itself only when Snake
// has not been touched for a while.
export const PLAYING_GRACE_MS = 15000;
export function shouldAutoEnter(game, now) {
  if (!game || game.lastPlayedAt == null) return true;
  return now - game.lastPlayedAt > PLAYING_GRACE_MS;
}

const COLS = 22;
const ROWS = 12;
const CELL = 14;
const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};

function readBest() {
  try { return Number(globalThis.localStorage.getItem('obscura.snake.best')) || 0; } catch { return 0; }
}
function writeBest(n) {
  try { globalThis.localStorage.setItem('obscura.snake.best', String(n)); } catch { /* private window */ }
}

// host: the element the passage gives the build. deps: document, now().
export function createBuildScreen(host, deps = {}) {
  const doc = deps.document || host.ownerDocument;
  const now = deps.now || (() => Date.now());
  const steps = (deps.steps || BUILD_STEPS).map(s => ({ ...s }));
  const state = { index: 0, startedAt: now(), done: [] };
  const h = (tag, cls) => { const e = doc.createElement(tag); if (cls) e.className = cls; return e; };

  host.textContent = '';
  const root = h('div', 'ob-build');
  const bar = h('div', 'ob-build-bar');
  const fill = h('div', 'ob-build-fill');
  bar.appendChild(fill);
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  const status = h('div', 'ob-build-status');
  const nowEl = h('span', 'ob-build-now');
  const etaEl = h('span', 'ob-build-eta');
  status.append(nowEl, etaEl);
  const list = h('ol', 'ob-build-steps');
  const items = steps.map((s) => {
    const li = h('li');
    li.textContent = s.label;
    li.dataset.state = 'pending';
    list.appendChild(li);
    return li;
  });

  const game = h('div', 'ob-snake-wrap');
  const canvas = h('canvas', 'ob-snake');
  // Drawn at the screen's own pixel density, so it is crisp on a phone; the
  // game itself is in CSS pixels.
  const W = COLS * CELL;
  const H = ROWS * CELL;
  const dpr = Math.min(2, Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  if (canvas.style) canvas.style.width = `${W}px`;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Snake. Arrow keys, WASD or swipe to play.');
  const hint = h('div', 'ob-snake-hint');
  hint.textContent = 'While you wait: Snake. Arrow keys, WASD or swipe.';
  const scoreEl = h('div', 'ob-snake-score');
  game.append(canvas, hint, scoreEl);

  const ready = h('div', 'ob-build-ready');
  ready.hidden = true;
  const enter = h('button', 'macro-button ob-build-enter');
  enter.type = 'button';
  enter.textContent = 'Enter your world';
  ready.appendChild(enter);

  root.append(bar, status, list, game, ready);
  host.appendChild(root);

  // ---- Snake ------------------------------------------------------------
  const play = { snake: createSnake({ cols: COLS, rows: ROWS }), running: false, lastPlayedAt: null, best: readBest() };
  let loop = null;
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  const draw = () => {
    if (!ctx) return;
    const s = play.snake;
    if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // a board a shade lighter than the card it sits on, with a faint grid:
    // at the card's own colour it was invisible, and so was where to play
    ctx.fillStyle = '#191a1f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#202227';
    for (let x = 1; x < COLS; x++) ctx.fillRect(x * CELL, 0, 1, H);
    for (let y = 1; y < ROWS; y++) ctx.fillRect(0, y * CELL, W, 1);
    if (s.food) {
      ctx.fillStyle = '#e0313f';
      if (ctx.arc) {
        ctx.beginPath();
        ctx.arc(s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(s.food.x * CELL + 3, s.food.y * CELL + 3, CELL - 6, CELL - 6);
      }
    }
    s.body.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? '#f2f3f5' : '#a4a8b0';
      ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2);
    });
    if (s.over || !play.running) {
      ctx.fillStyle = 'rgba(12,13,15,.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e6e7ea';
      ctx.font = '13px Lexend-Regular, sans-serif';
      ctx.textAlign = 'center';
      // above the snake, which starts on the middle row
      ctx.fillText(s.over ? `Score ${s.score}. Any arrow to go again.` : 'Press an arrow key or swipe to start',
        W / 2, Math.round(H * 0.28));
    }
    scoreEl.textContent = `Score ${s.score}   Best ${Math.max(play.best, s.score)}`;
  };
  const stepGame = () => {
    tick(play.snake);
    if (play.snake.over) {
      clearInterval(loop); loop = null; play.running = false;
      if (play.snake.score > play.best) { play.best = play.snake.score; writeBest(play.best); }
    }
    draw();
  };
  const steer = (dir) => {
    play.lastPlayedAt = now();
    if (play.snake.over) play.snake = createSnake({ cols: COLS, rows: ROWS });
    turn(play.snake, dir);
    if (!play.running) { play.running = true; loop = setInterval(stepGame, 110); }
  };
  const onKey = (e) => {
    if (!root.isConnected) return;
    const dir = KEYS[e.key];
    if (!dir) return;
    e.preventDefault();
    steer(dir);
  };
  doc.addEventListener('keydown', onKey);
  let touch = null;
  canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY }; }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!touch) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x; const dy = t.clientY - touch.y;
    touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) { steer(play.snake.dir.x ? (play.snake.dir.x > 0 ? 'right' : 'left') : (play.snake.dir.y > 0 ? 'down' : 'up')); return; }
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  canvas.addEventListener('click', () => { try { canvas.focus(); } catch { /* fine */ } });
  draw();

  // ---- the build ---------------------------------------------------------
  const paint = () => {
    if (!root.isConnected) { destroy(); return; }
    const t = timeline(steps, state, now());
    const pct = Math.round(t.fraction * 100);
    fill.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(pct));
    etaEl.textContent = etaText(t.etaMs);
    items.forEach((li, i) => {
      li.dataset.state = state.done.includes(steps[i].key) ? 'done' : (i === state.index ? 'active' : 'pending');
    });
  };
  let ticker = setInterval(paint, 250);
  let autoTimer = null;

  function destroy() {
    clearInterval(ticker); ticker = null;
    clearInterval(loop); loop = null;
    clearInterval(autoTimer); autoTimer = null;
    doc.removeEventListener('keydown', onKey);
  }

  const api = {
    status(text) { nowEl.textContent = text; },
    step(key) {
      const i = steps.findIndex(s => s.key === key);
      if (i === -1) return;
      for (let j = 0; j < i; j++) if (!state.done.includes(steps[j].key)) state.done.push(steps[j].key);
      state.index = i;
      state.startedAt = now();
      nowEl.textContent = steps[i].label;
      paint();
    },
    expect(key, ms) { const s = steps.find(x => x.key === key); if (s) s.expectMs = ms; },
    ready(onEnter) {
      for (const s of steps) if (!state.done.includes(s.key)) state.done.push(s.key);
      state.index = steps.length;
      paint();
      clearInterval(ticker); ticker = null;
      nowEl.textContent = 'Your world is ready.';
      etaEl.textContent = '';
      ready.hidden = false;
      let entered = false;
      const go = () => { if (entered) return; entered = true; destroy(); onEnter(); };
      enter.addEventListener('click', go);
      const readyAt = now();
      autoTimer = setInterval(() => {
        if (!root.isConnected) { destroy(); return; }
        if (now() - readyAt > 3000 && shouldAutoEnter(play, now())) go();
      }, 500);
    },
    fail(message) {
      destroy();
      nowEl.textContent = message;
      etaEl.textContent = '';
    },
    destroy,
    game: play,
  };
  return api;
}
