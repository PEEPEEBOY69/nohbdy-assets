// tools/make-stubs.mjs — schema in, minimal conforming data out.
//
// Stubs exist to answer one question: are the schemas sufficient for the engine
// to run? So they are deliberately dull and deterministic. Interesting content
// is slice 2's job, and mixing the two would make a failure ambiguous.
import { TYPES, isFunctionValue } from './schema.mjs';

const STUB_RECORDS = 2;   // enough for a map to be a map; small enough to read
const STUB_LIST = 3;
// The schema records a field's TRUE observed minimum length, because a
// generator needs it. A stub must not honour it literally: ob_dialogue observes
// 342 and ob_tcg.adjective 288, nested arrays multiply, and stub generation
// hangs. 4 covers the positional cases that actually matter - namecomponents
// needs its two lists, given names then surnames - without exploding.
export const STUB_ARRAY_CAP = 4;
// Reusing every real key made worldgen spin at 100% CPU - its selection loops
// scale with table size, and clothes alone has 915 entries. A stub needs enough
// variety to satisfy those loops, not the full catalogue. Keys that OTHER
// tables reference are always kept on top of the cap, because dropping one
// breaks that lookup silently.
export const STUB_MAP_CAP = 12;
// A HARD ceiling on a stub table's total size, keepKeys included. Letting
// keepKeys grow unbounded put 60+ keys on `inclinations` and the page pinned a
// core again: worldgen's selection loops scale with table size, so the total is
// what matters, not which list a key came from. Priority when trimming:
// code-named keys first (the engine names them literally), then referenced
// keys, then ordinary samples.
export const STUB_MAP_HARD_CAP = 12;
// A record field is generated when at least this fraction of the observed
// records carry it. Below it the field really is occasional and inventing one
// everywhere would be bloat.
export const STUB_FIELD_PRESENCE = 0.5;

// Reference context: { refs, tables } from tools/schema-refs.mjs. When a field
// is known to point at another table, the stub must use a REAL key from that
// table. An invented string makes the engine's lookup return undefined, and
// the failure is silent until something reads .length on it.
function refKeyFor(ctx, table, field) {
  if (!ctx || !ctx.refs || !ctx.tables) return undefined;
  const ref = ctx.refs.find(r => r.table === table && r.field === field);
  if (!ref) return undefined;
  const target = ctx.tables[ref.target];
  if (!target || typeof target !== 'object') return undefined;
  const keys = Object.keys(target).filter(k => {
    const v = target[k];
    return !isFunctionValue(v);
  });
  return keys.length ? keys[0] : undefined;
}

function stubField(field, path) {
  switch (field.type) {
    case TYPES.number: {
      const lo = Number.isFinite(field.min) ? field.min : 0;
      const hi = Number.isFinite(field.max) ? field.max : lo;
      const mid = lo + (hi - lo) / 2;
      return field.integer ? Math.round(mid) : mid;
    }
    case TYPES.boolean: return false;
    case TYPES.null: return null;
    case TYPES.function: return function stub() { return undefined; };
    case TYPES.array:
      // Weighted list: emit real keys with their observed weights. Inventing a
      // key here makes the engine's lookup return undefined far away from here.
      if (field.weightedList && field.weightKeys && field.weightKeys.length) {
        return field.weightKeys.flatMap(k => [k, 1]);
      }
      if (!field.item) return [];
      // Emit the observed minimum count, not one: a short array silently
      // changes behaviour rather than erroring.
      const n = Math.min(STUB_ARRAY_CAP, Math.max(1, field.minItems || 1));
      return Array.from({ length: n }, () => stubField(field.item, path));
    case TYPES.record: return stubRecord(field.fields, path);
    case TYPES.string:
    default:
      // An enum value must come FROM the enum: the engine frequently switches
      // on these, and an invented value takes a branch that does not exist.
      if (field.enum && field.enum.length) return field.enum[0];
      return `[${path}]`;
  }
}

function stubRecord(fields, path, ctx, table) {
  const out = {};
  for (const [name, field] of Object.entries(fields || {})) {
    // Emit a field the records overwhelmingly carry, not only one every single
    // record carries. One structurally different member of a table (see
    // ob_archetypes.inclination_sets) makes every real field optional, and a
    // required-only stub is then an empty object.
    if (!field.required && !(field.presence >= STUB_FIELD_PRESENCE)) continue;
    // An enum is what the field was OBSERVED holding; a reference is inferred
    // from value overlap. When they disagree the enum wins, or the stub
    // violates the very schema it came from.
    const hasEnum = field.enum && field.enum.length
      || (field.type === 'array' && field.item && field.item.enum && field.item.enum.length);
    const refKey = hasEnum ? undefined : refKeyFor(ctx, table, name);
    if (refKey !== undefined) {
      out[name] = field.type === 'array' ? [refKey] : refKey;
      continue;
    }
    out[name] = stubField(field, `${path}.${name}`);
  }
  // A record must never come out empty. Where every field is rare - the
  // `appeal` records in ob_business are {archetype}, {presentation, archetype},
  // {inclination} and so on, so no single field clears the presence bar - the
  // filter above removes all of them. The engine does not treat that as "no
  // data", it destructures: `const [k, v] = Object.entries(condition)[0]`,
  // which throws on {}. An empty record also conforms vacuously, so nothing
  // downstream catches it.
  if (!Object.keys(out).length) {
    const names = Object.keys(fields || {});
    if (names.length) {
      const best = names.reduce((a, b) =>
        ((fields[b].presence ?? 0) > (fields[a].presence ?? 0) ? b : a));
      out[best] = stubField(fields[best], `${path}.${best}`);
    }
  }
  return out;
}

