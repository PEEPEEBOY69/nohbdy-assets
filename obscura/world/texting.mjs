// world/texting.mjs — texting the people whose number you have.
//
// The engine's profile has always offered "Text", and its phone has a badge
// for texts not yet read; the passage both lead to, PhoneText, never shipped,
// so v35 hid the link and nobody could be texted. This is Obscura's own: a
// conversation per person kept in the save, what can be sent (a friendly
// message, a compliment, a flirt, a sext, a picture of yourself, a request for
// one of theirs, a date, a night), and how it goes - read off the engine's
// own feelings, the way talk reads them, with what it gains limited to once a
// day a person by the engine's own $textedtoday. The words are picks from the
// texting bank (world/textbank.mjs). People text first too: once a day at
// most, one of the engine's own phone_initiators, with the engine's own
// notification on the hub and its phone's badge lit.
import {
  TEXT_ACTIONS, FIRST, TEXT_LOG, emptyTextLog, readTextLog, missingTextCells, pickText, writeTextBank, textCells,
} from './textbank.mjs';
import { standingWith, tierOf, outcomeOf as talkOutcomeOf, TIER_LABEL, spokenForElsewhere } from './talk.mjs';
import { faceMarkup } from './portraits.mjs';

export const TEXT_PASSAGE = 'PhoneText';
export const MESSAGES_PASSAGE = 'ObscuraPhoneMessages';
export const TEXTS_KEY = 'obscuraTexts';
export const TEXT_MINUTES = 5;
export const KEEP_LINES = 30;
export const SHOWN_TEXTS = 12;
export const FIRST_CHANCE = 0.25;
const HUB = 'ObscuraHub';

const safe = (fn, fallback) => { try { const v = fn(); return v == null ? fallback : v; } catch { return fallback; } };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// What people send is shown as text, never read as markup (world/talk.mjs).
const said = (s) => `<nowiki>${String(s == null ? '' : s).replace(/<\/?nowiki>/gi, '')}</nowiki>`;

// Talk's footing; a number is given by someone who knows you, so never a stranger.
export function textTierOf(s = {}) {
  const tier = tierOf(s);
  return tier === 'stranger' ? 'acquaintance' : tier;
}

const wantsSex = (s, lust) => !!s.attracted && ((s.lust || 0) >= lust || s.relationship === 'fuckbuddy' || s.relationshipType === 'romantic');

// How a text goes: a flirt, a date and a night by talk's own rules; a sext,
// and a picture sent, by how much they want the player; a picture asked for,
// by the engine's own willing_nude.
export function textOutcomeOf(action, s = {}, willingNude = false) {
  if (action === 'flirt') return talkOutcomeOf('flirt', s);
  if (action === 'meet') return talkOutcomeOf('askout', s);
  if (action === 'proposition') return talkOutcomeOf('proposition', s);
  if (action === 'sext') return wantsSex(s, 200) ? 'good' : 'bad';
  if (action === 'sendpic') return wantsSex(s, 100) ? 'good' : 'bad';
  if (action === 'askpic') return willingNude ? 'good' : 'bad';
  return 'good';
}

const EFFECTS = {
  chat: { good: [['friendship', 8]] },
  compliment: { good: [['friendship', 10]] },
  flirt: { good: [['lust', 12], ['romance', 6]], bad: [['friendship', -8]] },
  sext: { good: [['lust', 20]], bad: [['friendship', -12], ['lust', -10]] },
  sendpic: { good: [['lust', 25]], bad: [['friendship', -10]] },
  askpic: { good: [['lust', 10]], bad: [['lust', -5]] },
  meet: { good: [['romance', 10]], bad: [['romance', -5]] },
  proposition: { good: [['lust', 15]], bad: [['friendship', -10], ['lust', -10]] },
};

// The engine's own rule for texting: what it gains, once a day a person
// ($textedtoday). What goes badly always costs.
export function textEffectsOf(action, outcome, { attracted = false, texted = false } = {}) {
  const base = [...((EFFECTS[action] && EFFECTS[action][outcome]) || [])];
  if (action === 'compliment' && attracted) base.push(['romance', 5]);
  return texted ? base.filter(([, n]) => n < 0) : base;
}

