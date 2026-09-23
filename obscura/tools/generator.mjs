// tools/generator.mjs — the generator contract: premise + schema -> conforming data.
//
// Slice 1 proved the engine runs on data built from extracted schemas. This is
// the interface that produces that data. A deterministic implementation ships
// first because Turnstile blocks scripted live QA: if the only way to exercise
// generation is a live model call, generation cannot gate a commit, and a
// failure cannot be attributed between prompt, schema, validation and luck.
import { inferSchema, classify, TYPES, isFunctionValue } from './schema.mjs';
import { stubFor, conforms, STUB_MAP_CAP } from './make-stubs.mjs';
import { findReferences } from './schema-refs.mjs';

// A small, fast, seeded PRNG (mulberry32 over an FNV-1a string hash). Seeded
// because a generator whose output moves between runs cannot be tested, and a
// test that tolerates drift is not testing generation.
export function seededRng(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(seed).length; i++) {
    h ^= String(seed).charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let a = h >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Keys of `target` that some other table points at. Dropping one of these
// breaks the reference silently: the engine finds no match and does less.
export function referencedKeysOf(tables, refs) {
  const out = {};
  for (const ref of refs) {
    const source = tables[ref.table];
    if (!source || typeof source !== 'object') continue;
    const records = Array.isArray(source) ? source : Object.values(source);
    for (const rec of records) {
      if (!rec || typeof rec !== 'object' || Array.isArray(rec)) continue;
      const v = rec[ref.field];
      for (const item of (Array.isArray(v) ? v : [v])) {
        if (typeof item !== 'string') continue;
        (out[ref.target] = out[ref.target] || new Set()).add(item);
      }
    }
  }
  return out;
}

// A key whose value is a list naming OTHER keys of the same table is a
// self-index: structure, not content. The engine reads
// ob_names.unusual_name_keys directly - `unusualnametypes.includes(k)` - so
// capping it away makes that read throw on undefined, which is exactly the
// error the slice-1 round-trip could not clear.
//
// This is derived from the data, not from parsing engine source. The
// source-parsing route (findCodeKeys) names 418 keys across 55 tables, and
// admitting them all displaces the sampled keys enough to send worldgen into a
// spin. Self-indexes are a far narrower claim: exactly two exist in this
// payload, and both really are indexes over their own siblings.
export const SELF_INDEX_MIN_RATE = 0.8;

// How many distinct entries a placeholder-filled list should carry. stubFor
// caps arrays at 4, which is fine for shape and fatal for identity: the engine
// draws a name as first + " " + last from two such lists and then rejects any
// candidate sharing a word position with the PC's, so 4x4 leaves 9 usable
// names against a student body, a faculty and a town. Always bounded by the
// schema's own observed maxItems, so this widens a list, never invents a shape
// the original never had.
export const ARRAY_MIN_DISTINCT = 32;

// A weighted list whose ENTRIES are records - [{label,genders}, 70, {...}, 30].
// Two independent reasons the generator must not own these:
//
//   1. The schema cannot model the shape. Type inference sees an array holding
//      both objects and numbers and settles on "array of string", so the stub
//      emits placeholder strings and `_attract[_i].label` is undefined.
//   2. The values are protocol, not prose. Start3 hardcodes the labels in its
//      own markup - <<radiobutton "_sexpref" "straight">> - and matches them
//      against this data. Invent a label and nothing ever matches, so
//      $pcsexualprefs is never set and every later `prefs.includes(...)` throws.
//
// Six sites exist, all species.human.genders.*.attraction. They are carried
// through verbatim. A real generator needs to model this shape and keep the
// label vocabulary; until then, inventing one is strictly worse than keeping it.
export function isWeightedRecordList(value) {
  if (!Array.isArray(value) || value.length < 2 || value.length % 2 !== 0) return false;
  for (let i = 0; i < value.length; i += 2) {
    const entry = value[i], weight = value[i + 1];
    if (typeof weight !== 'number') return false;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    if (isFunctionValue(entry)) return false;
  }
  return true;
}

// Every value a table can be pointed at by: the keys of a keyed table and the
// members of a list table. A field whose ORIGINAL value is one of these is a
// pointer into a closed set, and a written word there points at nothing:
// ob_styles.*["femme hair dye"] draws an NPC's "hair color", which the engine
// then looks up in ob_dye_hair_colors, and a miss reads "undefined-haired".
const closedSets = new WeakMap();
export function closedSetMembers(tables) {
  if (!tables || typeof tables !== 'object') return new Set();
  if (closedSets.has(tables)) return closedSets.get(tables);
  const out = new Set();
  for (const t of Object.values(tables)) {
    if (Array.isArray(t)) {
      for (const v of t) if (typeof v === 'string') out.add(v);
    } else if (t && typeof t === 'object') {
      for (const k of Object.keys(t)) out.add(k);
    }
  }
  closedSets.set(tables, out);
  return out;
}

const isPlaceholderString = (v) => typeof v === 'string' && v.startsWith('[') && v.endsWith(']');

// The one kind of string the world has to write: the original's prose, which
// the chassis stripped to "[description — unwritten #12]" because it cannot
// ship. Everything else in the original - names, labels, short lines - ships
// with the chassis already and is the engine's own data. Regenerating it was
// the build's biggest cost: 544 names alone, written by a model, to replace
// the names the engine's generator already draws from.
const STRIPPED = /unwritten #\d+/;
export const isRealString = (v) => typeof v === 'string' && v.trim() !== ''
  && !isPlaceholderString(v) && !STRIPPED.test(v);
const isRealStringList = (v) => Array.isArray(v) && v.length > 0 && v.every(isRealString);

// A list the engine reads as structure, whatever type inference made of it.
// Inference sees strings and numbers in one array and settles on "array of
// string", so the stub wrote placeholders over skill caps ([30, 21, 18, ...])
// and over the weights of every weighted list. A list that holds a number is
// structure; so is one whose strings are, three in four or more, members of a
// closed set (the rest are sentinels like "natural").
export function isStructuralList(value, members) {
  if (!Array.isArray(value) || !value.length) return false;
  if (value.some(v => typeof v === 'number' || typeof v === 'boolean')) return true;
  const strings = [...new Set(value.filter(v => typeof v === 'string'))];
  if (!strings.length || !members || !members.size) return false;
  return strings.filter(s => members.has(s)).length / strings.length >= 0.75;
}

export function selfIndexKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const keys = new Set(Object.keys(value));
  const out = [];
  for (const [k, v] of Object.entries(value)) {
    if (!Array.isArray(v) || v.length === 0) continue;
    if (!v.every((x) => typeof x === 'string')) continue;
    const inside = v.filter((x) => x !== k && keys.has(x));
    if (inside.length / v.length >= SELF_INDEX_MIN_RATE) out.push(k);
  }
  return out;
}

