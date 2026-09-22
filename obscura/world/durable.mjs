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

// Through JSON, so nothing IndexedDB's structured clone would throw on - a
// function, a DOM node - can reach it. A cycle makes the whole value unusable,
// which is reported as undefined rather than stored half-written.
export function plain(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return undefined; }
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
