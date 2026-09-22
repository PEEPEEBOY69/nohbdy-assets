// world/durable.mjs — the generated world outlives the page.
//
// applyWorld writes a world into `setup`, and `setup` is rebuilt from the
// chassis on every page load. A SugarCube save carries story variables and
// nothing else. So before this, a reload put the player's save - premise,
// lexicon, place names - back on top of the chassis's placeholder tables,
// "[description - unwritten #124]" and all, and nothing said so.
//
// Now a build gets an id ($obscuraWorldId, in the save like the lexicon) and
// every generated table is written to IndexedDB under it, one record per table.
// On every passage the installed hook compares the save's id with the world
// actually in `setup`, and loads it when they differ. One path covers a reload,
// a restored session and loading a save.
//
// Loading a save from a DIFFERENT world than the one already in `setup`
// reloads the page instead. Applying one world on top of another would keep
// whatever the first had grown into tables the second never generated; after
// a reload the second lands on pristine tables, which is the only state a
// world was ever built against.
export const WORLD_ID_KEY = 'obscuraWorldId';
export const FORMAT = 1;

export function newWorldId(rand = Math.random, now = Date.now) {
  return `w${now().toString(36)}${Math.floor(rand() * 2 ** 32).toString(36)}`;
}

// A copy IndexedDB's structured clone can take: functions and symbols are
// dropped (removed from objects, null in arrays - JSON's rules), and a cycle
// makes the whole value unusable, reported as undefined rather than stored
// half-written. Dates, Maps and Sets are kept, because structured clone keeps
// them and the engine may rely on them.
//
// NOT a JSON round-trip. SugarCube extends JSON so that functions survive
// one: stringify wraps a function and parse revives it. In the game page
// JSON.parse(JSON.stringify(table)) handed the generator's stub functions
// straight back, and IndexedDB refused the whole world with a DataCloneError.
export function plain(value) {
  const seen = new WeakSet();
  const CYCLE = {};
  const walk = (v) => {
    const t = typeof v;
    if (t === 'function' || t === 'symbol' || t === 'bigint') return undefined;
    if (v === null || t !== 'object') return v;
    if (seen.has(v)) throw CYCLE;
    seen.add(v);
    try {
      if (Array.isArray(v)) return v.map((x) => { const c = walk(x); return c === undefined ? null : c; });
      if (v instanceof Date) return new Date(v.getTime());
      if (v instanceof Map) {
        const m = new Map();
        for (const [k, x] of v) { const c = walk(x); if (c !== undefined) m.set(walk(k), c); }
        return m;
      }
      if (v instanceof Set) {
        const s = new Set();
        for (const x of v) { const c = walk(x); if (c !== undefined) s.add(c); }
        return s;
      }
      if (typeof Node !== 'undefined' && v instanceof Node) return undefined;
      const out = {};
      for (const k of Object.keys(v)) { const c = walk(v[k]); if (c !== undefined) out[k] = c; }
      return out;
    } finally {
      seen.delete(v);
    }
  };
  try { return walk(value); } catch (e) { if (e === CYCLE) return undefined; throw e; }
}

export async function persistWorld(store, id, world, meta = {}) {
  const tables = [];
  for (const [name, value] of Object.entries(world || {})) {
    const v = plain(value);
    if (v === undefined) continue;
    await store.saveTable(id, name, v);
    tables.push(name);
  }
  await store.saveWorld(id, { ...plain(meta), format: FORMAT, tables, savedAt: Date.now() });
  return tables;
}

export async function loadWorld(store, id) {
  const meta = await store.loadWorld(id);
  if (!meta || !Array.isArray(meta.tables)) return null;
  const world = {};
  for (const name of meta.tables) {
    const t = await store.loadTable(id, name);
    if (t !== undefined && t !== null) world[name] = t;
  }
  return { meta, world };
}

// deps: store, setup(), state() -> story variables, apply(setup, world),
// afterApply({setup, vars, meta, world}) -> extra report fields,
// rerender(), reload().
export function createDurable(deps) {
  let appliedId = null;
  const inflight = new Map();
  const missing = new Set();

  async function restore(id) {
    const loaded = await loadWorld(deps.store, id);
    if (!loaded) {
      missing.add(id);
      return { status: 'missing', id };
    }
    const setup = deps.setup();
    deps.apply(setup, loaded.world);
    appliedId = id;
    const extra = deps.afterApply ? (deps.afterApply({ setup, vars: deps.state(), ...loaded }) || {}) : {};
    if (deps.rerender) deps.rerender();
    return { status: 'restored', id, tables: Object.keys(loaded.world).length, ...extra };
  }

  function ensure() {
    const vars = deps.state();
    const id = vars && vars[WORLD_ID_KEY];
    if (!id) return Promise.resolve({ status: 'none' });
    if (inflight.has(id)) return inflight.get(id);
    // Another world is still loading: let it land, then decide again, so two
    // worlds are never applied into the same tables at once.
    if (inflight.size) return Promise.all([...inflight.values()]).then(ensure, ensure);
    if (id === appliedId) return Promise.resolve({ status: 'current', id });
    if (appliedId !== null) {
      if (deps.reload) deps.reload();
      return Promise.resolve({ status: 'switching', from: appliedId, id });
    }
    const p = restore(id).finally(() => inflight.delete(id));
    inflight.set(id, p);
    return p;
  }

  return {
    applied: () => appliedId,
    missing: () => [...missing],
    markApplied(id) { appliedId = id; },
    ensure,
  };
}
