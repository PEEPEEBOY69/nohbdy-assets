// world/datescreen.mjs — a date, or a night, on screen.
//
// A date met at its place (world/dates.mjs), or a night begun, runs like a
// shift: a moment at a time (world/datemoments.mjs), its words the person's
// own where the bank has written them (world/datebank.mjs) and the plain ones
// until then; a choice, what follows it, and on - until the evening ends with a
// goodnight, a no, or the morning after. The end says where the two of you
// stand, and offers what the engine now qualifies them for
// (world/relations.mjs). Time passes the way an evening does, and a night back
// at the player's ends there.
import {
  DATE_FLOW, BUILT_IN_DATE_WORDS, dateTypeById, eligibleDateMoments, pickDateMoment, choicesFor, applyDateChoice,
  fillWords, dateContext,
} from './datemoments.mjs';
import { datesOf, dateHere, meetDate, recordDate, keepDate } from './dates.mjs';
import { personWords, dateLog } from './datebank.mjs';
import { standingWith, tierOf, TIER_LABEL, CONVO_KEY } from './talk.mjs';
import { geoOf } from './geography.mjs';
import { clockAt } from './workscreen.mjs';
import { faceMarkup } from './portraits.mjs';

export const DATE_PASSAGE = 'ObscuraDate';
// Where the engine's encounter goes when it is over (its endpassage).
export const ENCOUNTER_END = 'ObscuraEncounterEnd';
export const EVENING_KEY = 'obscuraEvening';
export const STAGE_MINUTES = { start: 60, middle: 45, kiss: 15, back: 15, night: 60, after: 30, arrive: 15, undress: 15 };
// A night begun in person, where they are: from the clothes.
export const HERE_FLOW = ['undress', 'night', 'after'];

const safe = (fn, fallback) => { try { const v = fn(); return v == null ? fallback : v; } catch { return fallback; } };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Written words are shown as text, never read as markup (world/talk.mjs).
const said = (s) => `<nowiki>${String(s == null ? '' : s).replace(/<\/?nowiki>/gi, '')}</nowiki>`;
const firstOf = (setup, name) => safe(() => setup.people.firstname(name), String(name).split(' ')[0]);

const reminderFor = (setup, d) => (d.kind === 'hookup'
  ? `Tonight: ${firstOf(setup, d.with)} is coming over at ${clockAt(d.hour)}.`
  : `Tonight: a date with ${firstOf(setup, d.with)} at ${clockAt(d.hour)}, at ${d.placeName}.`);

// The hub's part: "Meet <name>" (or "Let <name> in" for a night) where and
// when one is due, and tonight's other plans as a reminder.
export function dateLinks(setup, V, place) {
  if (!V || !place) return [];
  const out = [];
  const d = dateHere(V, place.key);
  if (d) {
    const first = firstOf(setup, d.with);
    out.push({ label: d.kind === 'hookup' ? `Let ${first} in` : `Meet ${first}`, run: `setup.ob_date_meet(${JSON.stringify(d.with)})` });
  }
  const today = Number(V.gameday) || 0;
  for (const x of datesOf(V).list) {
    if (x !== d && x.state === 'set' && x.day === today) out.push({ text: reminderFor(setup, x) });
  }
  return out;
}

const contextFor = (setup, V, ev) => dateContext(setup, V, { with: ev.with }, ev.placeKind);

// The moment for the stage the evening is at; a stage with none is passed.
function pickFor(setup, V, random) {
  const ev = V[EVENING_KEY];
  while (ev.at < ev.stages.length) {
    const t = pickDateMoment(eligibleDateMoments(ev.kind, ev.stages[ev.at], contextFor(setup, V, ev)), random, ev.recent);
    if (t) {
      ev.moment = t.id;
      ev.result = null;
      ev.recent = [...ev.recent, t.id].slice(-6);
      return t;
    }
    ev.at += 1;
  }
  ev.ended = true;
  return null;
}

export function startEvening(setup, V, d, { geo = null, random = Math.random, stages = null } = {}) {
  const place = geo && geo.places && geo.places[d.place];
  V[EVENING_KEY] = {
    with: d.with, kind: d.kind, place: d.place, placeKind: (place && place.kind) || null,
    stages: stages || DATE_FLOW[d.kind] || DATE_FLOW.date, at: 0, moment: null, result: null, recent: [], ended: false, back: null, undressed: null,
  };
  pickFor(setup, V, random);
  return V[EVENING_KEY];
}

// Who the night's clothes left naked, as the engine's encounter conditions.
const NAKED = { strip: 'pc naked', them: 'partner naked', tear: 'all naked' };