// What a text does to the player: the engine's arousal, its humiliation, its
// Exhibitionism for a picture sent.
const PLAYER = {
  'flirt|good': { arousal: 10 },
  'sext|good': { arousal: 60 },
  'sendpic|good': { arousal: 30, raise: ['Exhibitionism'] },
  'sendpic|bad': { humiliation: 40, raise: ['Exhibitionism'] },
  'askpic|good': { arousal: 40 },
};
function applyPlayer(setup, fx) {
  if (!fx) return;
  const n = (setup && setup.ob_needs) || {};
  const call = (obj, fn, ...args) => { try { if (obj && typeof obj[fn] === 'function') obj[fn](...args); } catch { /* skipped */ } };
  if (fx.arousal) call(n, 'gain_arousal', fx.arousal);
  if (fx.humiliation) call(n, 'gain_humiliation', fx.humiliation);
  const pc = safe(() => setup.pc(), null);
  for (const skill of fx.raise || []) call(pc, 'raise_skill', skill, -1);
}

// The save's texts: per person, their last lines ([who, text, day], who is
// you, them or a note) and how many are unread.
export function textsOf(V) {
  const t = V[TEXTS_KEY];
  if (!t || typeof t !== 'object' || !t.people || typeof t.people !== 'object') {
    V[TEXTS_KEY] = { people: {}, firstDay: null, lastFirst: null };
  }
  return V[TEXTS_KEY];
}

export function convoOf(V, name) {
  const t = textsOf(V);
  const c = t.people[name];
  if (!c || typeof c !== 'object' || !Array.isArray(c.lines)) t.people[name] = { lines: [], unread: 0, recent: [] };
  return t.people[name];
}

const push = (c, line) => { c.lines = [...c.lines, line].slice(-KEEP_LINES); };
const remember = (c, raw) => { c.recent = [...(Array.isArray(c.recent) ? c.recent : []), raw].slice(-6); };

export function unreadCount(V) {
  const people = (V && V[TEXTS_KEY] && V[TEXTS_KEY].people) || {};
  return Object.values(people).reduce((n, c) => n + (Number(c && c.unread) || 0), 0);
}

const hasNumber = (setup, name) => !!safe(() => setup.people.has_number(name), false);
const valid = (V, name) => typeof name === 'string' && !!(V && V.people && V.people[name]);

// What can be sent to someone: everything - but toward anyone else, while the
// player is spoken for, nothing sexual and no date unless the engine's
// cheating switch is on; and no second date while one is set with them.
const SPOKEN_FOR = ['sext', 'sendpic', 'askpic', 'meet', 'proposition'];
export function textActionsFor(setup, V, name) {
  const cheating = spokenForElsewhere(setup, V, standingWith(setup, name));
  const dated = !!safe(() => (typeof setup.ob_date_with === 'function' ? setup.ob_date_with(name) : null), null);
  return TEXT_ACTIONS.filter((a) => !(cheating && SPOKEN_FOR.includes(a)) && !(dated && (a === 'meet' || a === 'proposition')));
}

// A text sent and answered. A yes to a date or a night sets it through
// world/dates.mjs (setup.ob_date_set), and the conversation says when.
export function sendText(setup, V, name, action, { log = emptyTextLog(), random = Math.random } = {}) {
  if (!TEXT_ACTIONS.includes(action) || !valid(V, name) || !hasNumber(setup, name)) return null;
  const P = setup.people;
  const s = standingWith(setup, name);
  const tier = textTierOf(s);
  const outcome = textOutcomeOf(action, s, !!safe(() => P.willing_nude(name), false));
  const c = convoOf(V, name);
  const line = pickText({ log, action, tier, outcome, avoid: c.recent || [], random });
  if (!Array.isArray(V.textedtoday)) V.textedtoday = [];
  const texted = V.textedtoday.includes(name);
  for (const [type, amount] of textEffectsOf(action, outcome, { attracted: s.attracted, texted })) {
    try { P.alter_attitude(name, type, amount); } catch (err) { console.warn('Obscura: a feeling could not change', err); }
  }
  if (!texted) V.textedtoday.push(name);
  applyPlayer(setup, PLAYER[`${action}|${outcome}`]);
  const day = Number(V.gameday) || 0;
  push(c, ['you', line.you, day]);
  push(c, ['them', line.them, day]);
  remember(c, line.raw);
  c.unread = 0;
  let followed = null;
  if (outcome === 'good' && (action === 'meet' || action === 'proposition') && typeof setup.ob_date_set === 'function') {
    try { followed = setup.ob_date_set(name, action === 'meet' ? 'date' : 'hookup'); } catch (err) { console.warn('Obscura: the date could not be set', err); }
    if (followed && followed.note) push(c, ['note', followed.note, day]);
  }
  try { setup.ob_time.advance_time(TEXT_MINUTES); } catch { /* the clock is not the text's to fail */ }
  return { outcome, tier, you: line.you, them: line.them, source: line.source, followed };
}

