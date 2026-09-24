// world/talk.mjs — people you can talk to.
//
// The profile's "Talk to" has always pointed at InPersonDialogue, and the hub
// named who was here as plain text: that passage never shipped, so nobody in
// Obscura could be spoken to. This is its logic. A conversation is picks from
// the bank (world/talkbank.mjs): instant, in the world's words, by how you
// stand with them, with their own lines first once the model has written
// them. Each thing you do takes ten minutes and changes how they feel through
// the engine's own alter_attitude - so it is remembered (world/recall.mjs) -
// and is counted in the engine's own $interactionstoday.
import {
  ACTIONS, BUILT_IN, TALK_TAG, ANYONE, personTag, splitPair, emptyTalkLog, readTalkLog, recordsFromLog,
  writeWorldBank, writeOwnLines, missingWorldCells, hasOwnLines, describePerson, worldCells,
} from './talkbank.mjs';
import { memoryLines, SCENE_KEY } from './recall.mjs';
import { faceMarkup, personNoun } from './portraits.mjs';
import { substituteWith } from './lexicon.mjs';

export const TALK_PASSAGE = 'InPersonDialogue';
export const TALK_MINUTES = 10;
export const SHOWN_EXCHANGES = 4;

// How you stand with someone, from the engine's own numbers: a relationship
// first (partner, rival, best friend...), then the attitudes.
export function tierOf(s = {}) {
  const friendship = s.friendship || 0;
  if (s.relationshipType === 'romantic' || (s.romance || 0) >= 500) return 'romantic';
  if (s.relationshipType === 'enemy' || friendship <= -150) return 'rival';
  if (s.relationship === 'best friend' || friendship >= 600) return 'close';
  if (s.relationshipType === 'friendship' || friendship >= 250) return 'friend';
  return s.known ? 'acquaintance' : 'stranger';
}

export const TIER_LABEL = {
  stranger: 'a stranger', acquaintance: 'someone you know', friend: 'a friend',
  close: 'a close friend', romantic: 'more than a friend', rival: 'no friend of yours',
};

export function outcomeOf(action, s = {}) {
  if (action === 'flirt') return s.attracted && (s.friendship || 0) >= 0 ? 'good' : 'bad';
  if (action === 'tease') return (s.friendship || 0) >= 150 ? 'good' : 'bad';
  return 'good';
}

const EFFECTS = {
  chat: { good: [['friendship', 10]] },
  ask: { good: [['friendship', 8], ['trust', 5]] },
  compliment: { good: [['friendship', 12]] },
  flirt: { good: [['lust', 15], ['romance', 8]], bad: [['friendship', -10]] },
  tease: { good: [['friendship', 10]], bad: [['friendship', -8]] },
  goodbye: { good: [] },
};

// After the first exchange of the day with someone, what they gain from it is
// halved: a friendship is not made by clicking. What goes badly always costs
// the full amount.
export function effectsOf(action, outcome, { attracted = false, repeat = false } = {}) {
  const base = [...((EFFECTS[action] && EFFECTS[action][outcome]) || [])];
  if (action === 'compliment' && attracted) base.push(['romance', 5]);
  return base.map(([type, n]) => [type, repeat && n > 0 ? n / 2 : n]);
}

