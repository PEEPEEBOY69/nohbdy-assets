// world/dates.mjs — dates, set, met or stood up.
//
// The engine keeps a romance's whole shape - dates counted in its hangout
// memory, the milestones that read them (a first date, a third), the
// relationships they qualify someone for - but its date scenes never shipped,
// so nobody could be taken out. A yes to "Ask them out", in person or by text,
// sets a date here: tonight at seven while it is not yet seven, else
// tomorrow's, somewhere the world's people go out. A yes to a night by text is
// the player's home at nine. The hub offers "Meet <name>" there from an hour
// before to two after (world/datescreen.mjs runs it); a date not met by then is
// a date stood up, and they feel it through the engine. A date met is counted
// the way the engine counts one, with its own register_hangout.
import { geoOf } from './geography.mjs';
import { clockAt } from './workscreen.mjs';

export const DATES_KEY = 'obscuraDates';
export const DATE_HOUR = 19;
export const HOOKUP_HOUR = 21;
// A date can be met from an hour before its time to two after.
export const EARLY = 1;
export const LATE = 2;
export const KEEP_DATES = 20;
// Where the world's people go out.
export const OUT_KINDS = ['food', 'entertainment', 'outdoors', 'gathering'];
const HUB = 'ObscuraHub';

const safe = (fn, fallback) => { try { const v = fn(); return v == null ? fallback : v; } catch { return fallback; } };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function datesOf(V) {
  const d = V[DATES_KEY];
  if (!d || typeof d !== 'object' || !Array.isArray(d.list)) V[DATES_KEY] = { list: [] };
  return V[DATES_KEY];
}

// The date set with someone and not yet met or missed.
export const dateWith = (V, name) => datesOf(V).list.find((d) => d.with === name && d.state === 'set') || null;

const placesOf = (geo) => Object.entries((geo && geo.places) || {});
export const datePlaces = (geo) => placesOf(geo).filter(([, p]) => p && OUT_KINDS.includes(p.kind)).map(([key, p]) => ({ key, name: p.name }));
const homeOf = (geo) => {
  const hit = placesOf(geo).find(([, p]) => p && p.kind === 'home');
  return hit ? { key: hit[0], name: hit[1].name } : null;
};

const firstOf = (setup, name) => safe(() => setup.people.firstname(name), name);

export function noteFor(setup, V, d) {
  const when = d.day === (Number(V.gameday) || 0) ? 'tonight' : 'tomorrow night';
  if (d.kind === 'hookup') return `${firstOf(setup, d.with)} is coming over ${when} at ${clockAt(d.hour)}.`;
  return `A date with ${firstOf(setup, d.with)}, ${when} at ${clockAt(d.hour)}, at ${d.placeName}.`;
}

// A date with someone ('date') or a night ('hookup'): one at a time with each
// person; asked again, the one already set.
export function setDate(setup, V, name, kind = 'date', { geo = null, random = Math.random } = {}) {
  if (!V || !V.people || !V.people[name]) return null;
  const existing = dateWith(V, name);
  if (existing) return existing;
  let place = null;
  if (kind === 'hookup') place = homeOf(geo);
  else {
    const out = datePlaces(geo);
    place = out.length ? out[Math.min(out.length - 1, Math.floor(random() * out.length))] : homeOf(geo);
  }
  const hour = kind === 'hookup' ? HOOKUP_HOUR : DATE_HOUR;
  const today = Number(V.gameday) || 0;
  const d = {
    with: name, kind: kind === 'hookup' ? 'hookup' : 'date', day: (Number(V.hour) || 0) < hour ? today : today + 1, hour,
    place: place ? place.key : null, placeName: place ? place.name : 'your place', state: 'set', set: today,
  };
  d.note = noteFor(setup, V, d);
  return keepDate(V, d);
}

// Kept in the list; the dates met and missed long ago go first, one still set
// is kept.
export function keepDate(V, d) {
  const list = datesOf(V).list;
  list.push(d);
  while (list.length > KEEP_DATES) {
    const i = list.findIndex((x) => x.state !== 'set');
    list.splice(i >= 0 ? i : 0, 1);
  }
  return d;
}

