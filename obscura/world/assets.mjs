// world/assets.mjs — asset references are a third category.
//
// Slice 2 established that a generated world has to respect STRUCTURE the
// schema cannot express. Slice 4 found members indexed by a computed key.
// This is the same shape again, and the sharpest case yet:
//
//   setup.ob_maps.Campus.img      = "map_univ"
//   setup.School.team.logo        = "teamlogo_fightingelks.png"
//   setup.ob_tcg.planets.X.icon   = "res/img/tcg_Venus_Icon.png"
//
// Those are not content and not structure. They are POINTERS INTO A CLOSED SET
// OF SHIPPED FILES. A model asked to write a world invents plausible text for
// them - "map_nightmarket", "teamlogo_ravens.png" - and every one names a file
// that does not exist, so the map is blank and every team crest is a broken
// image. No amount of conformance checking catches it, because the value IS a
// valid string.
//
// So these fields are pinned: after generation, each one is replaced with a
// real shipped file, chosen deterministically so the same world always looks
// the same.
//
// The form is derived from the ORIGINAL value rather than hardcoded, because
// the chassis is inconsistent about it and each site is load-bearing:
//   - `img` has NO extension; the engine appends ".png" itself
//   - `logo` HAS the extension; the engine does not append one
//   - `icon` carries a whole path, which the build has already rewritten
// Emitting the wrong shape gives "...map_obscura.png.png" or a bare name where
// a path was needed, so shape is copied and only identity is swapped.

// Anything that looks like it names an image file, plus the extension-less
// fields that only the surrounding code reveals. `map_univ` matches no
// extension pattern at all, which is exactly why a regex-only sweep missed it.
const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp)$/i;
export const BARE_ASSET_FIELDS = new Set(['img', 'bigimg']);

export function looksLikeAsset(field, value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (IMAGE_EXT.test(value.trim())) return true;
  // An extension-less pointer is only recognisable by the field it sits in.
  return BARE_ASSET_FIELDS.has(field) && /^[\w.-]+$/.test(value.trim());
}

// Splits an original value into the parts that must be preserved and the part
// that identifies the file. "res/img/tcg_Venus_Icon.png" -> dir "res/img/",
// stem "tcg_Venus_Icon", ext ".png".
export function shapeOf(original) {
  const v = String(original);
  const slash = v.lastIndexOf('/');
  const dir = slash === -1 ? '' : v.slice(0, slash + 1);
  const rest = v.slice(slash + 1);
  const m = rest.match(IMAGE_EXT);
  const ext = m ? m[0] : '';
  const stem = ext ? rest.slice(0, -ext.length) : rest;
  return { dir, stem, ext };
}

// Which family a name belongs to, so a map field gets a map and a team field
// gets a crest. Longest prefix first: "map_obscura_big" must not be read as
// the "map_" family's plain member when a big one was asked for.
export const FAMILIES = [
  { key: 'map_big', test: n => /^map_.*_big$/.test(n) },
  { key: 'map', test: n => /^map_/.test(n) },
  { key: 'teamlogo', test: n => /^teamlogo_/.test(n) },
  { key: 'tcg', test: n => /^tcg_/.test(n) },
  { key: 'locmarker', test: n => /^locmarker/.test(n) },
  { key: 'other', test: () => true },
];

export function familyOf(stem) {
  return FAMILIES.find(f => f.test(stem)).key;
}

// Groups the shipped filenames by family, so pinning can pick within one.
export function groupManifest(files = []) {
  const groups = {};
  for (const f of files) {
    const { stem } = shapeOf(f);
    const key = familyOf(stem);
    (groups[key] = groups[key] || []).push(f);
  }
  for (const k of Object.keys(groups)) groups[k].sort();
  return groups;
}