export function stubFor(schema, name, ctx) {
  if (!schema) return {};
  // Methods ride along on the same object as the data. Dropping one makes the
  // engine call undefined; 39 of 110 tables carry them.
  const withMethods = (obj) => {
    if (schema.methods && !Array.isArray(obj)) {
      for (const m of schema.methods) obj[m] = function stub() { return undefined; };
    }
    return obj;
  };

  if (schema.kind === 'empty') return withMethods(schema.was === 'array' ? [] : {});
  if (schema.kind === 'scalar') return stubField(schema, name);
  if (schema.kind === 'list') {
    const item = schema.item.kind === 'record'
      ? stubRecord(schema.item.fields, name, ctx, name)
      : stubField(schema.item, name);
    return Array.from({ length: STUB_LIST }, () => item);
  }
  if (schema.kind === 'map') {
    const out = {};
    // Reuse real keys when the schema captured them: other tables reference
    // items BY NAME, so inventing keys breaks every cross-reference at once.
    const keepKeys = (ctx && ctx.keepKeys) || [];
    const all = schema.keys && schema.keys.length
      ? schema.keys
      : Array.from({ length: STUB_RECORDS }, (_, i) => `${name}-${i + 1}`);
    const mustKeep = [...new Set(keepKeys.filter(k => all.includes(k)))];
    const sampled = all.slice(0, STUB_MAP_CAP);
    // Mandatory keys are not subject to the cap. They are the engine's
    // contract - keys another table points at, keys the engine dereferences,
    // keys it names by literal - and truncating them is how "Jock" went
    // missing from ob_archetypes while 26 code-named keys were being kept.
    // The cap governs how much content is invented, not whether the world
    // satisfies the engine.
    const keys = [...mustKeep];
    for (const k of sampled) {
      if (keys.length >= STUB_MAP_HARD_CAP) break;
      if (!keys.includes(k)) keys.push(k);
    }
    // Records get a UNIFORM shape, deliberately. Preserving each record's own
    // field set is more faithful to the original and measurably worse in the
    // engine - 38 people against 162. Capping a table to 12 of 144 records
    // breaks the fallback structure the absent fields relied on:
    //
    //   if (!(att in courseinfo)) return courses[base_course_for(...)][att];
    //
    // The base course the fallback wants is usually not among the 12 kept, so
    // a faithfully-absent field resolves to undefined. A uniform shape makes
    // the fallback unnecessary instead of correct - not elegant, but the
    // alternative is a world that does not run.
    for (const k of keys) {
      out[k] = schema.value.kind === 'record'
        ? stubRecord(schema.value.fields, name, ctx, name)
        : stubField(schema.value, name);
    }
    return withMethods(out);
  }
  return withMethods({});
}

// Validation runs before anything reaches the engine. A generator that emits
// non-conforming data must fail here, loudly, rather than inside a passage.
export function conforms(value, schema, path = '') {
  const problems = [];
  if (!schema || schema.kind === 'empty') return problems;

  const actualType = (v) => v === null ? TYPES.null
    : Array.isArray(v) ? TYPES.array
    : typeof v === 'function' ? TYPES.function
    : isFunctionValue(v) ? TYPES.function
    : typeof v === 'object' ? TYPES.record
    : typeof v === 'number' ? TYPES.number
    : typeof v === 'boolean' ? TYPES.boolean
    : TYPES.string;

  const checkRecord = (rec, fields, where) => {
    for (const [name, field] of Object.entries(fields || {})) {
      const has = rec && Object.prototype.hasOwnProperty.call(rec, name);
      if (field.required && !has) { problems.push(`${where}: missing required field "${name}"`); continue; }
      if (!has) continue;
      if (field.type.includes('|')) continue;          // union: accept any member
      const actual = actualType(rec[name]);
      if (actual !== field.type) {
        problems.push(`${where}.${name}: expected ${field.type}, got ${actual}`);
        continue;
      }
      if (field.enum && !field.enum.includes(rec[name])) {
        problems.push(`${where}.${name}: "${rec[name]}" is not in the observed set`);
      }
    }
  };

  if (schema.kind === 'map' && schema.value && schema.value.kind === 'record') {
    for (const [k, rec] of Object.entries(value || {})) {
      if (typeof rec === 'function') continue;         // a method, not a record
      checkRecord(rec, schema.value.fields, `${path}${k}`);
    }
  } else if (schema.kind === 'list' && schema.item && schema.item.kind === 'record') {
    (value || []).forEach((rec, i) => checkRecord(rec, schema.item.fields, `${path}[${i}]`));
  }
  return problems;
}