// A spec is everything a generator needs for ONE table, derived - never
// hand-authored. Hand-authoring 110 of these is how a contract rots.
export function specFor(table, tables, opts = {}) {
  // `opts.value` specs a value that is not a top-level table: a data member
  // living inside a machinery namespace, named "namespace.member". Those are
  // 84 of the replaceable things in this payload, so the contract has to reach
  // them or it only covers two thirds of the game.
  const value = opts.value !== undefined ? opts.value : tables[table];
  const refs = opts.refs || findReferences(tables);
  const referenced = opts.referencedKeys || referencedKeysOf(tables, refs);
  const schema = inferSchema(value);

  // Count floor: worldgen's selection loops scale with table size, and too few
  // entries makes them spin. Too many does too (slice 1, finding 6), so the
  // target sits at the stub cap unless the real table is smaller.
  const realCount = schema.kind === 'map' ? (schema.keyCount || 0)
    : schema.kind === 'list' ? (schema.count || 0) : 0;
  const count = Math.max(1, Math.min(realCount || STUB_MAP_CAP, STUB_MAP_CAP));

  return {
    table,
    schema,
    classification: classify(value),
    methods: schema.methods || [],
    // Two independent sources of "this key must survive": keys another table
    // points at, and keys the engine names in its own source. Neither can see
    // the other, so a key kept by only one is still mandatory.
    mandatoryKeys: [...new Set([
      ...(referenced[table] || []),
      ...(opts.keepKeys || []),
      ...(opts.verbatimKeys || []),
    ])],
    count,
    premise: opts.premise || '',
    seed: opts.seed || `${table}:${opts.premise || ''}`,
    // Carried as contents, not just names: the generator re-emits the index
    // itself rather than stubbing it, because a stubbed list of key names is
    // not an index of anything.
    selfIndex: Object.fromEntries(selfIndexKeys(value).map((k) => [k, value[k]])),
    // The original, so the generator can carry through the shapes it cannot
    // model rather than emitting something plausible-looking in their place.
    source: value,
    // Members the engine reaches INTO by name, carried whole. Their key
    // structure is contract: ob_archetypes.inclination_sets survived the cap as
    // a key but was rebuilt with the table's shared archetype shape, losing
    // every key it actually had, and pick_cheerleader read `incs.length` on
    // undefined. Narrow on purpose - 7 keys - because carrying every
    // dereferenced member whole would restore the original name lists too.
    verbatim: Object.fromEntries((opts.verbatimKeys || [])
      .filter((k) => value && typeof value === 'object'
        && Object.prototype.hasOwnProperty.call(value, k))
      .map((k) => [k, value[k]])),
    // Generation context, not contract payload: stubFor resolves reference
    // targets through these. generate() already read them off the spec; until
    // now specFor never set them, so every reference-aware fill was running
    // blind on undefined.
    refs,
    tables,
  };
}