// Their own lines for this footing, then the world's, then the world's at any
// footing, then the lines built in. Not the lines just said, while there are
// others.
export function pickLine({ records = [], action, tier, outcome, person, avoid = [], random = Math.random }) {
  const base = [TALK_TAG, `talk ${action}`, `outcome ${outcome}`];
  const levels = [
    ['own', [...base, `tier ${tier}`, personTag(person)]],
    ['world', [...base, `tier ${tier}`, ANYONE]],
    ['world', [...base, ANYONE]],
  ];
  const choose = (pool, source) => {
    const fresh = pool.filter((p) => !avoid.includes(p));
    const use = fresh.length ? fresh : pool;
    const raw = use[Math.min(use.length - 1, Math.floor(random() * use.length))];
    return { ...splitPair(raw), raw, source };
  };
  for (const [source, tags] of levels) {
    const pool = records.filter((r) => tags.every((t) => r.tags.includes(t))).flatMap((r) => r.content);
    if (pool.length) return choose(pool, source);
  }
  return choose(BUILT_IN[`${action}|${outcome}`] || BUILT_IN[`${action}|good`] || BUILT_IN['chat|good'], 'built-in');
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// What people say is shown as text, never read as markup: the engine's
// verbatim span, which a line cannot close early.
const said = (s) => `<nowiki>${String(s == null ? '' : s).replace(/<\/?nowiki>/gi, '')}</nowiki>`;

export const ACTION_LABELS = {
  chat: 'Chat', ask: 'Ask about them', compliment: 'Pay them a compliment',
  flirt: 'Flirt', tease: 'Tease them', goodbye: 'Say goodbye',
};

export function talkScreenHtml({ name, first, label, face = '', lines = [], ended = false, place = 'where you were' }) {
  const out = ['<div class="ob-talk">'];
  out.push(`<div class="ob-talk-head">${face}<div class="ob-talk-who"><div class="ob-talk-name">${esc(name)}</div>`
    + `<div class="ob-talk-rel">${esc(label)}</div></div></div>`);
  out.push('<div class="ob-talk-lines">');
  if (!lines.length) out.push(`<p class="ob-talk-quiet">${esc(first)} looks up as you come over.</p>`);
  for (const l of lines) {
    out.push(`<p class="ob-talk-you"><span class="ob-talk-speaker">You</span> ${said(l.you)}</p>`);
    out.push(`<p class="ob-talk-them"><span class="ob-talk-speaker">${esc(first)}</span> ${said(l.them)}</p>`);
  }
  out.push('</div><div class="ob-talk-actions">');
  if (ended) out.push(`<<link "Back to ${esc(place)}">><<run setup.ob_talk_leave()>><</link>>`);
  else for (const a of ACTIONS) out.push(`<<link "${ACTION_LABELS[a]}">><<run setup.ob_talk_act("${a}")>><</link>>`);
  out.push('</div></div>');
  // no newlines: printed with <<=, each one would be a line break on screen
  return out.join('');
}

export const TALK_LOG = '__talk';
export const CONVO_KEY = 'obscuraConvo';

// The page's bank: the log for the world in play, and the records made from
// it. One world per page (world/durable.mjs reloads to switch), so one bank.
const state = { worldId: null, log: emptyTalkLog(), records: [], queue: [], busy: false, tried: new Map() };

function useLog(worldId, log) {
  state.worldId = worldId;
  state.log = log;
  state.records = recordsFromLog(log);
  state.queue = [];
  state.tried = new Map();
}

// A new world: an empty bank, the lines built in until the model's land.
export function startTalkWorld(worldId) { useLog(worldId, emptyTalkLog()); return state.log; }

export const talkRecords = () => state.records;

export function talkStatus() {
  const people = {};
  for (const [name, own] of Object.entries(state.log.people)) people[name] = [...own.tiers];
  return { worldId: state.worldId, world: Object.keys(state.log.world).length, cells: worldCells().length,
    people, queued: state.queue.length, busy: state.busy };
}

const saveTo = (store, worldId) => (log) => (store && worldId ? store.saveTable(worldId, TALK_LOG, log) : Promise.resolve());

// The world's bank, written in the background (world/flow.mjs asks after the
// school's names). The records follow every batch.
export function writeTheWorldBank({ model, persona, store, worldId, faultsIn }) {
  if (state.worldId !== worldId) startTalkWorld(worldId);
  const log = state.log;
  return writeWorldBank({
    model, persona, log, faultsIn, save: saveTo(store, worldId),
    onBatch: () => { if (state.log === log) state.records = recordsFromLog(log); },
  });
}

// A page load: the lines written for this world come back from the store, and
// a bank the page left half-written is finished. With no model, what was
// written is still there.
export async function restoreTalk({ store, worldId, model, persona, faultsIn }) {
  if (!worldId) return null;
  let raw = null;
  try { raw = store ? await store.loadTable(worldId, TALK_LOG) : null; } catch { raw = null; }
  useLog(worldId, readTalkLog(raw));
  if (model && (typeof model.available !== 'function' || model.available()) && missingWorldCells(state.log).length) {
    await writeTheWorldBank({ model, persona, store, worldId, faultsIn });
  }
  return talkStatus();
}

const safe = (fn, fallback) => { try { const v = fn(); return v == null ? fallback : v; } catch { return fallback; } };

// How you stand with someone, read off the engine.
export function standingWith(setup, name) {
  const P = setup.people;
  const attitude = (t) => Number(safe(() => P.get_attitude(name, t), 0)) || 0;
  const relationship = safe(() => setup.ob_relationships.relationship_with(name), null) || null;
  return {
    known: !!safe(() => P.is_known(name), false),
    friendship: attitude('friendship'),
    romance: attitude('romance'),
    attracted: !!safe(() => P.attracted_to_pc(name), false),
    relationship,
    relationshipType: relationship ? safe(() => setup.ob_relationships.relationship_type_with(name), null) : null,
  };
}

// Who someone is, for their own lines: the engine's words for them in this
// world's words, what someone brought in said of themselves, what they
// remember of the player.
export function whoTheyAre(SC, name, tier, PersonClass) {
  const setup = SC.setup; const V = SC.State.variables; const P = setup.people;
  const words = (s) => substituteWith(String(s), V.obscuraLexicon);
  const person = typeof PersonClass === 'function' ? safe(() => new PersonClass({ person: name }), null) : null;
  const pdata = safe(() => P.get_person(name), {}) || {};
  const sub = safe(() => P.subarchetype(name), '');
  const brought = V.obscuraCast && V.obscuraCast[name];
  return {
    tier,
    description: describePerson({
      noun: personNoun(safe(() => person.age_descriptor(), ''), safe(() => P.pronouns(name).gender, '')),
      archetype: pdata.archetype ? words(pdata.archetype) : '',
      subarchetype: sub && sub !== 'none' ? words(sub) : '',
      inclinations: (safe(() => P.inclinations(name), []) || []).map(words),
    }),
    profile: brought && brought.profile ? String(brought.profile).slice(0, 600) : '',
    memories: memoryLines(V, name, 5),
  };
}

// Their own lines, one call at a time, each person and footing asked for at
// most twice a session.
function queueOwnLines(ctx, name, tier) {
  const key = `${name}|${tier}`;
  const model = ctx.model();
  if (!model || (typeof model.available === 'function' && !model.available())) return false;
  if (hasOwnLines(state.log, name, tier) || state.queue.some((q) => q.key === key) || (state.tried.get(key) || 0) >= 2) return false;
  state.queue.push({ key, name, tier, worldId: state.worldId, ctx });
  pumpOwnLines();
  return true;
}

async function pumpOwnLines() {
  if (state.busy) return;
  state.busy = true;
  try {
    while (state.queue.length) {
      const job = state.queue.shift();
      if (job.worldId !== state.worldId) continue;
      state.tried.set(job.key, (state.tried.get(job.key) || 0) + 1);
      const log = state.log;
      await writeOwnLines({
        model: job.ctx.model(), persona: job.ctx.persona, name: job.name, log, faultsIn: job.ctx.faultsIn,
        who: job.ctx.who(job.name, job.tier), save: saveTo(job.ctx.store(), job.worldId),
      });
      if (state.log === log) state.records = recordsFromLog(log);
    }
  } catch (err) {
    console.warn('Obscura: someone\'s own lines could not be written', err);
  } finally {
    state.busy = false;
  }
}

const WRAPPED = '__obscuraTalk';

// The engine side, installed at boot. deps: SugarCube, jQuery, document,
// Person, model() -> the shared text model or null, store() -> the store,
// persona() -> the world's persona, faultsIn.
export function installTalk(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const setup = SC && SC.setup;
  if (!setup || !setup.people) return false;
  const people = setup.people;
  const V = () => SC.State.variables;
  const PersonClass = deps.Person !== undefined ? deps.Person : (typeof window !== 'undefined' ? window.Person : null);
  const has = (n) => safe(() => !!SC.Story.has(n), false);
  const ctx = {
    model: deps.model || (() => null),
    store: deps.store || (() => null),
    persona: deps.persona || (() => ''),
    faultsIn: deps.faultsIn,
    who: (name, tier) => whoTheyAre(SC, name, tier, PersonClass),
  };

  // "Text" is offered only where there is a passage to text in: until
  // PhoneText ships, no number is usable, and the profile never links into
  // nothing.
  if (typeof people.has_number === 'function' && !people.has_number[WRAPPED]) {
    const original = people.has_number;
    const wrapped = function (...args) { return has('PhoneText') ? original.apply(this, args) : false; };
    wrapped[WRAPPED] = true;
    people.has_number = wrapped;
  }

  const valid = (name) => typeof name === 'string' && !!(V().people && V().people[name]);
  const begin = (v, name) => {
    v[CONVO_KEY] = { with: name, lines: [], ended: false };
    v[SCENE_KEY] = `talk ${name} ${SC.State.turns}`;
    return v[CONVO_KEY];
  };
  const convoFor = (v, name) => {
    const c = v[CONVO_KEY];
    return c && c.with === name && !c.ended ? c : null;
  };
  const place = (v) => safe(() => setup.ob_get_location_name(v.location), '') || 'where you were';
  const random = () => (SC.State && typeof SC.State.random === 'function' ? SC.State.random() : Math.random());

  // From the hub: the i-th person in the engine's own $peopleatlocation.
  setup.ob_talk_open = (i) => {
    const v = V();
    const list = Array.isArray(v.peopleatlocation) ? v.peopleatlocation : [];
    const entry = typeof i === 'number' ? list[i] : i;
    const name = typeof entry === 'string' ? entry : entry && (entry.person || entry.name);
    if (!valid(name)) return false;
    v.eventnpc = name;
    begin(v, name);
    SC.Engine.play(TALK_PASSAGE);
    return true;
  };

  setup.ob_talk_screen = () => {
    const v = V();
    const name = safe(() => people.get_name(v.eventnpc), v.eventnpc);
    if (!valid(name)) return '<p>There is nobody here to talk to.</p><<link "Back">><<run setup.ob_talk_leave()>><</link>>';
    // the profile's own "Talk to" arrives here without the hub's open
    const c = (v[CONVO_KEY] && v[CONVO_KEY].with === name) ? v[CONVO_KEY] : begin(v, name);
    const s = standingWith(setup, name);
    const tier = tierOf(s);
    // a stranger is known after the first exchange: their own lines are for that
    queueOwnLines(ctx, name, tier === 'stranger' ? 'acquaintance' : tier);
    const label = s.relationship ? safe(() => setup.ob_relationships.label(s.relationship, name), TIER_LABEL[tier]) : TIER_LABEL[tier];
    const full = safe(() => people.fullname(name), name);
    return talkScreenHtml({
      name: full, first: safe(() => people.firstname(name), full.split(' ')[0]), label,
      face: faceMarkup(SC, name, { Person: PersonClass }), lines: c.lines, ended: c.ended, place: place(v),
    });
  };

  setup.ob_talk_act = (action) => {
    const v = V();
    const name = v.eventnpc;
    if (!ACTIONS.includes(action) || !valid(name)) return false;
    const c = convoFor(v, name);
    if (!c) return false;
    const s = standingWith(setup, name);
    const tier = tierOf(s);
    const outcome = outcomeOf(action, s);
    const today = v.interactionstoday && v.interactionstoday[name];
    const line = pickLine({ records: state.records, action, tier, outcome, person: name, avoid: c.lines.map((l) => l.raw), random });
    for (const [type, amount] of effectsOf(action, outcome, { attracted: s.attracted, repeat: Array.isArray(today) && today.length > 0 })) {
      try { people.alter_attitude(name, type, amount); } catch (err) { console.warn('Obscura: a feeling could not change', err); }
    }
    if (action === 'ask') { try { people.learn_major(name); } catch { /* only students have one */ } }
    if (!s.known) { try { people.become_known(name); } catch { /* known next time */ } }
    // the engine's own count of who you have talked to today, reset each night
    if (!v.interactionstoday || typeof v.interactionstoday !== 'object') v.interactionstoday = {};
    if (!Array.isArray(v.interactionstoday[name])) v.interactionstoday[name] = [];
    v.interactionstoday[name].push(action);
    try { setup.ob_time.advance_time(TALK_MINUTES); } catch { /* the clock is not the conversation's to fail */ }
    c.lines = [...c.lines, { action, outcome, you: line.you, them: line.them, raw: line.raw, source: line.source }]
      .slice(-SHOWN_EXCHANGES);
    if (action === 'goodbye') c.ended = true;
    SC.Engine.play(TALK_PASSAGE);
    return true;
  };

  setup.ob_talk_leave = () => {
    const v = V();
    delete v[CONVO_KEY];
    delete v[SCENE_KEY];
    SC.Engine.play('ObscuraHub');
    return true;
  };

  // Anywhere but the conversation, its scene is over.
  const $ = deps.jQuery !== undefined ? deps.jQuery : (typeof window !== 'undefined' ? window.jQuery : null);
  const doc = deps.document !== undefined ? deps.document : (typeof document !== 'undefined' ? document : null);
  if ($ && doc && !installTalk.hooked) {
    $(doc).on(':passagedisplay', (ev) => {
      const title = ev && ev.passage && ev.passage.title;
      if (title && title !== TALK_PASSAGE) { const v = V(); if (v && v[SCENE_KEY]) delete v[SCENE_KEY]; }
    });
    installTalk.hooked = true;
  }
  return true;
}
