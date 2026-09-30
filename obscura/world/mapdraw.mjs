// world/mapdraw.mjs — the Maps screen: each area's picture, then its places
// drawn with the paths you can walk, and a click on a place to go there.
//
// Drawn from the geography itself, so nothing is on the map that cannot be
// reached. Two drawings of each area - four places a row, and two for a phone -
// and the stylesheet shows the one that fits.
import { shortestPath, travelMinutes } from './geography.mjs';

const BOX_W = 150;
const BOX_H = 30;
const GAP_X = 22;
const GAP_Y = 14;
const PAD = 12;
const INDENT = 10;

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = (s, n = 20) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

// Outdoor places in rows; under each, the indoor places reached through it
// (breadth first, indoor only); a room indented under its building.
export function areaLayout(geo, areaId, { columns = 4 } = {}) {
  const inArea = Object.keys(geo.places).filter((k) => geo.places[k].area === areaId);
  const placed = new Set();
  const under = (root) => {
    const out = [];
    const queue = [[root, 0]];
    while (queue.length) {
      const [k, depth] = queue.shift();
      for (const e of geo.places[k].exits) {
        const p = geo.places[e];
        if (!p || placed.has(e) || p.area !== areaId || !p.indoor) continue;
        placed.add(e);
        out.push({ key: e, depth: depth + 1 });
        queue.push([e, depth + 1]);
      }
    }
    return out;
  };
  const tops = inArea.filter((k) => !geo.places[k].indoor);
  const cols = [];
  for (const k of tops) placed.add(k);
  for (const k of tops) cols.push({ key: k, below: under(k) });
  for (const k of inArea) {
    if (placed.has(k)) continue;
    placed.add(k);
    cols.push({ key: k, below: under(k) });
  }
  const boxes = {};
  let y = PAD;
  let width = 0;
  for (let r = 0; r * columns < cols.length; r += 1) {
    let rowH = 0;
    cols.slice(r * columns, (r + 1) * columns).forEach((c, i) => {
      const x = PAD + i * (BOX_W + GAP_X);
      boxes[c.key] = { x, y, w: BOX_W, h: BOX_H };
      c.below.forEach((b, j) => {
        const inset = Math.min(b.depth - 1, 2) * INDENT;
        boxes[b.key] = { x: x + inset, y: y + (j + 1) * (BOX_H + GAP_Y), w: BOX_W - inset, h: BOX_H };
      });
      rowH = Math.max(rowH, (c.below.length + 1) * (BOX_H + GAP_Y));
      width = Math.max(width, x + BOX_W + PAD);
    });
    y += rowH + GAP_Y;
  }
  const lines = [];
  const gates = [];
  for (const k of inArea) {
    for (const e of geo.places[k].exits) {
      const p = geo.places[e];
      if (!p) continue;
      if (p.area === areaId) { if (k < e) lines.push([k, e]); } else gates.push({ key: k, to: p.area });
    }
  }
  return { width, height: y, boxes, lines, gates };
}

function svg(geo, areaId, layout, here, minutes, cls) {
  const mid = (b) => [b.x + b.w / 2, b.y + b.h / 2];
  // its own size: the stylesheet only ever shrinks it to fit
  const out = [`<svg class="ob-mapdraw ${cls}" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" role="group">`];
  for (const [a, b] of layout.lines) {
    const [x1, y1] = mid(layout.boxes[a]);
    const [x2, y2] = mid(layout.boxes[b]);
    out.push(`<line class="ob-map-path" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  }
  for (const [k, b] of Object.entries(layout.boxes)) {
    const p = geo.places[k];
    const classes = ['ob-map-place', k === here ? 'ob-map-here' : '', p.indoor ? 'ob-map-indoor' : ''].filter(Boolean).join(' ');
    const time = k === here ? 'you are here' : `${minutes(k)} min`;
    const go = `SugarCube.setup.ob_obscura_travel('${esc(k)}')`;
    out.push(`<g class="${classes}" role="button" tabindex="0" data-ob-go="${esc(k)}" onclick="${go}"`
      + ` onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${go}}">`
      + `<title>${esc(p.name)} - ${time}</title>`
      + `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6"/>`
      + `<text x="${b.x + 8}" y="${b.y + b.h / 2 + 4}">${k === here ? '★ ' : ''}${esc(short(p.name, b.w > 140 ? 20 : 18))}</text></g>`);
  }
  out.push('</svg>');
  return out.join('');
}

// opts: pictureBase and picture(areaId) -> a shipped map file to show until
// this world's is painted; areaName(area) -> the name to print.
export function mapsScreenHtml(geo, V = {}, opts = {}) {
  if (!geo || !geo.places || !Object.keys(geo.places).length) return '<div class="ob-maps-empty">This world has no map yet.</div>';
  const here = V && V.location;
  const nameOf = (area) => (opts.areaName ? opts.areaName(area) : area.name);
  // the player's area first, then outward by how many areas away
  const hereArea = geo.places[here] ? geo.places[here].area : null;
  const dist = new Map();
  if (hereArea) {
    dist.set(hereArea, 0);
    const queue = [hereArea];
    while (queue.length) {
      const id = queue.shift();
      for (const [k, p] of Object.entries(geo.places)) {
        if (p.area !== id) continue;
        for (const e of p.exits) {
          const to = geo.places[e] && geo.places[e].area;
          if (to && !dist.has(to)) { dist.set(to, dist.get(id) + 1); queue.push(to); }
        }
        void k;
      }
    }
  }
  const areas = [...geo.areas].sort((a, b) => (dist.has(a.id) ? dist.get(a.id) : 99) - (dist.has(b.id) ? dist.get(b.id) : 99));
  const minutes = (k) => travelMinutes(shortestPath(geo, here, k));
  const out = [];
  for (const area of areas) {
    const wide = areaLayout(geo, area.id, { columns: 4 });
    if (!Object.keys(wide.boxes).length) continue;
    const narrow = areaLayout(geo, area.id, { columns: 2 });
    out.push(`<div class="ob-map" data-ob-area="${esc(area.id)}">`);
    out.push(`<div class="ob-map-title"><b>${esc(nameOf(area))}</b></div>`);
    // the shipped map until this world's is painted; with none to stand in, the
    // picture stays hidden until the painter fills it (world/painter.mjs)
    const file = opts.picture ? opts.picture(area.id) : null;
    if (opts.pictureBase && file) out.push(`<img data-ob-map="${esc(area.id)}" src="${esc(`${opts.pictureBase}${file}.png`)}" alt="">`);
    else out.push(`<img data-ob-map="${esc(area.id)}" alt="" style="display:none">`);
    out.push(svg(geo, area.id, wide, here, minutes, 'ob-mapdraw-wide'));
    out.push(svg(geo, area.id, narrow, here, minutes, 'ob-mapdraw-narrow'));
    const ways = wide.gates.map((g) => {
      const to = geo.areas.find((a) => a.id === g.to);
      return `${esc(geo.places[g.key].name)} to ${esc(to ? nameOf(to) : g.to)}`;
    });
    if (ways.length) out.push(`<div class="ob-map-gates">Ways on: ${[...new Set(ways)].join(' · ')}</div>`);
    out.push('</div>');
  }
  return out.join('');
}
