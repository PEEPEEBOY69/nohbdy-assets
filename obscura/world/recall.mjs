// world/recall.mjs — people remember what happened between you.
//
// The engine keeps how each person feels about the player as numbers -
// friendship, lust, romance, trust, anger - and nothing about why or when.
// This keeps that: every change the engine makes through its own
// alter_attitude, measured after the engine's own modifiers, with the day and
// the place, one memory per scene and feeling (world/memory.mjs is the record
// and its compaction). It is shown where the person is - their profile, the
// phone, the hub when they are there - and kept small, because it rides in a
// save that SugarCube copies into its history.
import { newMemory, remember, compact } from './memory.mjs';

export const MEMORY_KEY = 'obscuraMemory';
// memories per person, and people remembered at all
export const RECALL_KEEP = 16;
export const RECALL_PEOPLE = 150;

const WORDS = {
  friendship: ['warmed to you', 'cooled toward you'],
  romance: ['fell further for you', 'felt the romance fade'],
  lust: ['wanted you more', 'wanted you less'],
  trust: ['trusted you more', 'trusted you less'],
  anger: ['got angry with you', 'let some of the anger go'],
  suspicion: ['grew suspicious of you', 'suspected you less'],
  control: ['felt more in control with you', 'felt less in control with you'],
  favor: ['owes you one', 'called in a favor'],
};

export function describeShift(type, delta) {
  const w = WORDS[type];
  if (!w) return 'felt differently about you';
  const verb = delta > 0 ? w[0] : w[1];
  if (type === 'favor') return verb;
  const size = Math.abs(delta);
  if (size >= 100) return `${verb}, a great deal`;
  if (size < 20) return `${verb}, a little`;
  return verb;
}

const round1 = (n) => Math.round(n * 10) / 10;
// 100 points - the size of a milestone - is formative, and survives compaction
const weightOf = (delta) => Math.min(10, Math.round(Math.abs(delta) / 20));

const store = (V) => {
  if (!V[MEMORY_KEY] || typeof V[MEMORY_KEY] !== 'object') V[MEMORY_KEY] = {};
  return V[MEMORY_KEY];
};

const lastSeen = (mem) => {
  const e = mem && mem.events && mem.events[mem.events.length - 1];
  return e ? [e.day ?? -1, e.turn ?? -1] : [-1, -1];
};

// Past RECALL_PEOPLE, the people whose last memory is oldest are let go.
function forgetTheLeastRecent(all) {
  const names = Object.keys(all);
  if (names.length <= RECALL_PEOPLE) return;
  names.sort((a, b) => {
    const [da, ta] = lastSeen(all[a]); const [db, tb] = lastSeen(all[b]);
    return (da - db) || (ta - tb);
  });
  for (const n of names.slice(0, names.length - RECALL_PEOPLE)) delete all[n];
}

export function recordShift(V, name, type, delta, ctx = {}) {
  if (!V || typeof name !== 'string' || !name || !Number.isFinite(delta) || Math.abs(delta) < 0.05) return null;
  const all = store(V);
  const day = Number.isFinite(ctx.day) ? ctx.day : null;
  const place = ctx.place ? String(ctx.place).slice(0, 60) : '';
  const turn = ctx.turn ?? null;
  const mem = all[name] && Array.isArray(all[name].events) ? all[name] : newMemory(name);

  // the same feeling, changed again in the same scene, is the same memory
  if (turn !== null) {
    for (let i = mem.events.length - 1; i >= 0 && mem.events[i].turn === turn; i--) {
      const e = mem.events[i];
      if (e.type !== type) continue;
      e.delta = round1(e.delta + delta);
      e.weight = weightOf(e.delta);
      if (Math.abs(e.delta) < 0.05) mem.events.splice(i, 1);
      all[name] = mem;
      return e;
    }
  }
  const event = { day, place, type, delta: round1(delta), turn, weight: weightOf(delta) };
  all[name] = compact(remember(mem, event), { keepRecent: RECALL_KEEP });
  forgetTheLeastRecent(all);
  return event;
}

export function memoryOf(V, name) {
  const mem = V && V[MEMORY_KEY] && V[MEMORY_KEY][name];
  return mem && Array.isArray(mem.events) ? mem.events : [];
}

