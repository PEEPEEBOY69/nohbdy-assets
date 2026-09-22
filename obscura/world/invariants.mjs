// world/invariants.mjs — facts about the data that no schema can hold.
//
// This is the fourth time the same shape has appeared. Slice 2: keys that are
// contracts. Slice 4: members indexed by a computed key. Slice 5: asset
// references, and map coordinates. Each time, a value is structurally valid
// and semantically wrong, so conformance passes and the game breaks.
//
// This one is a SINGLETON FLAG: a boolean that is true for exactly one record
// in a group, because it marks the one that is special.
//
//   setup.School.residences   3 records, exactly one with pc: true
//   setup.ob_hairstyles     101 records, exactly one with default: true
//   clothes.*.configurations  3 options, exactly one config_default
//
// Measured across the original tables: 252 of them.
//
// The generator sees an optional boolean and assigns it per record, so the
// generated world has three player residences or none. It had none, and the
// consequence was concrete: the engine only assigns a roommate inside
// `if (rinfo.pc)`, so $pcroommate stayed undefined and the quickstart threw
// "Cannot set properties of undefined (setting 'known')" before it could reach
// the game. The player could not get in.
//
// Detected from the ORIGINAL data, which is the only thing that knows the flag
// was ever an invariant, and enforced on the generated world.

// A boolean that is true in exactly one of several records is taken to be a
// marker. Two records is too small a sample to be sure, so the floor is three:
// below that, "one of two" is as likely to be a coincidence as a rule.
export const MIN_RECORDS = 3;

function recordsOf(container) {
  if (!container || typeof container !== 'object' || Array.isArray(container)) return [];
  return Object.entries(container).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
}

// Which boolean fields of these records are singletons.
export function singletonFieldsOf(container, minRecords = MIN_RECORDS) {
  const recs = recordsOf(container);
  if (recs.length < minRecords) return [];
  const counts = new Map();
  for (const [, rec] of recs) {
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v !== 'boolean') continue;
      if (!counts.has(k)) counts.set(k, 0);
      if (v) counts.set(k, counts.get(k) + 1);
    }
  }
  return [...counts.entries()].filter(([, n]) => n === 1).map(([k]) => k);
}

// Stable choice, so the same world always marks the same record.
function hash(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Sets the flag true on exactly one record and false on the rest. Prefers a
// record that already has it, so a generated world that happened to get it
// right is left alone.
export function enforceSingleton(container, field, path) {
  const recs = recordsOf(container);
  if (!recs.length) return null;
  const already = recs.filter(([, r]) => r[field] === true);
  const chosen = already.length
    ? already[hash(path) % already.length][0]
    : recs[hash(path) % recs.length][0];
  let changed = 0;
  for (const [key, rec] of recs) {
    const want = key === chosen;
    if (rec[field] !== want) { rec[field] = want; changed += 1; }
  }
  return { field, chosen, records: recs.length, had: already.length, changed };
}

function isRecordMap(orig, gen) {
  if (!orig || typeof orig !== 'object' || Array.isArray(orig)) return false;
  const ok = Object.keys(orig);
  if (!ok.length) return false;
  if (!ok.some(k => orig[k] && typeof orig[k] === 'object' && !Array.isArray(orig[k]))) return false;
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

export function enforceSingletons(world, originals, opts = {}) {
  const minRecords = opts.minRecords ?? MIN_RECORDS;
  const maxDepth = opts.maxDepth ?? 6;
  const applied = [];

  const walk = (orig, gen, path, depth) => {
    if (depth > maxDepth || !orig || !gen) return;
    if (typeof orig !== 'object' || typeof gen !== 'object') return;
    if (Array.isArray(orig) || Array.isArray(gen)) return;

    // Does this level's ORIGINAL hold a group of records with a marker?
    for (const field of singletonFieldsOf(orig, minRecords)) {
      const res = enforceSingleton(gen, field, `${path}.${field}`);
      if (res) applied.push({ path: `${path}.*.${field}`, ...res });
    }

    if (isRecordMap(orig, gen)) {
      const witness = firstObject(orig);
      if (witness) {
        for (const gk of Object.keys(gen)) walk(witness, gen[gk], `${path}.*`, depth + 1);
      }
      return;
    }
    for (const [k, ov] of Object.entries(orig)) {
      if (!ov || typeof ov !== 'object' || Array.isArray(ov)) continue;
      if (!(k in gen)) continue;
      walk(ov, gen[k], path ? `${path}.${k}` : k, depth + 1);
    }
  };

  for (const table of Object.keys(originals || {})) {
    if (!(table in (world || {}))) continue;
    walk(originals[table], world[table], table, 0);
  }
  return { applied };
}
