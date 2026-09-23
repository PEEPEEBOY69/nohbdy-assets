// world/writer.mjs — the world keeps being written while the player plays.
//
// Measured on perchance.org (2026-09-23): a 40-field batch through the real
// ai-text-plugin took 66 s, and a world has thousands of fields of prose the
// chassis stripped. Written up front that was a forty-minute build behind a
// screen that said "Starting...". So the build now writes only what the first
// screens need and leaves a PLAN: every field still to write, by path. This
// writes the plan in the background, one batch at a time, as background calls
// on the shared model - painting and the living world wait only for foreground
// work, so they keep running beside it.
//
// Until a field is written it is blank, never a placeholder: a blank field is
// an absent sentence, a token is a broken game. What is written is a LOG, path
// to text, saved after every batch and replayed onto `setup` after a restore -
// `setup` is rebuilt from the chassis on every load - so a reload resumes where
// the writing stopped.
import { isPlaceholder } from './ai-generator.mjs';

// The chassis's own marker for the original's prose, which it could not ship.
export const STRIPPED = /unwritten #\d+/;
// Where the plan and the log are stored, beside the world's tables.
export const PLAN_LOG = '__plan';
export const WRITES_LOG = '__writes';
// On perchance.org a call costs 20-30 s before its first word, whatever its
// size (measured 2026-09-23: 20 fields came back at 3.1 s a field, 40 at
// 1.65). Forty a call is about an hour for a whole world, saved every minute
// and a half.
export const WRITER_FIELDS_PER_CALL = 40;
export const WRITER_MAX_TRIES = 2;

// What a player opens first, first. A table on screen jumps the queue anyway.
export const WRITE_ORDER = [
  'people', 'ob_archetypes',
  'clothes', 'ob_dormstuff', 'ob_food', 'ob_miscitems', 'sextoys', 'ob_cosmetics',
  'inclinations', 'ob_startingTraits', 'ob_sexualities', 'ob_skills', 'ob_stats',
  'School', 'ob_relationships', 'ob_storyhints',
  'ob_houses', 'ob_housing', 'ob_worldgen', 'ob_books', 'ob_events',
];

// Keys, not a dot-joined path: record keys are titles, and "Stacy Supernova,
// vol. 1: Plutonium Panic!" split on its dots names nothing. The dot-joined
// path is only the entry's id, the key of the log.
const keysOf = (e) => (Array.isArray(e.keys) ? e.keys : String(e.path).split('.'));

function getPath(root, path) {
  let node = root;
  for (const k of Array.isArray(path) ? path : path.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = node[k];
  }
  return node;
}

function setPath(root, path, value) {
  const parts = Array.isArray(path) ? path : path.split('.');
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    node = node && node[parts[i]];
    if (!node || typeof node !== 'object') return false;
  }
  const last = parts[parts.length - 1];
  if (!node || typeof node !== 'object' || !(last in node)) return false;
  node[last] = value;
  return true;
}

// Every placeholder under `value`, with the exact keys that reach it.
function placeholdersIn(value, keys = [], out = [], depth = 0) {
  if (depth > 9 || !value || typeof value !== 'object') return out;
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value);
  for (const [k, v] of entries) {
    const here = [...keys, k];
    if (isPlaceholder(v)) out.push({ keys: here, value: v });
    else if (v && typeof v === 'object') placeholdersIn(v, here, out, depth + 1);
  }
  return out;
}

const entryFor = (keys) => ({
  path: keys.join('.'),
  keys,
  table: keys[0],
  group: keys.slice(0, -1).join('.') || '(root)',
  label: keys.slice(-2).join('.'),
  singleWord: false,
});

