// world/references.mjs — fields whose value is the NAME OF SOMETHING ELSE.
//
// The fifth instance of one shape. A value is structurally valid - a string
// where a string belongs - and semantically wrong, so conformance passes and
// the engine breaks on it.
//
//   ob_outfits.*.items[].item        names a garment in `clothes`
//   ob_creating.*.painting.tool      names an object in `ob_dormstuff`
//   species.*.genders.*.pronouns     names a set in `ob_names`
//
// Measured across the chassis: 69 such field paths.
//
// The generator writes prose into them, because prose is what a string field
// looks like. So "Starting Outfit" came out holding
// `[ob_outfits.items.item - a rain-dark city - 7lw]`, and build_outfit looked
// that up in `clothes`, got undefined, and read `.category` off it. Character
// creation could not finish.
//
// Detected from the ORIGINAL data, which is the only thing that knows the
// field was ever a pointer, and resolved against the GENERATED world, because
// that is where the names it must point at now live.

// A coincidence guard. One value that happens to match a key elsewhere proves
// nothing; a field is a reference when most of its observed values are keys of
// the same table.
export const MIN_TARGET_KEYS = 3;
export const MIN_AGREEMENT = 0.6;
export const MAX_SAMPLES = 40;
// One observation at "100% agreement" is the coincidence this guard exists to
// reject. A field is only a reference when several of its values agree.
export const MIN_SAMPLES = 3;

// Record keys are CONTENT - "Traditional Uniforms", "Goose of Thrones" - so
// leaving them in the path gives every record its own path with one sample
// each, and nothing ever aggregates. They collapse to `*`, the same way the
// asset walker treats a record map.
export function collapseKey(key) {
  if (/^\d+$/.test(key)) return '*';
  if (/[ '".]/.test(key)) return '*';
  if (/^[A-Z]/.test(key) && key.length > 3) return '*';
  return key;
}

const isPlaceholder = v => typeof v === 'string' && v.startsWith('[') && v.endsWith(']');

function tableKeySets(tables) {
  const out = new Map();
  for (const [name, t] of Object.entries(tables || {})) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) continue;
    const keys = Object.keys(t);
    if (keys.length >= MIN_TARGET_KEYS) out.set(name, new Set(keys));
  }
  return out;
}

// Walks the originals and records, per field path, which table's keys its
// values look like.
export function findReferenceFields(tables, opts = {}) {
  const minAgreement = opts.minAgreement ?? MIN_AGREEMENT;
  const keySets = tableKeySets(tables);
  const seen = new Map(); // path -> Map(target -> count), plus total

  const note = (path, value, ownTable) => {
    if (typeof value !== 'string' || !value || isPlaceholder(value)) return;
    if (!seen.has(path)) seen.set(path, { total: 0, targets: new Map() });
    const rec = seen.get(path);
    rec.total += 1;
    for (const [tname, keys] of keySets) {
      if (tname === ownTable) continue;
      if (keys.has(value)) rec.targets.set(tname, (rec.targets.get(tname) || 0) + 1);
    }
  };

  const walk = (node, path, ownTable, depth) => {
    if (!node || typeof node !== 'object' || depth > 6) return;
    if (Array.isArray(node)) {
      for (const v of node.slice(0, 4)) {
        if (typeof v === 'string') note(`${path}[]`, v, ownTable);
        else walk(v, `${path}[]`, ownTable, depth + 1);
      }
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      const p = `${path}.${collapseKey(k)}`;
      if (typeof v === 'string') note(p, v, ownTable);
      else if (v && typeof v === 'object') walk(v, p, ownTable, depth + 1);
    }
  };

  for (const [name, t] of Object.entries(tables || {})) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) continue;
    const records = Object.entries(t).filter(([, v]) => v && typeof v === 'object').slice(0, MAX_SAMPLES);
    for (const [, rec] of records) walk(rec, `${name}.*`, name, 1);
  }

  const minSamples = opts.minSamples ?? MIN_SAMPLES;
  const out = new Map();
  for (const [path, rec] of seen) {
    if (rec.total < minSamples) continue;
    let best = null;
    for (const [target, n] of rec.targets) {
      if (!best || n > best.n) best = { target, n };
    }
    if (!best) continue;
    if (best.n / rec.total < minAgreement) continue;
    out.set(path, { target: best.target, agreement: best.n / rec.total, samples: rec.total });
  }
  return out;
}

function hash(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Rewrites every reference field in the generated world that does not name
// something the generated world actually has.
export function resolveReferences(world, tables, opts = {}) {
  const fields = opts.fields || findReferenceFields(tables, opts);
  const genKeys = new Map();
  for (const [name, t] of Object.entries(world || {})) {
    if (t && typeof t === 'object' && !Array.isArray(t)) {
      const keys = Object.keys(t).filter(k => t[k] && typeof t[k] === 'object');
      if (keys.length) genKeys.set(name, keys);
    }
  }

  const resolved = [];
  const unresolved = [];

  const fix = (holder, key, path, fieldPath) => {
    const spec = fields.get(fieldPath);
    if (!spec) return;
    const pool = genKeys.get(spec.target);
    if (!pool || !pool.length) { unresolved.push(fieldPath); return; }
    const current = holder[key];
    // Already naming something real: leave it. A generated world that got it
    // right must not be churned.
    if (typeof current === 'string' && pool.includes(current)) return;
    holder[key] = pool[hash(path) % pool.length];
    resolved.push(fieldPath);
  };

  const walk = (node, path, fieldPath, depth) => {
    if (!node || typeof node !== 'object' || depth > 7) return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const v = node[i];
        if (typeof v === 'string') fix(node, i, `${path}[${i}]`, `${fieldPath}[]`);
        else walk(v, `${path}[${i}]`, `${fieldPath}[]`, depth + 1);
      }
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      const p = `${path}.${k}`;
      const fp = `${fieldPath}.${collapseKey(k)}`;
      if (typeof v === 'string') fix(node, k, p, fp);
      else if (v && typeof v === 'object') walk(v, p, fp, depth + 1);
    }
  };

  for (const [name, t] of Object.entries(world || {})) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) continue;
    for (const [key, rec] of Object.entries(t)) {
      if (rec && typeof rec === 'object') walk(rec, `${name}.${key}`, `${name}.*`, 1);
    }
  }
  return { resolved, unresolved, fields: fields.size };
}