export class StubGenerator {
  // Deterministic. Same spec, same output, forever. The premise is woven into
  // a record's free-text values - never into a list, which the engine draws
  // identities from - so the plumbing that an AI generator will use is proven
  // before the model exists.
  generate(spec) {
    const problems = [];
    if (!spec || !spec.schema) return { data: {}, problems: ['spec has no schema'] };

    const rng = seededRng(spec.seed);
    const data = stubFor(spec.schema, spec.table, {
      keepKeys: spec.mandatoryKeys,
      refs: spec.refs,
      tables: spec.tables,
    });

    // stubFor is deliberately minimal and always picks the first enum member
    // and the midpoint of a numeric range. A generator must actually vary
    // within the schema's constraints, or the seed is decorative.
    // Variation and premise-weaving happen in ONE walk, because both need the
    // field's schema. Weaving separately appended a premise to enum-constrained
    // description fields and broke conformance on 4 of 110 tables.
    let tagged = this.#vary(data, spec.schema, rng, spec);

    // Make repeated placeholders distinct. stubFor fills every slot of an array
    // with the SAME placeholder, so a name list came out as four copies of
    // "[ob_names]" - #vary walks lists now, but widening one still leaves its
    // entries identical. The engine treats these strings as identities:
    //
    //   while (setup.ob_name_in_use(name)) name = setup.ob_random_name(...)
    //
    // and ob_name_in_use rejects any candidate sharing a word position with the
    // PC's name. With every name identical, no candidate is ever unique and the
    // loop never exits. That is a live spin, not a cosmetic flaw - confirmed by
    // interrupting the thread and landing inside ob_unique_random_name.
    this.#distinguish(tagged);

    // Carry through the shapes the schema cannot describe - at the top too: a
    // machinery member is generated as a table of its own, and
    // ob_nPCSimulation.default_time_weight (["morning", 50, ...]) came out as
    // placeholders with its weights gone.
    const members = closedSetMembers(spec.tables);
    if (isWeightedRecordList(spec.source) || isStructuralList(spec.source, members) || isRealStringList(spec.source)) {
      tagged = structuredClone(spec.source);
    }
    this.#restoreStructures(tagged, spec.source, members);

    for (const [k, original] of Object.entries(spec.verbatim || {})) {
      if (!tagged || typeof tagged !== 'object' || Array.isArray(tagged)) break;
      tagged[k] = structuredClone(original);
    }

    // Re-attach self-indexes AFTER sampling, filtered to the keys that actually
    // survived the cap. Adding them to mandatoryKeys instead would spend a
    // sample slot and shift which content keys are kept; doing it here leaves
    // the sampled keys untouched and costs one extra structural key.
    for (const [k, entries] of Object.entries(spec.selfIndex || {})) {
      if (!Array.isArray(entries)) continue;
      if (!tagged || typeof tagged !== 'object' || Array.isArray(tagged)) continue;
      tagged[k] = entries.filter(
        (x) => Object.prototype.hasOwnProperty.call(tagged, x));
    }

    for (const m of spec.methods) {
      if (typeof tagged === 'object' && !Array.isArray(tagged)) {
        tagged[m] = function stub() { return undefined; };
      }
    }

    problems.push(...conforms(tagged, spec.schema));
    problems.push(...this.#unsatisfiable(spec.schema, `${spec.table}`));
    return { data: tagged, problems };
  }

  // Re-picks constrained values using the seeded rng. Enum members come FROM
  // the enum and numbers stay inside the observed range, so variety never costs
  // conformance.
  #vary(value, schema, rng, spec) {
    const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
    const token = spec && spec.premise ? Math.floor(rng() * 1e6).toString(36) : '';
    // Only a genuinely free-text placeholder carries the premise. An enum is a
    // closed set the engine switches on; appending to one is a conformance
    // failure, not flavour.
    const weave = (v, field) => {
      if (!spec || !spec.premise) return v;
      if (field && field.enum && field.enum.length) return v;
      if (typeof v !== 'string' || !v.startsWith('[') || !v.endsWith(']')) return v;
      return `${v.slice(0, -1)} · ${spec.premise} · ${token}]`;
    };
    // `allowWeave` is false inside a list. A list of strings is a pool the
    // engine draws identities from, and the premise text carries spaces:
    // ob_random_name joins first + " " + last and ob_name_in_use then compares
    // split(' ')[0] and [1], so a woven name makes every candidate share word
    // positions and the uniqueness loop never exits. Prose belongs in a
    // record's free-text field, not in an identity pool.
    const varyField = (v, field, allowWeave = true) => {
      const maybeWeave = (x, f) => (allowWeave ? weave(x, f) : x);
      if (!field) return maybeWeave(v, field);
      if (field.type === TYPES.string && field.enum && field.enum.length) return pick(field.enum);
      if (field.type === TYPES.string) return maybeWeave(v, field);
      if (field.type === TYPES.number) {
        const lo = Number.isFinite(field.min) ? field.min : 0;
        const hi = Number.isFinite(field.max) ? field.max : lo;
        const raw = lo + rng() * (hi - lo);
        return field.integer ? Math.round(raw) : raw;
      }
      if (field.type === TYPES.boolean) return rng() < 0.5;
      if (field.type === TYPES.array && Array.isArray(v)) {
        const grown = grow(v, field);
        return field.item ? grown.map(item => varyField(item, field.item, false)) : grown;
      }
      if (field.type === TYPES.record && v && typeof v === 'object') {
        return varyRecord(v, field.fields);
      }
      return maybeWeave(v, field);
    };
    // Widens a list that stubFor filled with repeated placeholders. Content and
    // enum values are left alone - only a list that is entirely placeholders is
    // the generator's own filler, so only that is safe to resize.
    const grow = (arr, field) => {
      if (!arr.length) return arr;
      const placeholder = (x) => typeof x === 'string' && x.startsWith('[') && x.endsWith(']');
      if (!arr.every(placeholder)) return arr;
      const ceiling = Number.isFinite(field && field.maxItems) ? field.maxItems : ARRAY_MIN_DISTINCT;
      const target = Math.min(Math.max(arr.length, ARRAY_MIN_DISTINCT), ceiling);
      const out = arr.slice();
      while (out.length < target) out.push(arr[out.length % arr.length]);
      return out;
    };
    const varyRecord = (rec, fields) => {
      if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return rec;
      const out = {};
      for (const [k, v] of Object.entries(rec)) out[k] = varyField(v, (fields || {})[k]);
      return out;
    };

    if (schema.kind === 'map' && schema.value && schema.value.kind === 'record') {
      const out = {};
      for (const [k, rec] of Object.entries(value || {})) {
        out[k] = typeof rec === 'function' ? rec : varyRecord(rec, schema.value.fields);
      }
      return out;
    }
    if (schema.kind === 'list' && schema.item && schema.item.kind === 'record') {
      return (value || []).map(rec => varyRecord(rec, schema.item.fields));
    }
    // A map whose values are lists - ob_names is one, and #vary never walked it,
    // so every name list came through exactly as stubFor left it.
    if (schema.kind === 'map' && schema.value && schema.value.type === TYPES.array) {
      const out = {};
      for (const [k, v] of Object.entries(value || {})) {
        out[k] = typeof v === 'function' ? v : varyField(v, schema.value);
      }
      return out;
    }
    if (schema.kind === 'list' && schema.item && schema.item.type === TYPES.array) {
      return (value || []).map((v) => varyField(v, schema.item));
    }
    return value;
  }