// Someone texts first: one of the engine's phone_initiators (friendly or
// admiring, number known), by day, once a day at most and not every day, not
// the one who did last time, never someone standing here.
export function textFirst(setup, V, { log = emptyTextLog(), random = Math.random } = {}) {
  const t = textsOf(V);
  const day = Number(V.gameday) || 0;
  if (t.firstDay === day) return null;
  const hour = Number(V.hour) || 0;
  if (hour < 8 || hour >= 23) return null;
  if (random() >= FIRST_CHANCE) return null;
  const here = new Set((Array.isArray(V.peopleatlocation) ? V.peopleatlocation : [])
    .map((e) => (typeof e === 'string' ? e : e && (e.person || e.name))));
  const who = (safe(() => setup.people.phone_initiators(), []) || [])
    .filter((n) => valid(V, n) && !here.has(n) && n !== t.lastFirst);
  if (!who.length) return null;
  const name = who[Math.min(who.length - 1, Math.floor(random() * who.length))];
  const tier = textTierOf(standingWith(setup, name));
  if (tier === 'rival') return null;
  const c = convoOf(V, name);
  const line = pickText({ log, action: FIRST, tier, outcome: 'good', avoid: c.recent || [], random });
  push(c, ['them', line.them, day]);
  remember(c, line.raw);
  c.unread = (Number(c.unread) || 0) + 1;
  t.firstDay = day;
  t.lastFirst = name;
  return { name, text: line.them, source: line.source };
}

export const TEXT_LABELS = {
  chat: 'Send a friendly message', compliment: 'Send a compliment', flirt: 'Flirt', sext: 'Sext them',
  sendpic: 'Send a naked picture', askpic: 'Ask for a picture', meet: 'Ask them out', proposition: 'Ask them over tonight',
};

const dayLabel = (today, day) => {
  const ago = today - day;
  if (ago <= 0) return 'Today';
  return ago === 1 ? 'Yesterday' : `${ago} days ago`;
};

// The conversation, in the phone. No newlines: printed with <<=, each one
// would be a line break on screen.
export function textScreenHtml({ name, label = '', face = '', lines = [], actions = [], today }) {
  const out = ['<div class="ob-phone ob-texts">'];
  out.push(`<div class="ob-texts-head">${face}<div class="ob-texts-who"><div class="ob-texts-name">${esc(name)}</div>`
    + `<div class="ob-texts-rel">${esc(label)}</div></div></div>`);
  // Newest first in the markup, laid out bottom-up by the stylesheet
  // (column-reverse): a box that scrolls opens on the latest message, the way
  // a phone's does. A day's marker follows its messages here and shows above.
  const shown = [];
  if (!lines.length) shown.push('<div class="ob-text-quiet">No messages yet.</div>');
  let shownDay = null;
  for (const [who, text, day] of lines.slice(-SHOWN_TEXTS)) {
    if (Number.isFinite(today) && Number.isFinite(day) && day !== shownDay) {
      shown.push(`<div class="ob-text-day">${dayLabel(today, day)}</div>`);
      shownDay = day;
    }
    const kind = who === 'you' || who === 'note' ? who : 'them';
    shown.push(`<div class="ob-text ob-text-${kind}">${said(text)}</div>`);
  }
  out.push(`<div class="ob-texts-lines">${shown.reverse().join('')}</div><div class="ob-texts-actions">`);
  for (const a of actions) out.push(`<<link "${TEXT_LABELS[a]}">><<run setup.ob_text_send("${a}")>><</link>>`);
  out.push(`</div><div class="ob-phone-back"><<link "Back">><<run setup.ob_phone.open("${MESSAGES_PASSAGE}")>><</link>></div></div>`);
  return out.join('');
}