// Every placeholder the build left in the generated world - all of it the
// original's stripped prose now that the engine's own strings are kept - each
// blanked where it stands. With the originals at hand, a field the original
// record never had is the stub's invention (two turnons came back with an
// `opposite`, a pointer field): it is removed, not written as prose.
export function planWorld(world, originals) {
  const plan = [];
  for (const f of placeholdersIn(world || {})) {
    if (originals) {
      const parent = getPath(originals, f.keys.slice(0, -1));
      const last = f.keys[f.keys.length - 1];
      if (parent && typeof parent === 'object' && !Array.isArray(parent) && !(last in parent)) {
        const holder = getPath(world, f.keys.slice(0, -1));
        if (holder && typeof holder === 'object') delete holder[last];
        continue;
      }
    }
    plan.push(entryFor(f.keys));
    setPath(world, f.keys, '');
  }
  return plan;
}

// Every piece of the original's stripped prose anywhere in `setup`: the
// thousands the build never generated (clothes, books, hints, skills...), each
// blanked. Only the chassis's own marker counts; any other bracketed string is
// data.
export function planChassis(setup) {
  const plan = [];
  for (const name of Object.keys(setup || {})) {
    const table = setup[name];
    if (!table || typeof table !== 'object') continue;
    for (const f of placeholdersIn(table, [name])) {
      if (!STRIPPED.test(f.value)) continue;
      plan.push(entryFor(f.keys));
      setPath(setup, f.keys, '');
    }
  }
  return plan;
}

// After a restore: the written text goes back, everything unwritten is blank.
export function replayWriting(setup, plan, writes) {
  const log = writes && typeof writes === 'object' ? writes : {};
  const remaining = [];
  for (const e of plan || []) {
    const text = log[e.path];
    if (typeof text === 'string') setPath(setup, keysOf(e), text);
    else { setPath(setup, keysOf(e), ''); remaining.push(e); }
  }
  return remaining;
}

// A dialog or passage name, to the tables that screen shows.
export function tablesForScreen(name) {
  const t = String(name || '').toLowerCase();
  if (/invent/.test(t)) return ['ob_dormstuff', 'clothes', 'ob_food', 'ob_miscitems', 'sextoys', 'ob_cosmetics'];
  if (/outfit|cloth|wardrobe|dress/.test(t)) return ['clothes'];
  if (/charac/.test(t)) return ['inclinations', 'ob_skills', 'ob_startingTraits', 'ob_sexualities', 'ob_stats', 'people'];
  if (/people|contact/.test(t)) return ['people', 'ob_archetypes', 'ob_relationships'];
  if (/hint/.test(t)) return ['ob_storyhints'];
  if (/schedule|class|course|school/.test(t)) return ['School'];
  if (/book|librar/.test(t)) return ['ob_books'];
  if (/shop|store|mall|market/.test(t)) return ['clothes', 'ob_food', 'ob_miscitems', 'ob_cosmetics'];
  return [];
}

export function formatEta(ms) {
  if (ms == null || !Number.isFinite(ms)) return '';
  if (ms < 60000) return 'under a minute';
  const min = Math.round(ms / 60000);
  if (min < 90) return `about ${min} min`;
  const h = Math.floor(min / 60);
  const rest = min - h * 60;
  return rest ? `about ${h} h ${rest} min` : `about ${h} h`;
}