  // Walks generated and original together, putting back whatever the engine
  // reads as structure: a weighted list of records, a list that holds numbers
  // (a cap table, a weighted list of names), a list of members of a closed set,
  // and a single value that is a number or a closed-set member where the stub
  // left a placeholder. Only keys the generated world still has are visited, so
  // a capped-away key is not resurrected by the back door.
  #restoreStructures(generated, original, members, depth = 0) {
    if (depth > 8 || !generated || typeof generated !== 'object') return;
    if (!original || typeof original !== 'object') return;
    if (Array.isArray(generated) !== Array.isArray(original)) return;
    const restore = (key) => {
      const orig = original[key];
      if (isWeightedRecordList(orig) || isStructuralList(orig, members) || isRealStringList(orig)) {
        generated[key] = structuredClone(orig);
        return;
      }
      if (isPlaceholderString(generated[key])) {
        if (typeof orig === 'number' || typeof orig === 'boolean') generated[key] = orig;
        else if (isRealString(orig)) generated[key] = orig;
        return;
      }
      this.#restoreStructures(generated[key], orig, members, depth + 1);
    };
    if (Array.isArray(generated)) {
      for (let i = 0; i < generated.length && i < original.length; i++) restore(i);
      return;
    }
    for (const k of Object.keys(generated)) {
      if (!Object.prototype.hasOwnProperty.call(original, k)) continue;
      restore(k);
    }
  }

  // Gives every placeholder in an array its own value. Only placeholder-shaped
  // strings are touched, so real content and enum members pass through
  // untouched, and no space is introduced - the engine splits names on spaces
  // to compare first and last, so a space here would change what it compares.
  #distinguish(node, depth = 0) {
    if (depth > 8 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      let n = 0;
      for (let i = 0; i < node.length; i++) {
        const v = node[i];
        if (typeof v === 'string' && v.startsWith('[') && v.endsWith(']')) {
          node[i] = `${v.slice(0, -1)}-${++n}]`;
        } else {
          this.#distinguish(v, depth + 1);
        }
      }
      return;
    }
    for (const v of Object.values(node)) this.#distinguish(v, depth + 1);
  }

  // A field whose type this generator has no rule for is reported, never
  // silently emitted as something plausible-looking.
  #unsatisfiable(schema, path) {
    const known = new Set(Object.values(TYPES));
    const problems = [];
    const checkFields = (fields, where) => {
      for (const [name, field] of Object.entries(fields || {})) {
        if (!field.type) continue;
        if (field.type.includes('|')) continue;
        if (!known.has(field.type)) {
          problems.push(`${where}.${name}: no generation rule for type "${field.type}"`);
        }
        if (field.type === TYPES.record) checkFields(field.fields, `${where}.${name}`);
      }
    };
    if (schema.kind === 'map' && schema.value && schema.value.kind === 'record') {
      checkFields(schema.value.fields, path);
    } else if (schema.kind === 'list' && schema.item && schema.item.kind === 'record') {
      checkFields(schema.item.fields, path);
    }
    return problems;
  }
}

