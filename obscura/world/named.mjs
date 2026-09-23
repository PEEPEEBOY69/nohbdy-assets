// world/named.mjs — a record the engine names keeps its structure.
//
// Some records are named in the engine's own code: setup.ob_dormstuff
// ["entry-level DSLR camera"] is read by name to find every camera's art tool.
// The key sets already make sure such a key survives generation. Its FIELDS did
// not: only 7 of the table's 141 records carry `artTool`, so the generator
// treats the field as optional, and the camera came back without it. Opening
// the Inventory then threw "Cannot read properties of undefined (reading
// 'includes')" twice, on screen.
//
// A record the engine names is machinery. Its structure - numbers, flags,
// closed-vocabulary words like artTool: "camera", nested objects - is what the
// code reads, so it stays the original's. Only its prose is the world's. And
// prose is marked precisely: the chassis replaced every piece of the original's
// prose with an "unwritten #N" placeholder, so a field that holds a placeholder
// in the original is prose, and anything else is structure.
export const PLACEHOLDER = /unwritten #\d+/;

export const isProse = (v) => typeof v === 'string' && PLACEHOLDER.test(v);

const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v);

// The original's shape, with the generated value wherever the original held
// prose. Fields the generator invented are dropped; fields it dropped return.
export function mergeStructure(orig, gen) {
  if (!isPlain(orig)) return orig;
  const out = {};
  for (const [k, v] of Object.entries(orig)) {
    const g = isPlain(gen) ? gen[k] : undefined;
    if (isProse(v)) out[k] = typeof g === 'string' && g.trim() ? g : v;
    else if (isPlain(v)) out[k] = mergeStructure(v, g);
    else out[k] = v;
  }
  return out;
}

// `keepKeys(path)` names the keys the engine reads at a table path ("table" for
// a record table, "table.member" for a member of a machinery namespace).
// `isMachinery(original)` tells the two apart the way the builder does.
export function preserveNamedRecords(world, originals, keepKeys, isMachinery) {
  const applied = [];
  const fix = (path, gen, orig) => {
    if (!isPlain(gen) || !isPlain(orig)) return;
    for (const key of keepKeys(path) || []) {
      if (!Object.prototype.hasOwnProperty.call(gen, key) || !isPlain(orig[key])) continue;
      gen[key] = mergeStructure(orig[key], gen[key]);
      applied.push(`${path}.${key}`);
    }
  };
  for (const [name, gen] of Object.entries(world || {})) {
    const orig = originals && originals[name];
    if (!orig || typeof orig !== 'object') continue;
    if (isMachinery(orig)) {
      for (const member of Object.keys(gen || {})) fix(`${name}.${member}`, gen[member], orig[member]);
    } else {
      fix(name, gen, orig);
    }
  }
  return { applied };
}
