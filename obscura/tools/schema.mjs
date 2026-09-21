// tools/schema.mjs — infer a schema from an already-parsed value.
//
// Pure: no I/O, no browser, no globals. Everything here is driven by real
// parsed data from chassis/tables.json, never by source text.

export const TYPES = {
  string: 'string', number: 'number', boolean: 'boolean',
  array: 'array', record: 'record', function: 'function', null: 'null',
};

// Above this many distinct values a string field is free text, not a closed set.
// 24 is a judgement call: slot/category/rarity fields in this data sit in the
// single digits, while names and labels run to hundreds.
export const ENUM_MAX = 24;

// A function, in either representation the pipeline meets.
//
// dump-tables.mjs encodes a live function as { __kind: 'function' } because
// JSON cannot carry one. Everything downstream was written against that
// marker - which was correct while the only input was a dumped file, and
// silently wrong the moment the generator started reading the LIVE `setup` in
// the browser: a real function is not an object, so it counted as data,
// setup.people's 450 methods looked like content, and the namespace was
// classified 'data' and replaced wholesale. The first symptom was
// `setup.people.add_static is not a function` deep inside worldgen.
export function isFunctionValue(v) {
  if (typeof v === 'function') return true;
  return !!v && typeof v === 'object' && !Array.isArray(v) && v.__kind === 'function';
}

const isFunctionMarker = isFunctionValue;

// [string, number, string, number, ...] with at least one pair.
function isWeightedList(v) {
  if (!Array.isArray(v) || v.length < 2 || v.length % 2 !== 0) return false;
  for (let i = 0; i < v.length; i += 2) {
    if (typeof v[i] !== 'string') return false;
    if (typeof v[i + 1] !== 'number') return false;
  }
  return true;
}

function typeOf(v) {
  if (v === null) return TYPES.null;
  if (Array.isArray(v)) return TYPES.array;
  if (isFunctionValue(v)) return TYPES.function;
  if (typeof v === 'object') return TYPES.record;
  if (typeof v === 'number') return TYPES.number;
  if (typeof v === 'boolean') return TYPES.boolean;
  return TYPES.string;
}

function describeField(values) {
  const present = values.filter(v => v !== undefined);
  if (!present.length) return { type: TYPES.null };
  const types = new Set(present.map(typeOf));
  const type = types.size === 1 ? [...types][0] : [...types].sort().join('|');
  const field = { type };

  if (type === TYPES.function) {
    const arities = present.map(v => v.arity).filter(a => typeof a === 'number');
    if (arities.length) field.arity = Math.max(...arities);
    return field;
  }
  if (type === TYPES.number) {
    field.min = Math.min(...present);
    field.max = Math.max(...present);
    field.integer = present.every(Number.isInteger);
    return field;
  }
  if (type === TYPES.string) {
    const distinct = new Set(present);
    if (distinct.size <= ENUM_MAX) field.enum = [...distinct].sort();
    else field.sampleCount = distinct.size;
    return field;
  }
  if (type === TYPES.array) {
    // A weighted-choice list alternates key, weight, key, weight. Type
    // inference alone reports "string|number", which is true and useless: the
    // strings address another table and the numbers are relative frequencies.
    // Detected here so a stub can emit a REAL key with a plausible weight.
    if (present.every(isWeightedList)) {
      field.weightedList = true;
      const keys = new Set();
      for (const arr of present) for (let i = 0; i < arr.length; i += 2) keys.add(arr[i]);
      field.weightKeys = [...keys].sort();
      return field;
    }
    // Length is part of the contract. namecomponents always holds two lists -
    // given names then surnames - and a one-item stub produced a name with no
    // surname, which chargen rejected silently rather than erroring.
    field.minItems = Math.min(...present.map(a => a.length));
    field.maxItems = Math.max(...present.map(a => a.length));
    const items = present.flat();
    if (items.length) field.item = describeField(items);
    return field;
  }
  if (type === TYPES.record) {
    field.fields = describeRecords(present);
    return field;
  }
  return field;
}

function describeRecords(records) {
  const keys = new Set();
  for (const r of records) for (const k of Object.keys(r)) keys.add(k);
  const out = {};
  for (const k of keys) {
    const values = records.map(r => r[k]);
    out[k] = describeField(values);
    // Required means present in EVERY record. A generator that treats an
    // optional field as required produces bloat; the reverse produces crashes.
    out[k].required = records.every(r => Object.prototype.hasOwnProperty.call(r, k));
    // How many records actually carry it. `required` alone is too brittle to
    // generate from: ob_archetypes holds 54 archetypes plus one config member,
    // inclination_sets, whose shape shares nothing with them - so EVERY real
    // field scores optional and a stub built from required-only comes out as
    // an empty object. The engine then reads arcdata.perfected.includes(...)
    // on undefined. Presence keeps the strict flag for validation and gives
    // generation a usable signal.
    const held = records.filter(r => Object.prototype.hasOwnProperty.call(r, k)).length;
    out[k].presence = records.length ? held / records.length : 0;
  }
  return out;
}

// Above this fraction of function members, a namespace is machinery wearing a
// data-shaped hat. setup.people is 450 functions to 10 data values; replacing
// it wholesale wipes add_static, pronouns and get_person, and the world
// generates zero people. Measured: 32 of 70 object namespaces cross this line.
export const MACHINERY_FN_RATE = 0.5;

export function classify(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'data';
  const values = Object.values(value);
  if (!values.length) return 'data';
  const fns = values.filter(isFunctionMarker).length;
  return fns / values.length > MACHINERY_FN_RATE ? 'machinery' : 'data';
}

export function inferSchema(value) {
  if (value === null || typeof value !== 'object') {
    return { kind: 'scalar', ...describeField([value]) };
  }
  if (Array.isArray(value)) {
    if (!value.length) return { kind: 'empty', was: 'array' };
    const allRecords = value.every(v => v && typeof v === 'object' && !Array.isArray(v) && v.__kind !== 'function');
    return allRecords
      ? { kind: 'list', item: { kind: 'record', fields: describeRecords(value) }, count: value.length }
      : { kind: 'list', item: describeField(value), count: value.length };
  }
  const allKeys = Object.keys(value);
  if (!allKeys.length) return { kind: 'empty', was: 'object' };

  // A data table can carry METHODS on the same object: setup.clothes holds 915
  // garment records plus validate/explicate/... Treating those as data made the
  // whole table fall through to a shapeless map and lose every field. Partition
  // them out, and record their names so a stub can preserve them.
  const methods = allKeys.filter(k => isFunctionMarker(value[k]));
  const keys = allKeys.filter(k => !isFunctionMarker(value[k]));
  const withMethods = obj => (methods.length ? { ...obj, methods } : obj);

  if (!keys.length) return withMethods({ kind: 'empty', was: 'object' });

  const values = keys.map(k => value[k]);
  const allRecords = values.every(v => v && typeof v === 'object' && !Array.isArray(v) && v.__kind !== 'function');
  if (allRecords) {
    return withMethods({
      kind: 'map',
      keyCount: keys.length,
      // ALWAYS record keys, regardless of count. Keys are the addressable
      // surface - the engine does names.female and clothes["T-shirt"], not
      // positional access. Sampling them made stubFor invent key names and
      // every lookup by a real name returned undefined.
      keys: keys.slice().sort(),
      value: { kind: 'record', fields: describeRecords(values) },
    });
  }
  // Keys matter on this branch too: ob_names maps category -> array of names,
  // and the engine reads names.unusual_name_keys by that exact name.
  return withMethods({ kind: 'map', keyCount: keys.length, keys: keys.slice().sort(), value: describeField(values) });
}