// ---------------------------------------------------------------------------
// World-level reconciliation.
//
// A generated world is not a thinned copy of the original key space. Capping a
// table to its target count leaves every weighted list that named the other
// keys pointing at nothing, and the engine does not degrade when a reference
// dangles - it reads undefined and either throws or spins. Both failures were
// observed: ob_names.unusual_name_keys missing threw on `.includes`, and once
// that was fixed the same walk span CPU at 95% inside ob_random_name, because
// species.namecomponents still named "surnamesunfortunate", a key the cap had
// removed.
//
// Reference detection cannot see these. findReferences reads record FIELDS
// holding strings; these names sit positionally between weights inside nested
// arrays. Measured across the payload: 315 reference names in a generated
// world, 100 of them dangling.
//
// So references are remapped rather than preserved. Each name with no key in
// the generated target is rewritten to one that exists, keeping its weight
// beside it. This is what makes the world the generator's own instead of a
// broken subset of the one it learned the shape from.
// ---------------------------------------------------------------------------

// A positional weighted list alternates name, weight, name, weight...
export function weightedNames(list) {
  if (!Array.isArray(list) || list.length < 2 || list.length % 2 !== 0) return null;
  const names = [];
  for (let i = 0; i < list.length; i += 2) {
    if (typeof list[i] !== 'string' || typeof list[i + 1] !== 'number') return null;
    names.push(list[i]);
  }
  return names;
}

