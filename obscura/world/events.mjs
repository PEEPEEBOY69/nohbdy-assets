// world/events.mjs — the event table, made safe, then made ours.
//
// `setup.ob_events.db` holds 1,769 event records, each naming the passage to
// play. The chassis extraction deliberately keeps only STRUCTURAL passages, so
// COT's authored scenes are not shipped - and 1,630 of those records point at
// passages that do not exist. Every one is a crash waiting for the moment the
// engine picks it.
//
// Nothing reported this. The round-trip walked to QuickstartMenu and stopped,
// which is exactly where the shipped content ends, so the dangling half was
// never reached.
//
// Two things happen here. The dangling records are removed, which makes the
// existing event machinery safe to run. And a pool of shipped slot passages
// lets the world author its OWN events into the same machinery, which is the
// only way Obscura can have events at all.

export const EVENT_SLOTS = 12;
export const SLOT_PREFIX = 'ObscuraEvent';
export const STATE_KEY = 'obscuraEvents';

export function slotNames(count = EVENT_SLOTS) {
  return Array.from({ length: count }, (_, i) => `${SLOT_PREFIX}${i + 1}`);
}

// Removes records whose passage is not in the story. Returns what it did, so
// the caller can report rather than guess.
export function pruneDanglingEvents(setup, hasPassage) {
  const ev = setup && setup.ob_events;
  if (!ev || !Array.isArray(ev.db)) return { before: 0, after: 0, removed: 0 };
  const before = ev.db.length;
  ev.db = ev.db.filter(e => {
    if (!e || typeof e !== 'object') return false;
    if (typeof e.passage !== 'string' || !e.passage) return false;
    return hasPassage(e.passage);
  });
  return { before, after: ev.db.length, removed: before - ev.db.length };
}

// A free slot is one no authored event is using yet.
export function freeSlot(store, count = EVENT_SLOTS) {
  for (const name of slotNames(count)) {
    if (!store || !store[name]) return name;
  }
  return null;
}

// Registers an authored event: the text goes in state, and a record pointing
// at that slot's passage goes in the chassis's own table, so the existing
// picker surfaces it with no changes to the picker.
//
// `tags` and `frequency` are COPIED from a real record rather than invented -
// the same clone-the-shape rule the rest of the project runs on. A tag set the
// engine never queries is an event that can never fire.
export function registerAuthoredEvent(setup, state, event, opts = {}) {
  const ev = setup && setup.ob_events;
  if (!ev || !Array.isArray(ev.db)) return { error: 'no event table' };
  if (!state || typeof state !== 'object') return { error: 'no state' };

  const text = String(event && event.text || '').trim();
  if (!text) return { error: 'no text' };

  const store = state[STATE_KEY] || (state[STATE_KEY] = {});
  const slot = freeSlot(store, opts.slots ?? EVENT_SLOTS);
  if (!slot) return { error: 'every event slot is in use' };

  // Copy the shape of an existing record so the tags are ones the engine
  // actually queries. With none to copy, the event cannot be placed.
  const model = ev.db.find(e => e && Array.isArray(e.tags) && e.tags.length);
  if (!model) return { error: 'no existing event to take tags from' };

  store[slot] = { title: String(event.title || '').trim() || null, text };
  ev.db.push({
    passage: slot,
    tags: [...model.tags],
    frequency: typeof model.frequency === 'number' ? model.frequency : 10,
    obscuraAuthored: true,
  });
  return { slot, tags: [...model.tags], error: null };
}

// A reload rebuilds `setup` from the chassis: the records registered above are
// gone while their text is still in the save. This puts one record back for
// every slot the save uses, with its tags copied exactly as registration does.
// Idempotent - a slot that already has a record is left alone.
export function restoreAuthoredEvents(setup, state) {
  const ev = setup && setup.ob_events;
  const store = state && state[STATE_KEY];
  if (!ev || !Array.isArray(ev.db) || !store || typeof store !== 'object') return 0;
  const model = ev.db.find(e => e && Array.isArray(e.tags) && e.tags.length && !e.obscuraAuthored);
  if (!model) return 0;
  let added = 0;
  for (const slot of slotNames()) {
    if (!store[slot]) continue;
    if (ev.db.some(e => e && e.passage === slot)) continue;
    ev.db.push({
      passage: slot,
      tags: [...model.tags],
      frequency: typeof model.frequency === 'number' ? model.frequency : 10,
      obscuraAuthored: true,
    });
    added += 1;
  }
  return added;
}

export function authoredEventText(state, slot) {
  const store = state && state[STATE_KEY];
  const entry = store && store[slot];
  if (!entry) return '';
  return entry.title ? `<b>${escapeHtml(entry.title)}</b><br><br>${escapeHtml(entry.text)}`
    : escapeHtml(entry.text);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Installed at boot. Pruning must happen before anything can pick an event,
// and it is idempotent, so running it again after a restore costs nothing.
export function installEvents(deps = {}) {
  const setup = deps.setup
    || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.setup);
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  if (!setup || !SC) return null;

  const has = deps.hasPassage
    || ((name) => { try { return !!(SC.Story && SC.Story.has && SC.Story.has(name)); } catch { return false; } });

  const pruned = pruneDanglingEvents(setup, has);

  setup.ob_obscura_event_text = (slot) => {
    const state = (deps.state || SC.State).variables;
    return authoredEventText(state, slot);
  };

  return pruned;
}