const lineOf = (e) => {
  const where = [e.day != null ? `Day ${e.day}` : null, e.place || null].filter(Boolean).join(', ');
  return `${where || 'Once'}: ${describeShift(e.type, e.delta)}`;
};

// newest first
export function memoryLines(V, name, max = RECALL_KEEP) {
  return memoryOf(V, name).slice(-max).reverse().map(lineOf);
}

export function latestLine(V, name) {
  return memoryLines(V, name, 1)[0] || null;
}

// For the hub: up to two people here who remember something of you. Only
// people you know - a stranger's memory is not yours to read.
export function recallHere(V, names, shortName = (n) => n, max = 2) {
  const known = (n) => !(V && V.people) || !!(V.people[n] && V.people[n].known);
  const out = [];
  for (const n of names || []) {
    if (out.length >= max) break;
    const line = latestLine(V, n);
    if (!line || !known(n)) continue;
    out.push(`${shortName(n)} remembers: ${line.charAt(0).toLowerCase()}${line.slice(1)}.`);
  }
  return out;
}

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Added to the engine's own profile: who someone brought in is, in the words
// they came with (world/cast.mjs), and what they remember.
export function profileSections(V, name) {
  if (!V || !name) return '';
  const parts = [];
  const brought = V.obscuraCast && V.obscuraCast[name];
  if (brought && brought.profile) {
    parts.push(`<div class="ob-recall"><div class="ob-recall-title">Who they are</div><p class="ob-recall-profile">${esc(brought.profile)}</p></div>`);
  }
  const lines = memoryLines(V, name, 8);
  if (lines.length) {
    parts.push(`<div class="ob-recall"><div class="ob-recall-title">What they remember</div><ul class="ob-recall-list">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`);
  }
  return parts.join('');
}

const WRAPPED = '__obscuraRecall';
let profileHooked = false;

const feelingOf = (V, key, type) => {
  const p = V && V.people && V.people[key];
  const a = p && p.attitude;
  return a && Number.isFinite(a[type]) ? a[type] : 0;
};

export function installRecall(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const people = SC && SC.setup && SC.setup.people;
  if (!people || typeof people.alter_attitude !== 'function') return false;

  const inCharacterCreation = () => {
    try { return (SC.Story.get(SC.State.passage).tags || []).includes('chargen'); } catch { return false; }
  };
  const placeName = (V) => {
    try { return SC.setup.ob_get_location_name(V.location) || ''; } catch { return ''; }
  };

  if (!people.alter_attitude[WRAPPED]) {
    const original = people.alter_attitude;
    const wrapped = function (name, type, value, updateinteraction = true) {
      const V = SC.State.variables;
      let key = name;
      try { key = typeof people.get_name === 'function' ? people.get_name(name) : name; } catch { /* the raw name */ }
      const before = feelingOf(V, key, type);
      const result = original.apply(this, arguments);
      // decay passes updateinteraction=false: time passing is not a memory
      if (updateinteraction !== false && !inCharacterCreation()) {
        try {
          recordShift(V, key, type, feelingOf(V, key, type) - before,
            { day: V.gameday, place: placeName(V), turn: SC.State.turns });
        } catch (err) { console.warn('Obscura: a memory could not be kept', err); }
      }
      return result;
    };
    wrapped[WRAPPED] = true;
    people.alter_attitude = wrapped;
  }

  const $ = deps.jQuery !== undefined ? deps.jQuery : (typeof window !== 'undefined' ? window.jQuery : null);
  const doc = deps.document !== undefined ? deps.document : (typeof document !== 'undefined' ? document : null);
  if (!profileHooked && $ && doc) {
    $(doc).on(':dialogopened', () => {
      const body = doc.getElementById('ui-dialog-body');
      if (!body || !body.classList.contains('view-person') || body.querySelector('.ob-recall')) return;
      const V = SC.State.variables;
      const who = V.npctodisplay;
      const key = typeof who === 'string' ? who : (who && (who.person || who.name));
      const html = profileSections(V, key);
      if (html) body.insertAdjacentHTML('beforeend', html);
    });
    profileHooked = true;
  }
  return true;
}
