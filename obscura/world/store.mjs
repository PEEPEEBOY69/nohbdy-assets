// world/store.mjs - IndexedDB persistence for the world and its NPCs.
//
// localStorage is not an option. Lumen died on the ~5 MB ceiling once, at
// 1,572,707 bytes for a single character's images. SugarCube already carries
// IndexedDB - 70 references, and COT's boot logs "checking browser version for
// idb" - so this adopts a capability rather than building one.
//
// NPCs are stored ONE PER KEY. Storing the cast as a single blob would undo
// the per-NPC scoping that makes the 6,000-token budget work: a two-person
// scene would have to read every NPC in the world to assemble its context.
// `tables` holds a generated world, one record per table (world/durable.mjs):
// the living world rewrites one table after a task, not the whole world.
// `pictures` holds what world/painter.mjs painted, and the looks it painted from.
export const STORE_NAMES = {
  world: 'obscura_world', npc: 'obscura_npc', tables: 'obscura_tables', pictures: 'obscura_pictures',
};

// NOT 'obscura'. SugarCube names its own save database after the story, so
// once the story was retitled the engine owned an IndexedDB called `obscura`
// at version 1 with stores `details` and `saves`. Opening that name at version
// 1 finds the existing database, never fires onupgradeneeded, and every
// transaction then fails with "One of the specified object stores was not
// found" - while sitting on top of the player's saves. Verified in the
// harness: indexedDB.databases() returns exactly ["obscura@1"] before we
// touch anything.
export const DB_NAME = 'obscura-worlds';

// Slot and name are concatenated into one key, so a name containing the
// separator must not be able to address another slot's record. Percent-
// encoding makes the separator unproducible from either part while keeping
// keys readable in devtools.
const enc = (part) => encodeURIComponent(String(part));
const dec = (part) => decodeURIComponent(part);

export function createStore(opts = {}) {
  const idb = opts.idb || browserIdb(opts.dbName || DB_NAME, Object.values(STORE_NAMES));
  const npcKey = (slot, name) => `${enc(slot)}/${enc(name)}`;
  const prefixOf = (slot) => `${enc(slot)}/`;

  return {
    async saveWorld(slot, world) {
      await idb.put(STORE_NAMES.world, enc(slot), world);
    },
    async loadWorld(slot) {
      return idb.get(STORE_NAMES.world, enc(slot));
    },
    async saveTable(worldId, table, value) {
      await idb.put(STORE_NAMES.tables, npcKey(worldId, table), value);
    },
    async loadTable(worldId, table) {
      return idb.get(STORE_NAMES.tables, npcKey(worldId, table));
    },
    async savePicture(key, value) {
      await idb.put(STORE_NAMES.pictures, String(key), value);
    },
    async loadPicture(key) {
      return idb.get(STORE_NAMES.pictures, String(key));
    },
    async saveNpc(slot, name, record) {
      await idb.put(STORE_NAMES.npc, npcKey(slot, name), record);
    },
    async loadNpc(slot, name) {
      return idb.get(STORE_NAMES.npc, npcKey(slot, name));
    },
    async npcNames(slot) {
      const prefix = prefixOf(slot);
      const all = await idb.keys(STORE_NAMES.npc);
      return all.filter((k) => k.startsWith(prefix)).map((k) => dec(k.slice(prefix.length)));
    },
    async deleteSlot(slot) {
      await idb.delete(STORE_NAMES.world, enc(slot));
      for (const name of await this.npcNames(slot)) {
        await idb.delete(STORE_NAMES.npc, npcKey(slot, name));
      }
    },
  };
}

// The real backend, behind the same four methods the tests inject, so the
// store's logic is provable without a browser and the browser path stays thin
// enough to read.
export function browserIdb(dbName, stores) {
  let opened = null;
  const openAt = (version) => new Promise((resolve, reject) => {
    const req = version === undefined ? indexedDB.open(dbName) : indexedDB.open(dbName, version);
    req.onupgradeneeded = () => {
      for (const store of stores) {
        if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // Opens at whatever version exists, then upgrades only if a store we need is
  // absent. Hard-coding version 1 means an existing database at version 1
  // never upgrades - which is how the name collision above turned into a
  // failure on every transaction rather than a clear error at open. It also
  // makes adding a store later a one-line change instead of a migration.
  const open = () => {
    if (opened) return opened;
    opened = (async () => {
      let db = await openAt(undefined);
      const missing = stores.filter((s) => !db.objectStoreNames.contains(s));
      if (!missing.length) return db;
      const next = db.version + 1;
      db.close();
      return openAt(next);
    })();
    return opened;
  };
  const run = async (store, mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };
  return {
    get: (store, key) => run(store, 'readonly', (os) => os.get(key)),
    put: (store, key, value) => run(store, 'readwrite', (os) => os.put(value, key)),
    delete: (store, key) => run(store, 'readwrite', (os) => os.delete(key)),
    keys: (store) => run(store, 'readonly', (os) => os.getAllKeys()),
  };
}