// How much of a list must land inside a table's keys before the list counts as
// naming that table. Below this it is content that happens to share a word.
export const REMAP_MIN_RATE = 0.8;
const REMAP_MAX_DEPTH = 7;

// The reference view `remapWorld` works from, exposed for callers that need to
// know the reference graph BEFORE generating - tiering is the case in point.
// `findReferences` reads record fields holding strings and is structurally
// blind to these: the names sit positionally between weights inside nested
// arrays. Tiering on findReferences alone left ob_startingTraits out of the
// opening while ob_archetypes pointed at it, which surfaces as
// "names X, which generated no keys".
export function findWeightedReferences(tables, opts = {}) {
  const rate = opts.minRate ?? REMAP_MIN_RATE;
  const origKeys = {};
  for (const [n, t] of Object.entries(tables)) {
    if (t && typeof t === 'object' && !Array.isArray(t)) origKeys[n] = new Set(Object.keys(t));
  }
  const found = new Set();
  const walk = (node, owner, depth) => {
    if (depth > REMAP_MAX_DEPTH || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      const wn = weightedNames(node);
      const names = wn || (node.length && node.every((x) => typeof x === 'string') ? node : null);
      if (names && names.length) {
        for (const [target, ks] of Object.entries(origKeys)) {
          if (target === owner) continue;
          if (names.filter((n) => ks.has(n)).length / names.length >= rate) {
            found.add(`${owner}\u0000${target}`);
          }
        }
      }
      if (!wn) for (const child of node) walk(child, owner, depth + 1);
      return;
    }
    for (const v of Object.values(node)) walk(v, owner, depth + 1);
  };
  for (const [name, value] of Object.entries(tables)) walk(value, name, 0);
  return [...found].map((k) => {
    const [table, target] = k.split('\u0000');
    return { table, field: '(weighted list)', target };
  });
}