// The phone's messages: everyone whose number the player has, and anyone who
// has written; the unread first, then the latest, then by name.
export function messageRows(setup, V) {
  const t = textsOf(V);
  const keys = new Set(Object.keys((V && V.people) || {}).filter((n) => hasNumber(setup, n)));
  for (const n of Object.keys(t.people)) if (valid(V, n) && t.people[n].lines && t.people[n].lines.length) keys.add(n);
  return [...keys].map((key) => {
    const c = t.people[key] || { lines: [], unread: 0 };
    const last = c.lines.length ? c.lines[c.lines.length - 1] : null;
    return {
      key, name: safe(() => setup.people.fullname(key), key), unread: Number(c.unread) || 0,
      last: last ? String(last[1] || '') : '', day: last ? Number(last[2]) || 0 : -1,
    };
  }).sort((a, b) => (b.unread - a.unread) || (b.day - a.day) || a.name.localeCompare(b.name));
}

const clip = (s, n = 80) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function messagesScreenHtml(rows, { head = '' } = {}) {
  const list = rows.length
    ? rows.map((r) => `<div class="ob-phone-row"><<link "${esc(r.name)}">><<run setup.ob_text_open(${JSON.stringify(r.key)})>><</link>>`
      + `${r.unread ? `<span class="ob-phone-unread">${r.unread}</span>` : ''}`
      + `${r.last ? `<span class="ob-phone-sub">${said(clip(r.last))}</span>` : ''}</div>`).join('')
    : '<div class="ob-phone-empty">Nobody to message yet. Ask someone for their number.</div>';
  return `<div class="ob-phone">${head}<div class="ob-phone-title">Messages</div>${list}`
    + '<div class="ob-phone-back"><<link "Back">><<run setup.ob_phone.open("PhoneMain")>><</link>></div></div>';
}

// The world's texting bank: one world a page, so one bank.
const bank = { worldId: null, log: emptyTextLog(), busy: null };

export function useTextLog(worldId, log) {
  bank.worldId = worldId;
  bank.log = log;
  bank.busy = null;
}

export const textLog = () => bank.log;

export function textBankStatus() {
  return { worldId: bank.worldId, written: Object.keys(bank.log.world).length, cells: textCells().length, busy: !!bank.busy };
}

const saveTo = (store, worldId) => (log) => (store && worldId ? store.saveTable(worldId, TEXT_LOG, log) : Promise.resolve());

// Written in the background, once: a second ask while one runs waits on it.
export function writeTheTextBank({ model, persona, store, worldId, faultsIn, sender = '' }) {
  if (bank.worldId !== worldId) useTextLog(worldId, emptyTextLog());
  if (bank.busy) return bank.busy;
  if (!missingTextCells(bank.log).length) return Promise.resolve(0);
  const log = bank.log;
  const job = writeTextBank({ model, persona, log, faultsIn, sender, save: saveTo(store, worldId) })
    .catch((err) => { console.warn('Obscura: the texts could not be written', err); return 0; })
    .finally(() => { if (bank.busy === job) bank.busy = null; });
  bank.busy = job;
  return job;
}

const anyNumber = (setup, V) => Object.keys((V && V.people) || {}).some((n) => hasNumber(setup, n));

// A page load: the texts written for this world, from the store; the bank
// finished in the background if the player has anyone's number.
export async function restoreTexts({ store, worldId, model, persona, faultsIn, setup, V, sender = '' }) {
  if (!worldId) return null;
  let raw = null;
  try { raw = store ? await store.loadTable(worldId, TEXT_LOG) : null; } catch { raw = null; }
  useTextLog(worldId, readTextLog(raw));
  const usable = model && (typeof model.available !== 'function' || model.available());
  if (usable && anyNumber(setup, V) && missingTextCells(bank.log).length) {
    writeTheTextBank({ model, persona, store, worldId, faultsIn, sender });
  }
  return textBankStatus();
}

const WRAPPED = '__obscuraTexting';
const hookedWith = new WeakSet();