// A choice in the moment on screen: once, and only one the moment offers.
export function chooseInEvening(setup, V, choiceId, { random = Math.random } = {}) {
  const ev = V[EVENING_KEY];
  if (!ev || ev.ended || !ev.moment || ev.result) return null;
  const t = dateTypeById(ev.moment);
  const ctx = contextFor(setup, V, ev);
  if (!choicesFor(t, ctx).some((c) => c.id === choiceId)) return null;
  // the night handed to the engine's own encounter: it records what happens itself
  if (t.choices.find((c) => c.id === choiceId).encounter) {
    if (typeof setup.build_encounter !== 'function') return null;
    try {
      // the engine prints intro_text once, on the round's first screen
      const config = { people: ['PC', ev.with], endpassage: ENCOUNTER_END, abortpassage: ENCOUNTER_END, aftercare: true,
        intro_text: `At last it is only you and ${firstOf(setup, ev.with)}, and all the time in the world.` };
      // the night's clothes carried in: whoever was undressed starts the round naked (the engine strips them
      // with its own remove_all_clothing, and dresses the player again after with fix_clothing)
      if (NAKED[ev.undressed]) config.conditions = [NAKED[ev.undressed]];
      setup.build_encounter(config);
      // the engine's own "partner naked" never runs (it counts partners against
      // an array), so the partner is undressed here, by the Person's own method,
      // temporarily as the engine's stripping is
      if (ev.undressed === 'them' || ev.undressed === 'tear') {
        const enc = V.encounter;
        for (const p of (enc && typeof enc.partners === 'function' ? enc.partners(true) : []) || []) {
          if (p && typeof p.remove_all_clothing === 'function') p.remove_all_clothing(true);
        }
      }
    } catch (err) { console.warn('Obscura: the encounter could not begin', err); return null; }
    ev.inEncounter = true;
    return { key: choiceId, encounter: true, ends: false };
  }
  const r = applyDateChoice(setup, V, { with: ev.with }, t, choiceId, { standing: standingWith(setup, ev.with), ctx, random });
  if (!r) return null;
  ev.result = { key: r.key, ends: r.ends };
  if (t.id === 'undress') ev.undressed = r.key;
  // where the night goes on: the player's, or theirs
  if (r.key === 'mine|pass') ev.back = 'mine';
  else if (r.key === 'theirs|pass' || (t.id === 'insist' && r.key === 'give')) ev.back = 'theirs';
  return r;
}

function finish(setup, V, geo) {
  const ev = V[EVENING_KEY];
  ev.ended = true;
  if (ev.back === 'mine') {
    const home = Object.keys((geo && geo.places) || {}).find((k) => geo.places[k].kind === 'home');
    if (home) V.location = home;
  }
}

// On from what just followed: the time it took, then the next stage's
// moment, or the end.
export function continueEvening(setup, V, { geo = null, random = Math.random } = {}) {
  const ev = V[EVENING_KEY];
  if (!ev || ev.ended || !ev.result) return false;
  try { setup.ob_time.advance_time(STAGE_MINUTES[ev.stages[ev.at]] || 30); } catch { /* the clock is not the evening's to fail */ }
  if (ev.result.ends || ev.at >= ev.stages.length - 1) { finish(setup, V, geo); return true; }
  ev.at += 1;
  if (!pickFor(setup, V, random)) finish(setup, V, geo);
  return true;
}

// A moment's words for this person: theirs where written, else the ones
// built in, their name and pronouns filled in.
function wordsFor(setup, name, typeId) {
  const own = personWords(dateLog(), name);
  const mine = own && own[typeId];
  const built = BUILT_IN_DATE_WORDS[typeId] || { setup: '', outcomes: {} };
  const who = { name: firstOf(setup, name), pronouns: safe(() => setup.people.pronouns(name), null) };
  return {
    setup: mine && mine.setup ? mine.setup : fillWords(built.setup, who),
    outcome: (key) => (mine && mine.outcomes && mine.outcomes[key]) || fillWords(built.outcomes[key] || '', who),
  };
}

