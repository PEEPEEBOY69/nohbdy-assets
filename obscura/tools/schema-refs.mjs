// tools/schema-refs.mjs — find fields that point at other tables by name.
//
// `prereq` and `add` hold the names of other items. A generator that treats
// them as free text emits a world whose items reference nothing, and the
// failure is silent: the engine finds no match and quietly does less.

// A field must resolve this fraction of its values against a candidate table
// before it counts as a reference. Below this it is coincidence - ordinary
// words overlap with names.
export const REF_MIN_HIT_RATE = 0.8;
// Below this many observed values there is not enough evidence either way.
export const REF_MIN_SAMPLES = 3;

import { isFunctionValue as isFunctionMarker } from './schema.mjs';

function stringValuesByField(table) {
  const out = new Map();
  const push = (field, v) => {
    if (typeof v !== 'string') return;
    if (!out.has(field)) out.set(field, []);
    out.get(field).push(v);
  };
  const records = Array.isArray(table) ? table : Object.values(table);
  for (const rec of records) {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec) || isFunctionMarker(rec)) continue;
    for (const [field, v] of Object.entries(rec)) {
      if (Array.isArray(v)) v.forEach(x => push(field, x));
      else push(field, v);
    }
  }
  return out;
}

export function findReferences(tables) {
  const keySets = new Map();
  for (const [name, t] of Object.entries(tables)) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) continue;
    // Methods are not addressable items; a field matching "validate" is not a
    // reference to it.
    const keys = Object.keys(t).filter(k => !isFunctionMarker(t[k]));
    if (keys.length) keySets.set(name, new Set(keys));
  }

  const refs = [];
  for (const [table, t] of Object.entries(tables)) {
    if (!t || typeof t !== 'object') continue;
    for (const [field, values] of stringValuesByField(t)) {
      if (values.length < REF_MIN_SAMPLES) continue;
      let best = null;
      for (const [target, keys] of keySets) {
        if (target === table) continue;
        const hits = values.filter(v => keys.has(v)).length;
        const hitRate = hits / values.length;
        if (hitRate >= REF_MIN_HIT_RATE && (!best || hitRate > best.hitRate)) {
          best = { table, field, target, hitRate, samples: values.length };
        }
      }
      if (best) {
        // When several tables share a key space the best match may not be the
        // only defensible one, so record the rivals rather than emit a single
        // confident answer. Measured on the real data: zero ambiguous fields.
        // archetypes.turnoffs -> turnons looks wrong and is not - there is no
        // separate turnoffs table; both draw from one 48-entry trait vocabulary.
        const rivals = [];
        for (const [target, keys] of keySets) {
          if (target === table || target === best.target) continue;
          const hitRate = values.filter(v => keys.has(v)).length / values.length;
          if (hitRate >= REF_MIN_HIT_RATE) rivals.push(target);
        }
        if (rivals.length) best.ambiguousWith = rivals;
        refs.push(best);
      }
    }
  }
  return refs.sort((a, b) => b.hitRate - a.hitRate || a.table.localeCompare(b.table));
}
