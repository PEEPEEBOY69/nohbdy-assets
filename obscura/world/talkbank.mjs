// world/talkbank.mjs — what people say here, written ahead, like a generator.
//
// A conversation in Obscura is not a model call. It is a pick from a bank of
// lines - instant, in the world's words - of what you say and how they answer,
// for each thing you can do (chat, ask about them, compliment, flirt, tease,
// say goodbye), each footing you can be on with someone (a stranger, someone
// you know, a friend, close, romantic, a rival) and each way it can go. The
// model writes the bank in the background: once for the world, after the
// school's names, and once more for each person the player actually talks to,
// in that person's own voice (world/talk.mjs asks for both). The lines built in
// here answer until those land, and wherever they fail.
//
// A record has the engine's own dialogue shape, {tags, content}, and its
// content is pairs: "you: ... || them: ...".
import { faultsIn as defaultFaults } from './persona.mjs';

export const ACTIONS = ['chat', 'ask', 'compliment', 'flirt', 'tease', 'goodbye'];
export const TIERS = ['stranger', 'acquaintance', 'friend', 'close', 'romantic', 'rival'];
// Only these can go badly; everything else always lands.
export const TWO_WAY = ['flirt', 'tease'];
export const PAIRS_PER_CELL = 3;
export const BANK_CELLS_PER_CALL = 12;
export const MAX_HALF = 220;
export const TALK_TAG = 'obscura talk';
export const ANYONE = 'talk anyone';
export const personTag = (name) => `talk person ${name}`;
export const cellId = (action, tier, outcome) => `${action}|${tier}|${outcome}`;

// Every (action, footing, outcome) the world's bank covers. With a rival -
// friendship at or below -150 - flirting and teasing never go well, so those
// are not asked for.
export function worldCells() {
  const cells = [];
  for (const tier of TIERS) {
    for (const action of ACTIONS) {
      const outcomes = TWO_WAY.includes(action) ? (tier === 'rival' ? ['bad'] : ['good', 'bad']) : ['good'];
      for (const outcome of outcomes) cells.push({ action, tier, outcome, id: cellId(action, tier, outcome) });
    }
  }
  return cells;
}

const DOING = {
  chat: 'making small talk',
  ask: 'asking about their life',
  compliment: 'paying them a compliment',
  flirt: 'flirting with them',
  tease: 'teasing them',
  goodbye: 'saying goodbye',
};
const HOW = {
  chat: { good: 'it goes fine' },
  ask: { good: 'they tell a little about themselves' },
  compliment: { good: 'they take it well' },
  flirt: { good: 'they welcome it', bad: 'they do not want it' },
  tease: { good: 'they take it well', bad: 'it lands badly' },
  goodbye: { good: 'the conversation ends' },
};
export const FOOTING = {
  stranger: 'someone they have never met',
  acquaintance: 'someone they know a little',
  friend: 'a friend',
  close: 'a close friend',
  romantic: 'someone they are romantically involved with',
  rival: 'someone they dislike',
};
const momentLine = (c, withFooting) =>
  `${DOING[c.action]}${withFooting ? ` with ${FOOTING[c.tier]}` : ''} - ${HOW[c.action][c.outcome]}`;
// Each cell asked for PAIRS_PER_CELL times, one numbered line each: the real
// model writes one line a number and ignores "three lines for every moment"
// (measured 2026-09-24). Item n belongs to cell floor((n - 1) / PAIRS_PER_CELL).
const WAYS = ['first way', 'second way', 'third way'];
const momentItems = (cells, withFooting) => cells.flatMap((c) =>
  WAYS.slice(0, PAIRS_PER_CELL).map((way) => `${momentLine(c, withFooting)} (${way})`))
  .map((line, i) => `${i + 1}. ${line}`);

const FORMAT_RULES = [
  '- Reply with ONLY one line for every numbered moment, in this exact form, numbered like the moment:',
  '  N. you: <what the other person says> || them: <the answer>',
  '- Each line holds exactly one pair: one you: and one them:. A longer answer stays in its one them: part.',
  '- The same moment asked a second or third way gets different words each time.',
  `- Each part is one or two spoken sentences, under ${MAX_HALF - 20} characters.`,
  '- Write each part as it is said: a capital letter at the start, a full stop, question mark or exclamation mark at the end.',
  '- Spoken words only: no names, no actions, no narration, no quotation marks, no brackets.',
];