// The evening on screen. No newlines: printed with <<=, each one would be a
// line break on screen.
export function eveningHtml(setup, V, { face = '' } = {}) {
  const ev = V && V[EVENING_KEY];
  if (!ev) return '<div class="ob-date"><p>The evening is over.</p><<link "Back">><<run setup.ob_date_leave()>><</link>></div>';
  const full = safe(() => setup.people.fullname(ev.with), ev.with);
  const first = firstOf(setup, ev.with);
  const out = ['<div class="ob-date">'];
  out.push(`<div class="ob-date-head">${face}<div class="ob-date-title">${ev.kind === 'hookup' ? 'A night with' : 'A date with'} ${esc(full)}</div></div>`);
  const t = ev.moment ? dateTypeById(ev.moment) : null;
  if (t) {
    const w = wordsFor(setup, ev.with, t.id);
    out.push(`<p class="ob-date-setup">${said(w.setup)}</p>`);
    if (!ev.result) {
      out.push('<div class="ob-date-choices">');
      for (const c of choicesFor(t, contextFor(setup, V, ev))) out.push(`<<link "${esc(c.label)}">><<run setup.ob_date_choose("${c.id}")>><</link>>`);
      out.push('</div>');
    } else {
      out.push(`<p class="ob-date-outcome">${said(w.outcome(ev.result.key))}</p>`);
      if (!ev.ended) out.push('<div class="ob-date-choices"><<link "Go on">><<run setup.ob_date_go_on()>><</link>></div>');
    }
  }
  if (ev.ended) {
    const s = standingWith(setup, ev.with);
    const label = s.relationship ? safe(() => setup.ob_relationships.label(s.relationship, ev.with), TIER_LABEL[tierOf(s)]) : TIER_LABEL[tierOf(s)];
    out.push(`<div class="ob-date-end"><p>The ${ev.kind === 'hookup' ? 'night' : 'evening'} with ${esc(first)} is over.</p>`
      + `<p class="ob-date-standing">${esc(first)}: ${esc(label)}.</p>`
      + `${typeof setup.ob_offers_html === 'function' ? safe(() => setup.ob_offers_html(ev.with), '') : ''}`
      + '<<link "Back">><<run setup.ob_date_leave()>><</link>></div>');
  }
  out.push('</div>');
  return out.join('');
}

// The engine side, installed at boot. deps: SugarCube, Person, geo() -> the
// world's geography (default: geoOf the save).
export function installDateScreen(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const setup = SC && SC.setup;
  if (!setup) return false;
  const V = () => SC.State.variables;
  const geo = typeof deps.geo === 'function' ? deps.geo : () => geoOf(V(), setup);
  const random = () => (SC.State && typeof SC.State.random === 'function' ? SC.State.random() : Math.random());
  const PersonClass = deps.Person !== undefined ? deps.Person : (typeof window !== 'undefined' ? window.Person : null);
  const play = (p) => { SC.Engine.play(p); return true; };

  // from the hub, where and when a date is due
  setup.ob_date_meet = (name) => {
    const v = V();
    const d = dateHere(v, v.location);
    if (!d || (name && d.with !== name)) return false;
    meetDate(setup, v, d);
    const ev = startEvening(setup, v, d, { geo: geo(), random });
    // counted as the engine counts one, as it begins: its willing_sex reads the dates had
    recordDate(setup, v, d, ev.moment);
    return play(DATE_PASSAGE);
  };

  // a yes to a proposition in person (world/talk.mjs): a night, here, now
  setup.ob_hookup_begin = (name) => {
    const v = V();
    if (!v.people || !v.people[name]) return false;
    const g = geo();
    const place = g && g.places && g.places[v.location];
    const d = keepDate(v, {
      with: name, kind: 'hookup', day: Number(v.gameday) || 0, hour: Number(v.hour) || 0, place: v.location,
      placeName: place ? place.name : 'here', state: 'met', set: Number(v.gameday) || 0,
    });
    recordDate(setup, v, d);
    delete v[CONVO_KEY];
    startEvening(setup, v, d, { geo: g, random, stages: HERE_FLOW });
    return play(DATE_PASSAGE);
  };

  setup.ob_date_screen = () => {
    const ev = V()[EVENING_KEY];
    return eveningHtml(setup, V(), { face: ev ? safe(() => faceMarkup(SC, ev.with, { Person: PersonClass }), '') : '' });
  };

  setup.ob_date_choose = (id) => {
    const r = chooseInEvening(setup, V(), id, { random });
    if (!r) return false;
    return play(r.encounter ? 'EncounterRound' : DATE_PASSAGE);
  };

  // the engine's encounter is over (and its aftercare): the evening goes on
  // from the night it was, or, if it was no evening's, the hub
  setup.ob_encounter_end = () => {
    const ev = V()[EVENING_KEY];
    if (!ev || !ev.inEncounter) return 'ObscuraHub';
    ev.inEncounter = false;
    ev.result = { key: 'encounter', ends: false };
    return DATE_PASSAGE;
  };
  setup.ob_date_go_on = () => (continueEvening(setup, V(), { geo: geo(), random }) ? play(DATE_PASSAGE) : false);
  setup.ob_date_leave = () => {
    delete V()[EVENING_KEY];
    return play('ObscuraHub');
  };
  return true;
}