export function dateDue(V, d) {
  const hour = Number(V.hour) || 0;
  return !!d && d.state === 'set' && (Number(V.gameday) || 0) === d.day && hour >= d.hour - EARLY && hour <= d.hour + LATE;
}

// The date due now at this place, for the hub's "Meet <name>".
export const dateHere = (V, placeKey) => datesOf(V).list.find((d) => d.place === placeKey && dateDue(V, d)) || null;

const overdue = (V, d) => {
  const day = Number(V.gameday) || 0;
  return d.state === 'set' && (day > d.day || (day === d.day && (Number(V.hour) || 0) > d.hour + LATE));
};

const STOOD = { date: [['romance', -30], ['friendship', -10]], hookup: [['lust', -20], ['friendship', -10]] };

// Every date whose time has gone by unmet is over, and they feel it through
// the engine's own alter_attitude (so it is remembered, world/recall.mjs).
export function standUps(setup, V) {
  const stood = datesOf(V).list.filter((d) => overdue(V, d));
  for (const d of stood) {
    d.state = 'stood';
    for (const [type, amount] of STOOD[d.kind] || STOOD.date) {
      try { setup.people.alter_attitude(d.with, type, amount); } catch (err) { console.warn('Obscura: a feeling could not change', err); }
    }
  }
  return stood;
}

export function meetDate(setup, V, d) {
  if (d && d.state === 'set') d.state = 'met';
  return d;
}

// A date met, as the engine counts one: its register_hangout, a date as a
// date and a night as its booty call, so its milestones ("first date", "third
// date") read it. An engine without it gets the same memory in its shape.
export function recordDate(setup, V, d, activity = null) {
  if (!d) return;
  const type = d.kind === 'hookup' ? 'bootycall' : 'date';
  const P = setup && setup.people;
  if (P && typeof P.register_hangout === 'function') {
    try { P.register_hangout(d.with, type, activity); return; } catch (err) { console.warn('Obscura: the date could not be counted', err); }
  }
  const mem = V.hangoutmemory || (V.hangoutmemory = {});
  const m = mem[d.with] || (mem[d.with] = {});
  m[type] = (m[type] || 0) + 1;
  if (activity) {
    const acts = m.activities || (m.activities = {});
    const t = acts[type] || (acts[type] = {});
    t[activity] = (t[activity] || 0) + 1;
  }
  (m.last || (m.last = {}))[type] = Number(V.gameday) || 0;
}

const STOOD_NOTICE = {
  date: (first) => `You never met ${first}. They waited, and then they stopped waiting.`,
  hookup: (first) => `${first} came over tonight, and you were not home.`,
};

const hookedWith = new WeakSet();

// The engine side, installed at boot. deps: SugarCube, jQuery, document,
// geo() -> the world's geography (default: geoOf the save).
export function installDates(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const setup = SC && SC.setup;
  if (!setup) return false;
  const V = () => SC.State.variables;
  const geo = typeof deps.geo === 'function' ? deps.geo : () => geoOf(V(), setup);
  const random = () => (SC.State && typeof SC.State.random === 'function' ? SC.State.random() : Math.random());

  setup.ob_date_set = (name, kind = 'date') => setDate(setup, V(), name, kind, { geo: geo(), random });
  setup.ob_date_with = (name) => dateWith(V(), name);

  // the hub: a date missed is over, and the engine's own notification says so
  const $ = deps.jQuery !== undefined ? deps.jQuery : (typeof window !== 'undefined' ? window.jQuery : null);
  const doc = deps.document !== undefined ? deps.document : (typeof document !== 'undefined' ? document : null);
  if ($ && doc && !hookedWith.has($)) {
    $(doc).on(':passagestart', (ev) => {
      if (!ev || !ev.passage || ev.passage.title !== HUB) return;
      const v = V();
      if (!v || !v.people) return;
      for (const d of standUps(setup, v)) {
        const say = STOOD_NOTICE[d.kind] || STOOD_NOTICE.date;
        try { setup.add_notification(`<span class="ob-date-notice">${esc(say(firstOf(setup, d.with)))}</span>`); } catch { /* told or not, it is over */ }
      }
    });
    hookedWith.add($);
  }
  return true;
}