export function buildBankPrompt(persona, cells) {
  return [
    persona,
    '',
    'TASK',
    'Someone new to this world talks with the people who live here. For each numbered moment below, write what',
    'they say to a person here and how that person answers, the way people here speak.',
    '',
    'RULES',
    ...FORMAT_RULES,
    '',
    'MOMENTS',
    ...momentItems(cells, true),
  ].join('\n');
}

// who: {tier, description, profile, memories} - world/talk.mjs reads it off
// the engine.
export function buildPersonalPrompt(persona, who, cells) {
  const lines = [persona, '', 'WHO YOU ARE WRITING', who.description];
  if (who.profile) lines.push(`In their own words: ${who.profile}`);
  lines.push(`To them, the one talking is ${FOOTING[who.tier] || FOOTING.acquaintance}.`);
  if (who.memories && who.memories.length) lines.push('What they remember of that person:', ...who.memories.map((m) => `- ${m}`));
  lines.push(
    '',
    'TASK',
    'Write what passes between this person and the one talking to them, in this person\'s own voice: their age,',
    'their temperament, how they feel about the one talking. For each numbered moment below, write what the other',
    'says and how this person answers.',
    '',
    'RULES',
    ...FORMAT_RULES,
    '',
    'MOMENTS',
    ...momentItems(cells, false),
  );
  return lines.join('\n');
}

// The engine's own words for someone, as one line of the prompt.
export function describePerson({ noun = 'a person', archetype = '', subarchetype = '', inclinations = [] } = {}) {
  const parts = [noun.charAt(0).toUpperCase() + noun.slice(1)];
  if (archetype) parts.push(`type: ${archetype}${subarchetype ? ` (${subarchetype})` : ''}`);
  if (inclinations.length) parts.push(`temperament: ${inclinations.slice(0, 8).join(', ')}`);
  return `${parts.join('; ')}.`;
}

const NUMBERED = /^\s*(\d+)\s*[.):-]?\s*([\s\S]*)$/;
const PART = /^\s*(you|them)\s*:\s*([\s\S]*)$/i;
// A slot left to fill, markup, or the next pair run into this one.
const NOT_SPEECH = /[[\]{}<>%\\|]|\bunwritten\b|\b(?:you|them)\s*:/i;

