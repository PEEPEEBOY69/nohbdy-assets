// world/momentbank.mjs — a line of work's moments, written for the world.
//
// world/moments.mjs owns what every choice in a moment does; this asks the
// world's writer for the words - what happens, and what follows each choice -
// once, when the player first takes that line of work, in the background. The
// persona on top of the prompt says the world is for adults and a sexual
// moment is written as it is. Lines, not JSON, six moments a call: a reply the
// platform cuts off at about 2,900 characters keeps every line it finished. A
// line whose parts do not match its moment's outcomes is dropped, and that
// moment keeps its built-in words. The words are kept per world in the store,
// as the talk bank's lines are, and never name a place, so they fit every place
// of that kind. The first call also names the line's five ranks.
import { MOMENT_TYPES, BUILT_IN_MOMENTS, momentById, outcomeKeys } from './moments.mjs';
import { LINES } from './work.mjs';
import { faultsIn as defaultFaults } from './persona.mjs';

export const MOMENTS_TABLE = 'moments';
export const MOMENTS_PER_CALL = 6;

const LINE_WORDS = {
  serving: 'serving food and drink',
  shopwork: 'working in a shop',
  service: 'looking after rooms, baths and the sick',
  performing: 'dancing and performing',
};

// Each outcome of a moment, in order: a choice with a check twice, as it works
// and as it fails.
const outcomeList = (t) => t.choices.flatMap((c) => (c.check ? [`${c.what}, and it works`, `${c.what}, and it fails`] : [c.what]))
  .map((what, i) => `(${String.fromCharCode(97 + i)}) ${what}`).join('; ');

// Whose body a moment happens to, from the engine: the real model wrote "your
// bodice" and "your breasts" for every player until it was told.
export function bodyOf(setup, V) {
  let pc = null;
  try { pc = setup && typeof setup.pc === 'function' ? setup.pc() : null; } catch { pc = null; }
  const has = (part) => { try { return !!(pc && pc.has_part(part)); } catch { return false; } };
  const gender = String((V && V.pcgender) || '').toLowerCase();
  const trans = /trans/.test(gender) ? 'trans ' : '';
  let noun = 'a person';
  if (/female|woman/.test(gender)) noun = `a ${trans}woman`;
  else if (/male|man/.test(gender)) noun = `a ${trans}man`;
  const parts = [has('breasts') && 'breasts', has('penis') && 'a cock', has('vagina') && 'a pussy'].filter(Boolean);
  if (!parts.length) return noun;
  return `${noun} with ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]}`;
}

export function buildMomentsPrompt(persona, { line, placeName, types, ranks = false, who = '' }) {
  return [
    persona,
    '',
    'TASK',
    `Write what can happen during a shift of ${LINE_WORDS[line] || 'work'} at ${placeName}, as it happens in this world. For each`,
    'numbered moment below, write what happens, and then what follows each of the things that can be done about it, in order.',
    ...(who ? [`The one working is ${who}.`] : []),
    '',
    'RULES',
    ...(ranks ? ['- First, one line: RANKS: <five titles for the work here, the newest hand first and the one in charge last>'] : []),
    '- Then one line for every numbered moment, in this exact form, numbered like the moment:',
    '  N. <what happens> || <what follows the first choice> || <what follows the next> ...',
    '- Write to the one working, as "you", in the present tense: two or three sentences for what happens, one to three for each thing that follows.',
    '- Each part is plain prose: no labels, no names of choices, no quotation marks around it, no line breaks inside a line.',
    '- The people in it are named by what they are or do, never by a name; never name the place.',
    '',
    'MOMENTS',
    ...types.map((t, i) => `${i + 1}. ${t.what} - after it: ${outcomeList(t)}`),
  ].join('\n');
}

const NUMBERED = /^\s*(\d+)\s*[.):-]?\s*(.*)$/;
const RANKS_LINE = /^\s*RANKS\s*:\s*(.*)$/i;
const PLACEHOLDER = /[[\]{}<>]/;
const cleanPart = (raw, faultsIn) => {
  const s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (!s || PLACEHOLDER.test(s) || faultsIn(s, 'body').length) return null;
  return s;
};