// deps: model, generator (AiGenerator), root() -> setup, premise(), plan,
// writes (the log so far), save(writes), onProgress(progress), now(), order.
export function createWriter(deps) {
  const {
    model, generator, root, premise = () => '', plan = [], save = async () => {},
    onProgress = () => {}, now = () => Date.now(),
    fieldsPerCall = WRITER_FIELDS_PER_CALL, maxTries = WRITER_MAX_TRIES, order = WRITE_ORDER,
  } = deps;
  const writes = deps.writes && typeof deps.writes === 'object' ? deps.writes : {};
  const pending = new Map();
  for (const e of plan) if (typeof writes[e.path] !== 'string') pending.set(e.path, { ...e, tries: 0 });
  const total = plan.length;
  const boosted = [];
  const used = new Map();
  const stats = { batches: 0, written: 0, dropped: 0, msPerField: null };
  let running = null;
  let stopped = false;

  const rank = (table) => {
    const b = boosted.indexOf(table);
    if (b !== -1) return b - 1000;
    const i = order.indexOf(table);
    return i === -1 ? order.length : i;
  };

  function nextBatch() {
    let best = null;
    for (const e of pending.values()) {
      if (!best || rank(e.table) < rank(best.table)) best = e;
    }
    if (!best) return null;
    const fields = [];
    for (const e of pending.values()) {
      if (e.table === best.table) fields.push(e);
      if (fields.length >= fieldsPerCall) break;
    }
    return { table: best.table, fields };
  }

  function progress() {
    const remaining = pending.size;
    return {
      total,
      done: total - remaining,
      remaining,
      fraction: total ? (total - remaining) / total : 1,
      etaMs: stats.msPerField == null || !remaining ? (remaining ? null : 0) : Math.round(remaining * stats.msPerField),
      running: !!running,
    };
  }

  async function step() {
    const batch = nextBatch();
    if (!batch) return false;
    const t0 = now();
    const fields = batch.fields.map(e => ({
      path: keysOf(e), label: e.label, group: e.group, singleWord: !!e.singleWord, value: '',
    }));
    try {
      await generator.fill({ table: batch.table, premise: premise() }, root(), fields, used, { background: true });
    } catch { /* counted below as a try */ }
    let wrote = 0;
    for (const e of batch.fields) {
      const v = getPath(root(), keysOf(e));
      if (typeof v === 'string' && v.trim() && !isPlaceholder(v)) {
        writes[e.path] = v;
        pending.delete(e.path);
        wrote += 1;
      } else {
        e.tries += 1;
        if (e.tries >= maxTries) { pending.delete(e.path); stats.dropped += 1; }
      }
    }
    stats.batches += 1;
    stats.written += wrote;
    if (wrote) {
      const per = (now() - t0) / wrote;
      stats.msPerField = stats.msPerField == null ? per : stats.msPerField * 0.7 + per * 0.3;
    }
    try { await save(writes); } catch { /* the next batch saves the whole log again */ }
    try { onProgress(progress()); } catch { /* a listener is not the writer's failure */ }
    return true;
  }

  async function loop() {
    try {
      while (!stopped && pending.size) {
        if (model && typeof model.available === 'function' && !model.available()) break;
        if (!(await step())) break;
      }
    } finally {
      running = null;
      try { onProgress(progress()); } catch { /* as above */ }
    }
  }

  return {
    start() {
      stopped = false;
      if (!running) running = loop();
      return { done: running };
    },
    stop() { stopped = true; },
    step,
    seen(tables) {
      for (const t of [].concat(tables || [])) {
        const i = boosted.indexOf(t);
        if (i !== -1) boosted.splice(i, 1);
        boosted.unshift(t);
      }
    },
    progress,
    stats,
    writes: () => writes,
  };
}

// The one writer on the page, so the hub can say how far it has got.
let current = null;
export function setCurrentWriter(writer) { current = writer || null; }
export function currentWriter() { return current; }

// "Still writing this world — 38%, about 25 min", or nothing once it is done.
export function writingLine(progress) {
  if (!progress || !progress.remaining) return '';
  const pct = Math.floor((progress.fraction || 0) * 100);
  const eta = formatEta(progress.etaMs);
  return `Still writing this world — ${pct}%${eta ? `, ${eta}` : ''}`;
}

// For the World tab in Options.
export function writerStatus(writer, paused = false) {
  const p = writer && typeof writer.progress === 'function' ? writer.progress() : null;
  if (!p || !p.remaining) return 'This world is fully written.';
  if (paused) return `Writing is paused at ${Math.floor((p.fraction || 0) * 100)}%.`;
  return writingLine(p);
}