export function cleanHalf(text) {
  let s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (s.length > 1 && /^["“‘']/.test(s) && /["”’']$/.test(s)) s = s.slice(1, -1).trim();
  return s;
}

// A spoken line may open with "Sure," or "Okay": only the faults that are
// wrong anywhere count (persona.mjs's 'name' scope) - an action in asterisks,
// a line that steps out of the world.
export function validHalf(s, faultsIn = defaultFaults) {
  return typeof s === 'string' && s.length > 0 && s.length <= MAX_HALF
    && !NOT_SPEECH.test(s) && faultsIn(s, 'name').length === 0;
}

export const joinPair = (you, them) => `you: ${you} || them: ${them}`;
export function splitPair(raw) {
  const m = /^you: ([\s\S]*?) \|\| them: ([\s\S]*)$/.exec(String(raw == null ? '' : raw));
  return m ? { you: m[1], them: m[2] } : { you: '', them: String(raw == null ? '' : raw) };
}

// The parts of one numbered line: "you: ... || them: ...", and what the model
// writes instead (measured on the real model, 2026-09-24): one answer run over
// a second "them:", or two pairs on one line. A part with no speaker spoils
// its pair.
function pairsOnLine(text) {
  const pairs = [];
  let cur = null;
  for (const seg of text.split('||')) {
    const m = PART.exec(seg);
    if (!m) { if (cur) cur.broken = true; continue; }
    if (m[1].toLowerCase() === 'you') { cur = { you: cleanHalf(m[2]), them: [], broken: false }; pairs.push(cur); }
    else if (cur) cur.them.push(cleanHalf(m[2]));
  }
  return pairs.filter((p) => !p.broken).map((p) => ({ you: p.you, them: cleanHalf(p.them.join(' ')) }));
}

// Moment number -> up to three pairs. A reply cut off by the token budget keeps
// every line it finished.
export function parsePairs(reply, count, faultsIn = defaultFaults) {
  const out = {};
  for (const line of String(reply == null ? '' : reply).split(/\r?\n/)) {
    const m = NUMBERED.exec(line.replace(/\*\*/g, ''));
    if (!m) continue;
    const n = Number(m[1]);
    if (!Number.isInteger(n) || n < 1 || n > count) continue;
    for (const { you, them } of pairsOnLine(m[2])) {
      if (!validHalf(you, faultsIn) || !validHalf(them, faultsIn)) continue;
      const list = out[n] || (out[n] = []);
      const pair = joinPair(you, them);
      if (list.length < PAIRS_PER_CELL && !list.includes(pair)) list.push(pair);
    }
  }
  return out;
}

// Until the model's lines land - and wherever a call fails - these answer.
// Plain speech, no names and nothing of any one world.
export const BUILT_IN = {
  'chat|good': [
    "you: How's your day going? || them: Not bad. Better now, maybe.",
    'you: Busy around here today. || them: It always is, this time of day.',
    "you: Anything worth knowing about? || them: Nothing you won't hear about soon enough.",
  ],
  'ask|good': [
    'you: What do you do around here? || them: A bit of everything. Mostly I keep my head down.',
    'you: How long have you been here? || them: Long enough to know where not to go.',
    'you: What keeps you busy? || them: Work, mostly. And the people I put up with.',
  ],
  'compliment|good': [
    "you: You've got a good way about you. || them: That's kind of you to say.",
    'you: I like talking to you. || them: Careful. I might start to believe it.',
    "you: You always seem to know what's going on. || them: I pay attention. Most people don't.",
  ],
  'flirt|good': [
    "you: I was hoping I'd run into you. || them: Were you? Then I'm glad you did.",
    "you: You're hard to stop looking at. || them: Then don't stop.",
    "you: Tell me you're free later. || them: For you, I could be.",
  ],
  'flirt|bad': [
    "you: I was hoping I'd run into you. || them: I'm not sure what you're after, but no.",
    "you: You're hard to stop looking at. || them: Try harder.",
    "you: Tell me you're free later. || them: I'm not. Not for that.",
  ],
  'tease|good': [
    'you: You look like you slept in a ditch. || them: And you look like you never sleep at all.',
    "you: Still pretending you know what you're doing? || them: Still pretending you don't need my help?",
    "you: I saw you walk into that door. Twice. || them: It moved. I'll swear to it.",
  ],
  'tease|bad': [
    "you: You look like you slept in a ditch. || them: That's not funny.",
    "you: Still pretending you know what you're doing? || them: Leave it.",
    'you: I saw you walk into that door. Twice. || them: Do you want something, or not?',
  ],
  'goodbye|good': [
    'you: I should get going. || them: Go on, then. See you around.',
    "you: I'll let you get on. || them: Take care of yourself.",
    'you: Until next time. || them: Until then.',
  ],
};

// The log kept beside the world in IndexedDB (world/talk.mjs: TALK_LOG):
// world: {cellId: [pairs]}, people: {name: {tiers: [...], cells: {cellId: [pairs]}}}.
export const emptyTalkLog = () => ({ world: {}, people: {} });

const IS_PAIR = (p) => typeof p === 'string' && p.startsWith('you: ') && p.includes(' || them: ');
const pairsOf = (v) => (Array.isArray(v) ? v.filter(IS_PAIR).slice(0, PAIRS_PER_CELL) : []);
const OUTCOMES = ['good', 'bad'];
const knownCell = (id) => {
  const [action, tier, outcome] = String(id).split('|');
  return ACTIONS.includes(action) && TIERS.includes(tier) && OUTCOMES.includes(outcome) ? { action, tier, outcome } : null;
};

// What the store gave back, made safe: a log from an older build, a damaged
// one, or none.
export function readTalkLog(raw) {
  const log = emptyTalkLog();
  if (!raw || typeof raw !== 'object') return log;
  for (const [id, v] of Object.entries(raw.world || {})) {
    const p = pairsOf(v);
    if (knownCell(id) && p.length) log.world[id] = p;
  }
  for (const [name, own] of Object.entries(raw.people || {})) {
    if (!own || typeof own !== 'object') continue;
    const cells = {};
    for (const [id, v] of Object.entries(own.cells || {})) {
      const p = pairsOf(v);
      if (knownCell(id) && p.length) cells[id] = p;
    }
    log.people[name] = { tiers: Array.isArray(own.tiers) ? own.tiers.filter((t) => TIERS.includes(t)) : [], cells };
  }
  return log;
}

export function recordsFromLog(log) {
  const records = [];
  const add = (id, whose, pairs) => {
    const c = knownCell(id);
    if (c) records.push({ tags: [TALK_TAG, `talk ${c.action}`, `tier ${c.tier}`, `outcome ${c.outcome}`, whose], content: [...pairs] });
  };
  for (const [id, pairs] of Object.entries((log && log.world) || {})) add(id, ANYONE, pairs);
  for (const [name, own] of Object.entries((log && log.people) || {})) {
    for (const [id, pairs] of Object.entries((own && own.cells) || {})) add(id, personTag(name), pairs);
  }
  return records;
}

export const missingWorldCells = (log) => worldCells().filter((c) => !((log.world || {})[c.id] || []).length);
export const hasOwnLines = (log, name, tier) => !!(log.people[name] && log.people[name].tiers.includes(tier));

const usable = (model) => !!model && typeof model.ask === 'function' && (typeof model.available !== 'function' || model.available());
const ask = async (model, prompt, cells) => {
  try {
    return await model.ask(prompt, { maxTokens: 200 + cells * PAIRS_PER_CELL * 70, temperature: 0.9, background: true });
  } catch { return ''; }
};
// The reply's numbered items, gathered back into their cells: cell id -> pairs.
const byCell = (got, cells) => {
  const out = {};
  for (const [n, pairs] of Object.entries(got)) {
    const c = cells[Math.floor((Number(n) - 1) / PAIRS_PER_CELL)];
    if (!c) continue;
    const list = out[c.id] || (out[c.id] = []);
    for (const p of pairs) if (list.length < PAIRS_PER_CELL && !list.includes(p)) list.push(p);
  }
  return out;
};

// The world's bank, BANK_CELLS_PER_CALL cells a call, in the background. A
// batch that came back short is asked once more for what it did not bring;
// what still fails stays on the lines built in. Saved after every batch, so a
// reload finishes what is missing and asks for nothing twice.
export async function writeWorldBank({
  model, persona, log, save = async () => {}, onBatch = () => {}, faultsIn = defaultFaults, perCall = BANK_CELLS_PER_CALL,
}) {
  if (!usable(model)) return 0;
  const todo = missingWorldCells(log);
  let written = 0;
  for (let i = 0; i < todo.length; i += perCall) {
    let batch = todo.slice(i, i + perCall);
    for (let attempt = 0; attempt < 2 && batch.length; attempt += 1) {
      const text = typeof persona === 'function' ? persona() : persona;
      const reply = await ask(model, buildBankPrompt(text, batch), batch.length);
      const got = byCell(parsePairs(reply, batch.length * PAIRS_PER_CELL, faultsIn), batch);
      for (const c of batch) {
        if (got[c.id] && got[c.id].length) { log.world[c.id] = got[c.id]; written += 1; }
      }
      batch = batch.filter((c) => !(log.world[c.id] || []).length);
    }
    try { await save(log); } catch { /* the next batch saves the whole log again */ }
    try { onBatch(log); } catch { /* a listener is not the bank's failure */ }
  }
  return written;
}

// One person's own lines, for one footing: one call. Only a call that brought
// something counts as written - the footing is asked for again another time.
export async function writeOwnLines({ model, persona, who, name, log, save = async () => {}, faultsIn = defaultFaults }) {
  if (!usable(model)) return 0;
  const cells = worldCells().filter((c) => c.tier === who.tier);
  const text = typeof persona === 'function' ? persona() : persona;
  const reply = await ask(model, buildPersonalPrompt(text, who, cells), cells.length);
  const got = byCell(parsePairs(reply, cells.length * PAIRS_PER_CELL, faultsIn), cells);
  const own = log.people[name] || { tiers: [], cells: {} };
  let written = 0;
  for (const c of cells) {
    if (got[c.id] && got[c.id].length) { own.cells[c.id] = got[c.id]; written += 1; }
  }
  if (!written) return 0;
  if (!own.tiers.includes(who.tier)) own.tiers.push(who.tier);
  log.people[name] = own;
  try { await save(log); } catch { /* kept for the session, saved with the next */ }
  return written;
}