// The engine side, installed at boot. deps: SugarCube, jQuery, document,
// Person, onNumber(name) -> called when the player learns a number (the bank
// is written then, world/flow.mjs).
export function installTexting(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const setup = SC && SC.setup;
  if (!setup || !setup.people) return false;
  const people = setup.people;
  const V = () => SC.State.variables;
  const PersonClass = deps.Person !== undefined ? deps.Person : (typeof window !== 'undefined' ? window.Person : null);
  const random = () => (SC.State && typeof SC.State.random === 'function' ? SC.State.random() : Math.random());
  const onNumber = typeof deps.onNumber === 'function' ? deps.onNumber : () => {};

  // the first number the player is given asks for the world's texts
  if (typeof people.learn_number === 'function' && !people.learn_number[WRAPPED]) {
    const original = people.learn_number;
    const wrapped = function (...args) {
      const r = original.apply(this, args);
      try { onNumber(args[0]); } catch (err) { console.warn('Obscura: the texts could not be asked for', err); }
      return r;
    };
    wrapped[WRAPPED] = true;
    people.learn_number = wrapped;
  }

  // the engine's phone counts what has not been read (its badge)
  if (setup.ob_nPCSimulation && typeof setup.ob_nPCSimulation === 'object') {
    setup.ob_nPCSimulation.unread_text_count = () => unreadCount(V());
  }

  const open = (passage) => { try { setup.ob_phone.open(passage); } catch (err) { console.warn('Obscura: the phone could not open', err); } };

  setup.ob_text_open = (name) => {
    const v = V();
    if (!valid(v, name) || !hasNumber(setup, name)) return false;
    v.phonetexter = name;
    open(TEXT_PASSAGE);
    return true;
  };

  setup.ob_text_screen = () => {
    const v = V();
    const name = safe(() => people.get_name(v.phonetexter), v.phonetexter);
    if (!valid(v, name)) {
      return `<div class="ob-phone"><div class="ob-phone-empty">Nobody to message.</div><div class="ob-phone-back"><<link "Back">><<run setup.ob_phone.open("PhoneMain")>><</link>></div></div>`;
    }
    const c = convoOf(v, name);
    c.unread = 0;
    const s = standingWith(setup, name);
    const tier = textTierOf(s);
    const label = s.relationship ? safe(() => setup.ob_relationships.label(s.relationship, name), TIER_LABEL[tier]) : TIER_LABEL[tier];
    return textScreenHtml({
      name: safe(() => people.fullname(name), name), label, lines: c.lines, today: Number(v.gameday) || 0,
      face: safe(() => faceMarkup(SC, name, { Person: PersonClass }), ''),
      actions: hasNumber(setup, name) ? textActionsFor(setup, v, name) : [],
    });
  };

  setup.ob_text_send = (action) => {
    const v = V();
    const name = v.phonetexter;
    if (!valid(v, name) || !textActionsFor(setup, v, name).includes(action)) return false;
    const r = sendText(setup, v, name, action, { log: bank.log, random });
    if (!r) return false;
    open(TEXT_PASSAGE);
    return true;
  };

  setup.ob_text_messages = (head = '') => messagesScreenHtml(messageRows(setup, V()), { head });

  // the hub: someone may text first, and the engine's own notification says so
  const $ = deps.jQuery !== undefined ? deps.jQuery : (typeof window !== 'undefined' ? window.jQuery : null);
  const doc = deps.document !== undefined ? deps.document : (typeof document !== 'undefined' ? document : null);
  if ($ && doc && !hookedWith.has($)) {
    $(doc).on(':passagestart', (ev) => {
      if (!ev || !ev.passage || ev.passage.title !== HUB) return;
      const v = V();
      if (!v || !v.people) return;
      const got = textFirst(setup, v, { log: bank.log, random });
      if (!got || typeof setup.add_notification !== 'function') return;
      const first = safe(() => people.firstname(got.name), got.name);
      try {
        setup.add_notification(`<span class="ob-text-notice">${esc(first)} sent you a message. `
          + `<<link "Read it">><<run setup.ob_text_open(${JSON.stringify(got.name)})>><</link>></span>`);
      } catch { /* the text is waiting in the phone either way */ }
    });
    hookedWith.add($);
  }
  return true;
}
