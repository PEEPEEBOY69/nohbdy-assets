// world/mapgrid.mjs — clickable map regions that correspond to the map picture.
//
// A map node carries two coordinate fields:
//
//   imgcoords     "334,34,355,47,354,56,..."  an <area> polygon, in map space
//   markercoords  [337, 55]                   where the location pin is drawn
//
// Both are DATA, so a generated world generates them - and generated polygons
// are arbitrary numbers. They overlap, they leave gaps, they fall outside the
// picture, and the pin for one place lands inside another's region. Pinning the
// map IMAGE (see assets.mjs) made the map appear; it did nothing for this,
// because the regions and the picture are independent.
//
// The fix is to stop treating them as content and lay them out. Nodes are
// placed on a grid that fills the map's coordinate space, which guarantees the
// three properties the engine needs and generation cannot provide:
//
//   - every node gets a region, and no two regions overlap
//   - every region lies inside the picture
//   - a node's marker sits inside that node's own region
//
// The space is 600x300, set by the chassis in StoryInit as $mapsize. Measured
// against the original data, whose own coords run x 58..507, y 10..255 - so the
// original art also leaves a margin, and this keeps one.
export const MAP_W = 600;
export const MAP_H = 300;
export const MARGIN = 14;
export const GUTTER = 6;

// Columns are chosen for the 2:1 space, so cells come out roughly square
// rather than as thin vertical slivers.
export function gridFor(count, w = MAP_W, h = MAP_H) {
  const n = Math.max(1, count | 0);
  const aspect = w / h;
  let cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
  let rows = Math.ceil(n / cols);
  // Prefer the layout that wastes the fewest cells without going very tall.
  while (cols > 1 && (cols - 1) * rows >= n) cols -= 1;
  rows = Math.ceil(n / cols);
  return { cols, rows };
}

export function cellRect(index, cols, rows, w = MAP_W, h = MAP_H) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const usableW = w - MARGIN * 2;
  const usableH = h - MARGIN * 2;
  const cw = usableW / cols;
  const ch = usableH / rows;
  const x1 = Math.round(MARGIN + col * cw + GUTTER / 2);
  const y1 = Math.round(MARGIN + row * ch + GUTTER / 2);
  const x2 = Math.round(MARGIN + (col + 1) * cw - GUTTER / 2);
  const y2 = Math.round(MARGIN + (row + 1) * ch - GUTTER / 2);
  return { x1, y1, x2, y2 };
}

export function rectToPolygon({ x1, y1, x2, y2 }) {
  return `${x1},${y1},${x2},${y1},${x2},${y2},${x1},${y2}`;
}

export function rectCentre({ x1, y1, x2, y2 }) {
  return [Math.round((x1 + x2) / 2), Math.round((y1 + y2) / 2)];
}

// Rewrites the coordinate fields of every map in the generated world whose
// ORIGINAL counterpart had them. Driven from the original for the same reason
// asset pinning is: only it knows the field was ever a layout, not prose.
export function pinMapRegions(world, originals, opts = {}) {
  const w = opts.width ?? MAP_W;
  const h = opts.height ?? MAP_H;
  const laidOut = [];
  const maps = world && world.ob_maps;
  const origMaps = originals && originals.ob_maps;
  if (!maps || typeof maps !== 'object' || !origMaps) return { laidOut };

  // Does the original's map data use these fields at all?
  const origUsesCoords = Object.values(origMaps).some(
    m => m && m.nodes && Object.values(m.nodes).some(n => n && (n.imgcoords || n.markercoords)),
  );
  if (!origUsesCoords) return { laidOut };

  for (const [mapName, map] of Object.entries(maps)) {
    if (!map || typeof map !== 'object') continue;
    const nodes = map.nodes;
    if (!nodes || typeof nodes !== 'object') continue;
    const names = Object.keys(nodes).filter(k => nodes[k] && typeof nodes[k] === 'object');
    if (!names.length) continue;

    // Only maps that actually show a picture need regions. The chassis has 32
    // maps and only two carry an image; the rest render as lists, and giving
    // them polygons would be inventing a UI they do not have.
    const hasAnyCoords = names.some(k => nodes[k].imgcoords || nodes[k].markercoords);
    if (!hasAnyCoords) continue;

    const { cols, rows } = gridFor(names.length, w, h);
    names.forEach((key, i) => {
      const rect = cellRect(i, cols, rows, w, h);
      const node = nodes[key];
      if ('imgcoords' in node) node.imgcoords = rectToPolygon(rect);
      if ('markercoords' in node) node.markercoords = rectCentre(rect);
    });
    laidOut.push(`${mapName}: ${names.length} nodes on ${cols}x${rows}`);
  }
  return { laidOut };
}