// A stable hash, so the same world always pins the same picture. Not for
// randomness quality - only for spreading choices evenly and repeatably.
export function hashPath(path) {
  let h = 2166136261;
  const s = String(path);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// Walks the ORIGINAL tables to find every asset field, then writes a shipped
// file into the same path of the GENERATED world. Driving from the original is
// the whole trick: it is the only thing that knows a field was ever a pointer,
// since the generated value is indistinguishable from prose.
export function pinAssets(world, originals, manifest, opts = {}) {
  const groups = groupManifest(manifest);
  const maxDepth = opts.maxDepth ?? 8;
  const pinned = [];
  const unmatched = [];

  const pick = (family, path, fallbackFamily) => {
    const pool = (groups[family] && groups[family].length) ? groups[family]
      : (groups[fallbackFamily] && groups[fallbackFamily].length) ? groups[fallbackFamily]
        : null;
    if (!pool) return null;
    return pool[hashPath(path) % pool.length];
  };

  const walk = (orig, gen, path, depth) => {
    if (depth > maxDepth || !orig || !gen) return;
    if (typeof orig !== 'object' || typeof gen !== 'object') return;
    if (Array.isArray(orig) !== Array.isArray(gen)) return;

    if (Array.isArray(orig)) {
      // Lists are re-generated wholesale, so index alignment is not
      // meaningful. Use the first original element as the shape witness for
      // every generated element.
      const witness = orig.find(v => v && typeof v === 'object');
      for (let i = 0; i < gen.length; i++) {
        if (witness) walk(witness, gen[i], `${path}[]`, depth + 1);
      }
      // A list OF asset strings.
      const strWitness = orig.find(v => typeof v === 'string');
      if (strWitness && looksLikeAsset(lastField(path), strWitness)) {
        for (let i = 0; i < gen.length; i++) {
          if (typeof gen[i] !== 'string') continue;
          const shape = shapeOf(strWitness);
          const file = pick(familyOf(shape.stem), `${path}[${i}]`, 'other');
          if (!file) { unmatched.push(`${path}[${i}]`); continue; }
          gen[i] = render(shape, file);
          pinned.push(`${path}[${i}]`);
        }
      }
      return;
    }

    // A RECORD MAP is a table whose keys are content - 144 courses, 16
    // relationships, 8 maps - so the generated world's keys are entirely
    // different names and walking the original key-by-key finds nothing. The
    // check has to happen HERE, before the field loop, because the top-level
    // table is itself a record map and the loop would skip every key of it.
    //
    // Key COUNT cannot detect this: a table with one key is still a record
    // map. Key OVERLAP can - a fixed-shape object keeps its field names, a
    // record map keeps none of them.
    if (isRecordMap(orig, gen)) {
      const witness = firstObject(orig);
      if (witness) {
        for (const gk of Object.keys(gen)) walk(witness, gen[gk], `${path}.*`, depth + 1);
        return;
      }
    }

    for (const [field, ov] of Object.entries(orig)) {
      if (!(field in gen)) continue;
      const p = path ? `${path}.${field}` : field;
      if (looksLikeAsset(field, ov)) {
        if (typeof gen[field] !== 'string') continue;
        const shape = shapeOf(ov);
        const file = pick(familyOf(shape.stem), p, 'other');
        if (!file) { unmatched.push(p); continue; }
        gen[field] = render(shape, file);
        pinned.push(p);
        continue;
      }
      if (ov && typeof ov === 'object') walk(ov, gen[field], p, depth + 1);
    }
  };

  // Puts the chosen file back in the original's shape: same directory, same
  // presence or absence of an extension.
  function render(shape, file) {
    const f = shapeOf(file);
    return shape.ext ? `${shape.dir}${f.stem}${shape.ext}` : `${shape.dir}${f.stem}`;
  }

  for (const table of Object.keys(originals || {})) {
    if (!(table in world)) continue;
    walk(originals[table], world[table], table, 0);
  }
  return { pinned, unmatched };
}

function lastField(path) {
  const m = String(path).match(/([\w]+)(?:\[\])?$/);
  return m ? m[1] : '';
}

// Detected by comparing the original's keys with the GENERATED counterpart's.
// No overlap at all, and both sides hold objects, means the keys are content.
export function isRecordMap(orig, gen) {
  if (!orig || typeof orig !== 'object' || Array.isArray(orig)) return false;
  const ok = Object.keys(orig);
  if (!ok.length) return false;
  const holdsObjects = ok.some(k => orig[k] && typeof orig[k] === 'object' && !Array.isArray(orig[k]));
  if (!holdsObjects) return false;
  if (!gen || typeof gen !== 'object' || Array.isArray(gen)) return false;
  const gk = Object.keys(gen);
  if (!gk.length) return false;
  return !ok.some(k => gk.includes(k));
}

function firstObject(obj) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  }
  return null;
}
