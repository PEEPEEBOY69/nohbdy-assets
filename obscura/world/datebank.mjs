// world/datebank.mjs — a person's date and night words, written for them.
//
// world/datemoments.mjs owns what every choice on a date does; this asks the
// world's writer for the words - what happens, and what follows each choice -
// for one person, the first time the player sets a date or a night with them,
// in the background. The prompt carries who they are (the engine's words for
// them, as talk's does), both bodies, how they stand with the player and what
// they remember; the persona on top says the world is for adults and a sexual
// moment is written as it is. In bed the words are asked only for what the two
// bodies can do. Lines, not JSON, three moments a call: a date moment's parts
// run longer than work's, and the platform ends a reply near 2,900
// characters. A moment whose parts do not match what can follow it is dropped
// and keeps the words built in.
import { DATE_TYPES, choicesFor, dateTypeById } from './datemoments.mjs';
import { outcomeKeys } from './moments.mjs';
import { faultsIn as defaultFaults } from './persona.mjs';

export const DATEWORDS_TABLE = 'datewords';
export const DATE_TYPES_PER_CALL = 3;

const PART_WORDS = { breasts: 'breasts', penis: 'a cock', vagina: 'a pussy' };
const PART_ORDER = ['breasts', 'penis', 'vagina'];

// "a woman with breasts and a pussy", "a man with a cock", "a person".
export function describeBody(noun, parts = []) {
  const words = PART_ORDER.filter((p) => parts.includes(p)).map((p) => PART_WORDS[p]);
  if (!words.length) return noun;
  return `${noun} with ${words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0]}`;
}

// Someone of the world's body, from the engine: its pronouns and has_part.
export function personBody(setup, name) {
  const P = (setup && setup.people) || {};
  let gender = '';
  try { gender = String((P.pronouns(name) || {}).gender || ''); } catch { gender = ''; }
  const noun = gender === 'female' ? 'a woman' : gender === 'male' ? 'a man' : 'a person';
  const parts = PART_ORDER.filter((p) => { try { return !!P.has_part(name, p); } catch { return false; } });
  return describeBody(noun, parts);
}

// The ways a moment can go for these two bodies, in order.
export const keysFor = (t, ctx = {}) => choicesFor(t, ctx).flatMap((c) => (c.check ? [`${c.id}|pass`, `${c.id}|fail`] : [c.id]));

export function dateOutcomeList(t, ctx = {}) {
  return choicesFor(t, ctx).flatMap((c) => {
    if (!c.check) return [c.what];
    return c.check.willing ? [`${c.what}, and they want it too`, `${c.what}, and they do not`]
      : [`${c.what}, and it goes well`, `${c.what}, and it goes badly`];
  }).map((what, i) => `(${String.fromCharCode(97 + i)}) ${what}`).join('; ');
}

// who: {name, description, body, playerBody, footing, pronouns, memories}.
export function buildDatePrompt(persona, { who, types, ctx = {} }) {
  const memories = Array.isArray(who.memories) ? who.memories : [];
  return [
    persona,
    '',
    'WHO THIS IS WITH',
    `${who.name}: ${who.description}`,
    `${who.name} is ${who.body}. The one with ${who.name} is ${who.playerBody}.`,
    `To ${who.name}, the other is ${who.footing}.`,
    ...(memories.length ? [`What ${who.name} remembers of them:`, ...memories.map((m) => `- ${m}`)] : []),
    '',
    'TASK',
    `Write what can happen between ${who.name} and the one with them, on an evening out or a night in, as it happens in this world.`,
    'For each numbered moment below, write what happens, and then what follows each of the things that can be done about it, in order.',
    '',
    'RULES',
    '- One line for every numbered moment, in this exact form, numbered like the moment:',
    '  N. <what happens> || <what follows the first choice> || <what follows the next> ...',
    `- Write to the one with ${who.name} as "you", in the present tense: two or three sentences for what happens, one to three for each thing that follows. Call ${who.name} by name, or ${who.pronouns}.`,
    '- Where a moment is sexual, write it explicitly: bodies, acts and wants named plainly, nothing softened or skipped.',
    // the real model's setups did what a choice was for ("she stands before
    // you naked" before "undress her"), and dressed the player ("the fabric
    // of your dress") - probed 2026-09-30
    '- What happens only sets the moment up: it never does what one of the choices does; the choices decide that.',
    `- Never give the one with ${who.name} a garment: their clothes are only ever "your clothes".`,
    '- Each part is plain prose: no labels, no names of choices, no quotation marks around it, no line breaks inside a line.',
    '- Never name the place.',
    '',
    'MOMENTS',
    ...types.map((t, i) => `${i + 1}. ${t.what} - after it: ${dateOutcomeList(t, ctx)}`),
  ].join('\n');
}

const NUMBERED = /^\s*(\d+)\s*[.):-]?\s*(.*)$/;
const PLACEHOLDER = /[[\]{}<>]/;
const cleanPart = (raw, faultsIn) => {
  const s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (!s || PLACEHOLDER.test(s) || faultsIn(s, 'body').length) return null;
  return s;
};

