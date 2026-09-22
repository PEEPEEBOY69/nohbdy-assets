// world/pixels.mjs — turning a painted picture into a place picture.
//
// Perchance's image generator paints a square scene on a background. The
// chassis shows a place in a 128x112 frame, and every shipped room is an
// isometric cutout with nothing around it. These are the steps between the
// two, on raw RGBA arrays so they are testable without a canvas:
//
//   keyOutBackground  the painter asks for a plain white background; a flood
//                     fill from the border clears it. A fill, not a colour
//                     key: white INSIDE the room (a sink, a sheet) touches no
//                     border and stays.
//   alphaBox          what is left, so the room is fitted, not the canvas
//   fitInto           the largest size that keeps the aspect inside a box
//   hardenAlpha       alpha becomes 0 or 255 after the downscale, so the edge
//                     is a pixel edge, like the shipped art
//
// The plugin also offers removeBackground, but it downloads a 44 MB model into
// the page on first use. A flood fill costs nothing and suits a background the
// prompt asked to be plain.
export const FRAME_W = 128;
export const FRAME_H = 112;
export const SCALE = 2;
export const TOLERANCE = 48;

const dist2 = (d, i, c) => {
  const r = d[i] - c[0]; const g = d[i + 1] - c[1]; const b = d[i + 2] - c[2];
  return r * r + g * g + b * b;
};

// The background is the colour most of the border agrees on. Colours are
// bucketed (4 bits a channel) so compression noise votes together. A border
// with no clear majority has no plain background, and nothing is cleared.
function borderColour(d, w, h) {
  const votes = new Map();
  let total = 0;
  const vote = (x, y) => {
    const i = (y * w + x) * 4;
    const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const v = votes.get(k) || { n: 0, r: 0, g: 0, b: 0 };
    v.n += 1; v.r += d[i]; v.g += d[i + 1]; v.b += d[i + 2];
    votes.set(k, v);
    total += 1;
  };
  for (let x = 0; x < w; x++) { vote(x, 0); vote(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { vote(0, y); vote(w - 1, y); }
  let best = null;
  for (const v of votes.values()) if (!best || v.n > best.n) best = v;
  if (!best || best.n < total * 0.4) return null;
  return [best.r / best.n, best.g / best.n, best.b / best.n];
}

export function keyOutBackground(d, w, h, opts = {}) {
  const tol2 = (opts.tolerance ?? TOLERANCE) ** 2;
  const bg = borderColour(d, w, h);
  if (!bg) return { cleared: 0, bg: null };
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (dist2(d, p * 4, bg) <= tol2) stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  let cleared = 0;
  while (stack.length) {
    const p = stack.pop();
    d[p * 4 + 3] = 0;
    cleared += 1;
    const x = p % w; const y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  return { cleared, bg };
}

export function alphaBox(d, w, h, threshold = 16) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] <= threshold) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function fitInto(w, h, maxW, maxH) {
  if (!(w > 0) || !(h > 0)) return { w: 1, h: 1 };
  const k = Math.min(maxW / w, maxH / h);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export function hardenAlpha(d, cut = 128) {
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= cut ? 255 : 0;
  return d;
}