// A reply, by the moments it was asked about (numbered from 1): each moment's
// words once, and the ranks when there are five of them.
export function parseMoments(reply, types, faultsIn = defaultFaults) {
  const texts = {};
  let ranks = null;
  for (const raw of String(reply == null ? '' : reply).split(/\r?\n/)) {
    const line = raw.replace(/\*\*/g, '');
    const r = RANKS_LINE.exec(line);
    if (r) {
      const titles = r[1].split(r[1].includes('|') ? '|' : ',').map((x) => cleanPart(x, faultsIn));
      if (!ranks && titles.length === 5 && titles.every((x) => x && x.length <= 30)) ranks = titles;
      continue;
    }
    const m = NUMBERED.exec(line);
    if (!m) continue;
    const t = types[Number(m[1]) - 1];
    if (!t || texts[t.id]) continue;
    const keys = outcomeKeys(t);
    const parts = m[2].split('||').map((x) => cleanPart(x, faultsIn));
    if (parts.length !== keys.length + 1 || parts.some((x) => !x)) continue;
    texts[t.id] = { setup: parts[0], outcomes: Object.fromEntries(keys.map((k, i) => [k, parts[i + 1]])) };
  }
  return { texts, ranks };
}

const usable = (model) => !!model && typeof model.ask === 'function' && (typeof model.available !== 'function' || model.available());

// Every moment of a line of work - whether or not the player's switches let it
// come, so turning one on later finds its words written - six a call; a batch
// that came back short is asked once more for what it did not bring. The
// ranks come with the first batch.
export async function generateMoments({ model, persona, line, placeName, who = '', faultsIn = defaultFaults, perCall = MOMENTS_PER_CALL }) {
  if (!usable(model)) return { texts: {}, ranks: null, calls: 0, problems: ['no model'] };
  const types = MOMENT_TYPES.filter((t) => t.line === line);
  const texts = {};
  let ranks = null;
  let calls = 0;
  const problems = [];
  const text = () => (typeof persona === 'function' ? persona() : persona);
  for (let i = 0; i < types.length; i += perCall) {
    let batch = types.slice(i, i + perCall);
    for (let attempt = 0; attempt < 2 && batch.length; attempt += 1) {
      calls += 1;
      let reply = '';
      try {
        reply = await model.ask(buildMomentsPrompt(text(), { line, placeName, types: batch, ranks: i === 0 && !ranks, who }),
          { maxTokens: 1800, temperature: 0.9, background: true });
      } catch (err) {
        problems.push(`moments: ${err && err.message ? err.message : String(err)}`);
        continue;
      }
      const got = parseMoments(reply, batch, faultsIn);
      for (const [id, w] of Object.entries(got.texts)) if (!texts[id]) texts[id] = w;
      if (!ranks && got.ranks) ranks = got.ranks;
      batch = batch.filter((t) => !texts[t.id]);
    }
  }
  return { texts, ranks, calls, problems };
}

export const emptyMomentsLog = () => ({ v: 1, lines: {} });

// What the store gave back, made safe: a log from an older build, a damaged
// one, or none. A moment is kept only with words for every outcome it has.
export function readMomentsLog(raw) {
  const log = emptyMomentsLog();
  if (!raw || typeof raw !== 'object') return log;
  for (const [line, entry] of Object.entries(raw.lines || {})) {
    if (!LINES[line] || !entry || typeof entry !== 'object') continue;
    const texts = {};
    for (const [id, w] of Object.entries(entry.texts || {})) {
      const t = momentById(id);
      if (!t || t.line !== line || !w || typeof w.setup !== 'string' || !w.setup.trim()) continue;
      const keys = outcomeKeys(t);
      const outcomes = w.outcomes || {};
      if (!keys.every((k) => typeof outcomes[k] === 'string' && outcomes[k].trim())) continue;
      texts[id] = { setup: w.setup, outcomes: Object.fromEntries(keys.map((k) => [k, outcomes[k]])) };
    }
    const ranks = Array.isArray(entry.ranks) && entry.ranks.length === 5 && entry.ranks.every((x) => typeof x === 'string' && x.trim())
      ? [...entry.ranks] : null;
    log.lines[line] = { place: typeof entry.place === 'string' ? entry.place : '', ranks, texts };
  }
  return log;
}

// A moment's words: the world's where they are written, else the built-in ones.
export function momentWords(log, typeId) {
  const t = momentById(typeId);
  const own = t && log && log.lines && log.lines[t.line] && log.lines[t.line].texts && log.lines[t.line].texts[typeId];
  return own || BUILT_IN_MOMENTS[typeId] || null;
}