// A reply, by the moments it was asked about (numbered from 1): each moment's
// words once, with a part for every way it can go for these bodies.
export function parseDateWords(reply, types, ctx = {}, faultsIn = defaultFaults) {
  const texts = {};
  for (const raw of String(reply == null ? '' : reply).split(/\r?\n/)) {
    const m = NUMBERED.exec(raw.replace(/\*\*/g, ''));
    if (!m) continue;
    const t = types[Number(m[1]) - 1];
    if (!t || texts[t.id]) continue;
    const keys = keysFor(t, ctx);
    const parts = m[2].split('||').map((x) => cleanPart(x, faultsIn));
    if (parts.length !== keys.length + 1 || parts.some((x) => !x)) continue;
    texts[t.id] = { setup: parts[0], outcomes: Object.fromEntries(keys.map((k, i) => [k, parts[i + 1]])) };
  }
  return texts;
}

const usable = (model) => !!model && typeof model.ask === 'function' && (typeof model.available !== 'function' || model.available());

// Every moment of a date and a night, three a call; a batch that came back
// short is asked once more for what it did not bring.
export async function generateDateWords({ model, persona, who, ctx = {}, faultsIn = defaultFaults, perCall = DATE_TYPES_PER_CALL }) {
  if (!usable(model)) return { texts: {}, calls: 0, problems: ['no model'] };
  const texts = {};
  let calls = 0;
  const problems = [];
  const text = () => (typeof persona === 'function' ? persona() : persona);
  for (let i = 0; i < DATE_TYPES.length; i += perCall) {
    let batch = DATE_TYPES.slice(i, i + perCall);
    for (let attempt = 0; attempt < 2 && batch.length; attempt += 1) {
      calls += 1;
      let reply = '';
      try {
        reply = await model.ask(buildDatePrompt(text(), { who, types: batch, ctx }), { maxTokens: 1800, temperature: 0.9, background: true });
      } catch (err) {
        problems.push(`date words: ${err && err.message ? err.message : String(err)}`);
        continue;
      }
      Object.assign(texts, Object.fromEntries(Object.entries(parseDateWords(reply, batch, ctx, faultsIn)).filter(([id]) => !texts[id])));
      batch = batch.filter((t) => !texts[t.id]);
    }
  }
  return { texts, calls, problems };
}

export const emptyDateLog = () => ({ v: 1, people: {} });

// What the store gave back, made safe: a person keeps each moment with a
// setup and the ways it can go that were written; nothing unknown.
export function readDateLog(raw) {
  const log = emptyDateLog();
  if (!raw || typeof raw !== 'object') return log;
  for (const [name, entry] of Object.entries(raw.people || {})) {
    if (!entry || typeof entry !== 'object') continue;
    const texts = {};
    for (const [id, w] of Object.entries(entry.texts || {})) {
      const t = dateTypeById(id);
      if (!t || !w || typeof w.setup !== 'string' || !w.setup.trim()) continue;
      const outcomes = Object.fromEntries(outcomeKeys(t).filter((k) => w.outcomes && typeof w.outcomes[k] === 'string' && w.outcomes[k].trim())
        .map((k) => [k, w.outcomes[k]]));
      if (Object.keys(outcomes).length) texts[id] = { setup: w.setup, outcomes };
    }
    log.people[name] = { texts };
  }
  return log;
}

export const personWords = (log, name) => (log && log.people && log.people[name] ? log.people[name].texts : null);

// The page's words: one world a page, so one log; a person's words written
// once, a second ask while they are being written waits on the first.
const state = { worldId: null, log: emptyDateLog(), jobs: new Map() };

export function useDateLog(worldId, log) {
  state.worldId = worldId;
  state.log = log;
  state.jobs = new Map();
}

export const dateLog = () => state.log;
export const dateLogStatus = () => ({ worldId: state.worldId, people: Object.keys(state.log.people) });

export function writeDateWords({ model, persona, store, worldId, name, who, ctx = {}, faultsIn = defaultFaults }) {
  if (state.worldId !== worldId) useDateLog(worldId, emptyDateLog());
  if (state.jobs.has(name)) return state.jobs.get(name);
  const have = state.log.people[name];
  if (have && Object.keys(have.texts).length >= DATE_TYPES.length) return Promise.resolve(0);
  const log = state.log;
  const job = generateDateWords({ model, persona, who, ctx, faultsIn })
    .then(async (r) => {
      const n = Object.keys(r.texts).length;
      if (!n || state.log !== log) return 0;
      const own = log.people[name] || { texts: {} };
      Object.assign(own.texts, r.texts);
      log.people[name] = own;
      try { if (store && worldId) await store.saveTable(worldId, DATEWORDS_TABLE, log); } catch { /* kept for the session */ }
      return n;
    })
    .catch((err) => { console.warn('Obscura: a date\'s words could not be written', err); return 0; })
    .finally(() => { if (state.jobs.get(name) === job) state.jobs.delete(name); });
  state.jobs.set(name, job);
  return job;
}

// A page load: the words written for this world's people, from the store.
export async function restoreDateWords({ store, worldId }) {
  if (!worldId) return null;
  let raw = null;
  try { raw = store ? await store.loadTable(worldId, DATEWORDS_TABLE) : null; } catch { raw = null; }
  useDateLog(worldId, readDateLog(raw));
  return dateLogStatus();
}