export function remapWorld(world, tables, opts = {}) {
  // Targets are identified against the ORIGINAL key space: the generated target
  // is capped, so matching against it would under-match and miss the very
  // references that need repair.
  const origKeys = {};
  for (const [n, t] of Object.entries(tables)) {
    if (t && typeof t === 'object' && !Array.isArray(t)) origKeys[n] = new Set(Object.keys(t));
  }
  // What the running game will actually have. Machinery namespaces keep all
  // their member names, so callers pass those in rather than letting them look
  // empty and get remapped away.
  const keySpace = {};
  for (const [n, t] of Object.entries(world)) {
    if (t && typeof t === 'object' && !Array.isArray(t)) keySpace[n] = Object.keys(t).sort();
  }
  for (const [n, ks] of Object.entries(opts.keySpace || {})) keySpace[n] = [...ks].sort();

  const targetOf = (names, owner) => {
    let best = null, bestRate = 0;
    for (const [t, ks] of Object.entries(origKeys)) {
      if (t === owner) continue;
      const rate = names.filter((n) => ks.has(n)).length / names.length;
      if (rate > bestRate) { bestRate = rate; best = t; }
    }
    return bestRate >= REMAP_MIN_RATE ? best : null;
  };

  // The members a target's self-index names. The engine treats these as the
  // "unusual" set, and ob_random_name falls back to complist[0] when it draws
  // one:
  //
  //   while (!useunusualnames && unusualnametypes.includes(k)) k = complist[0];
  //
  // If complist[0] is ITSELF in that set the loop never terminates - a pure
  // native spin with no function call in it, which is why a call-counting
  // trip-wire cannot see it and the tab just pins at 100% CPU. Existence is not
  // enough for a reference; position carries an invariant too.
  const unusualOf = (target) => {
    const out = new Set();
    const generated = world[target];
    if (!generated || typeof generated !== 'object') return out;
    for (const k of selfIndexKeys(tables[target] || {})) {
      for (const m of (generated[k] || [])) if (typeof m === 'string') out.add(m);
    }
    return out;
  };
  const unusualCache = new Map();
  const unusualFor = (target) => {
    if (!unusualCache.has(target)) unusualCache.set(target, unusualOf(target));
    return unusualCache.get(target);
  };

  const problems = [];
  let remapped = 0, checked = 0, reordered = 0;

  // Rewrites names in place. Survivors are handed out round-robin from a
  // seeded offset so a list that loses many names spreads across the target
  // instead of collapsing onto one key.
  const repair = (list, names, target, owner) => {
    // A self-index key is structure, never a destination. Remapping an outfit
    // reference onto ob_names.unusual_name_keys would hand the engine a list of
    // key names where it expects a pool of content.
    const structural = new Set(selfIndexKeys(tables[target] || {}));
    const survivors = (keySpace[target] || []).filter((k) => !structural.has(k));
    if (!survivors.length) {
      problems.push(`${owner} names ${target}, which generated no keys`);
      return;
    }
    const have = new Set(survivors);
    const rng = seededRng(`${owner}:${target}`);
    let cursor = Math.floor(rng() * survivors.length);
    const stride = weightedNames(list) ? 2 : 1;
    for (let i = 0; i < names.length; i++) {
      checked++;
      if (have.has(names[i])) continue;
      list[i * stride] = survivors[cursor % survivors.length];
      cursor++;
      remapped++;
    }

    // Enforce the position invariant, whether or not anything was remapped:
    // the stub can place an unusual member first on its own.
    const unusual = unusualFor(target);
    if (!unusual.size || !unusual.has(list[0])) return;
    let swap = -1;
    for (let i = stride; i < list.length; i += stride) {
      if (!unusual.has(list[i])) { swap = i; break; }
    }
    if (swap !== -1) {
      const t = list[0]; list[0] = list[swap]; list[swap] = t;
    } else {
      const plain = survivors.find((k) => !unusual.has(k));
      if (plain === undefined) {
        problems.push(`${owner} names ${target}, whose keys are all in its own self-index - no safe first entry`);
        return;
      }
      list[0] = plain;
    }
    reordered++;
  };

  const walk = (node, owner, depth) => {
    if (depth > REMAP_MAX_DEPTH || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      const wn = weightedNames(node);
      const names = wn || (node.length && node.every((x) => typeof x === 'string') ? node : null);
      if (names && names.length) {
        const target = targetOf(names, owner);
        if (target) repair(node, names, target, owner);
      }
      // A weighted list is a flat name/weight sequence - descending into it
      // would re-read the same strings as if they were their own lists.
      if (!wn) for (const child of node) walk(child, owner, depth + 1);
      return;
    }
    for (const v of Object.values(node)) walk(v, owner, depth + 1);
  };

  for (const [name, value] of Object.entries(world)) walk(value, name, 0);
  return { remapped, checked, reordered, problems };
}
