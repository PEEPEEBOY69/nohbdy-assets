// world/narrationbank.mjs — the world's own words for every act of the
// engine's encounter.
//
// world/narration.mjs tells every act in plain words built from the engine's
// data; this asks the world's writer for the world's own: each act the engine
// has, each way (the player doing it, it done to the player), two ways each,
// explicit, in the world's voice - in the background, ten acts a call, the
// common ones first, the first time the player sets a date or a night. The
// bank is the world's, used with every partner, so the other is only ever
// {name}, {them} and {their} (the reader drops a line that says he or she),
// and a line names only the parts its act uses: the act fixes the bodies. Kept
// per world in the store; the plain words answer until these land.
import { faultsIn as defaultFaults } from './persona.mjs';

export const NARRATION_TABLE = 'narration';
export const ACTS_PER_CALL = 10;
export const WAYS_PER_CELL = 2;
const DIRS = ['you', 'them'];

// The acts a first night reaches for, written first.
const FIRST = [
  'Kiss', 'Grope Breasts', 'Tease Nipples', 'Suck Nipple', 'Lick Nipple', 'Rub Pussy', 'Finger Pussy', 'Rub Clit', 'Lick Pussy',
  'Suck Clit', 'Grip Cock', 'Stroke Shaft', 'Pump Shaft', 'Lick Cock', 'Suck Cock', 'Deepthroat', 'Take Cock Between Lips',
  'Enter Pussy', 'Push Cock In', 'Fuck Pussy', 'Take Cock', 'Ride Cock', 'Deep Stroke', 'Rabbitfuck', 'Enter Mouth', 'Fuck Mouth',
  'Enter Ass', 'Fuck Ass', 'Take Cock In Ass', 'Finger Ass', 'Lick Ass', 'Ride Face', 'Fuck Tits', 'Spank', 'Pull Hair',
  'Suck Neck', 'Bite Shoulder', 'Fondle Balls', 'Lick Balls', 'Trib', 'Frot', 'Pull Out', 'Pull Off',
];

export function actCells(acts) {
  const names = Object.keys(acts || {});
  const ordered = [...FIRST.filter((n) => names.includes(n)), ...names.filter((n) => !FIRST.includes(n))];
  const partsOf = (name) => [...((acts[name] || {})['subject parts'] || []), ...((acts[name] || {})['object parts'] || [])];
  return ordered.flatMap((name) => DIRS.map((dir) => ({ name, dir, id: `${name}|${dir}`, parts: partsOf(name) })));
}

const WAYS = ['first way', 'second way'];
const HOW = { you: 'the one playing does it to the other', them: 'the other does it to the one playing' };

export function buildNarrationPrompt(persona, cells) {
  return [
    persona,
    '',
    'TASK',
    'In this world, sex is told as it happens. For each numbered act below - as the engine of this world names it - write',
    'how it is told the moment it happens, to the one playing, as "you".',
    '',
    'RULES',
    '- One line for every numbered act, in this exact form, numbered like the act:',
    '  N. <how it is told>',
    '- Two sentences, present tense, lewd and explicit: the act itself, named plainly, then how it feels or sounds in that moment. Nothing softened or skipped.',
    '- The one playing is you, your and yours, written plainly, never in braces.',
    '- The other is only ever {name}, {them} and {their} ({Name} or {Their} to begin a sentence, never {Them}) - never they, he, she, him, his or her, and never a name of your own.',
    '- Name only the parts the act itself uses; never say what either of them looks like or wears, or where they are.',
    '- The same act asked a second way gets different words.',
    '- Plain prose: no labels, no quotation marks around a line, no brackets.',
    '',
    'ACTS',
    ...cells.flatMap((c) => WAYS.slice(0, WAYS_PER_CELL).map((way) => `${c.name} - ${HOW[c.dir]} (${way})`)).map((l, i) => `${i + 1}. ${l}`),
  ].join('\n');
}

const NUMBERED = /^\s*(\d+)\s*[.):-]?\s*(.*)$/;
// {Them} is never right: an object never begins a sentence, and the model
// writes it for "they", which the engine's pronouns cannot conjugate.
const ALLOWED = new Set(['name', 'them', 'their', 'theirs', 'Name', 'Their', 'Theirs']);
const GENDERED = /\b(he|she|him|his|her|hers|himself|herself)\b/i;
const THEY = /\bthey\b/i;
const PLAYER = /\b(you|your|yours|yourself)\b/i;
const OTHER = /\{(name|Name|them|their|Their|theirs|Theirs)\}/;
// The parts not every body has. The bank plays with every partner, so a line
// names one only where its act uses it (a nipple is not a breast); every word
// for a part counts as the part.
const SEXED = [
  [/\b(pussy|pussies|cunt|clit|clitoris|vagina|vulva|labia|folds|slit|g-spot|front hole)\b/i, ['vagina', 'clitoris']],
  [/\b(cock|cocks|dick|dicks|penis|shaft|frenulum|foreskin|balls|testicles|pre-?cum|pre-?come)\b/i, ['penis', 'balls']],
  [/\b(breasts?|tits?|boobs?|cleavage)\b/i, ['breasts']],
];
const onlyItsParts = (text, parts) => SEXED.every(([re, own]) => !re.test(text) || own.some((p) => parts.includes(p)));

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();

// What the model gets wrong in ways that are safe to put right: braces around
// the player's own words; a plain their or theirs, which in a line of two
// people is only ever the other's; and theirs however it is spelled - {their}s,
// or a {their} with no noun after it ("against {their}."), which would read
// "against his." (Matched token by token: no lookbehind, which Safari before
// 16.4 cannot parse.)
export function mendLine(text) {
  return String(text == null ? '' : text)
    .replace(/\{(you|your|yours|yourself)\}/gi, (_, w) => w)
    .replace(/\{[^}]*\}s?|\b[Tt]heirs?\b/g, (m, at, all) => {
      if (m[0] !== '{') return `{${m}}`;
      if (/^\{[Tt]heir\}s$/.test(m)) return `{${m.slice(1, -2)}s}`;
      if (/^\{[Tt]heir\}$/.test(m) && /^(?:$|[.,;:!?)])/.test(all.slice(at + m.length))) return `{${m.slice(1, -1)}s}`;
      return m;
    });
}

// A line fit for a way of an act: its placeholders the allowed ones, no he,
// she or they, the player there as you or your, the other there when the
// other does it, and - given the act's parts - no part the act does not use.
export function validLine(text, dir, faultsIn = defaultFaults, parts = null) {
  if (typeof text !== 'string' || !text.trim() || text.length > 320) return false;
  if (/[<>[\]]/.test(text)) return false;
  const tokens = [...text.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
  if (tokens.some((t) => !ALLOWED.has(t)) || /[{}]/.test(text.replace(/\{[^}]*\}/g, ''))) return false;
  if (GENDERED.test(text) || THEY.test(text)) return false;
  if (dir === 'you' && !PLAYER.test(text)) return false;
  if (dir === 'them' && !OTHER.test(text)) return false;
  if (Array.isArray(parts) && !onlyItsParts(text, parts)) return false;
  return faultsIn(text, 'body').length === 0;
}

// A reply, back into its cells: cell id -> up to two lines.
export function parseNarration(reply, cells, faultsIn = defaultFaults) {
  const out = {};
  for (const raw of String(reply == null ? '' : reply).split(/\r?\n/)) {
    const m = NUMBERED.exec(raw.replace(/\*\*/g, ''));
    if (!m) continue;
    const n = Number(m[1]);
    const c = cells[Math.floor((n - 1) / WAYS_PER_CELL)];
    if (!c || !Number.isInteger(n) || n < 1) continue;
    const text = mendLine(clean(m[2]));
    if (!validLine(text, c.dir, faultsIn, c.parts)) continue;
    const list = out[c.id] || (out[c.id] = []);
    if (list.length < WAYS_PER_CELL && !list.includes(text)) list.push(text);
  }
  return out;
}

export const emptyNarrationLog = () => ({ v: 1, acts: {} });

// What the store gave back, made safe: every line held to the same rule.
export function readNarrationLog(raw, faultsIn = defaultFaults) {
  const log = emptyNarrationLog();
  if (!raw || typeof raw !== 'object') return log;
  for (const [id, lines] of Object.entries(raw.acts || {})) {
    const dir = String(id).split('|').pop();
    if (!DIRS.includes(dir) || !Array.isArray(lines)) continue;
    const ok = lines.filter((l) => validLine(l, dir, faultsIn)).slice(0, WAYS_PER_CELL);
    if (ok.length) log.acts[id] = ok;
  }
  return log;
}

export const missingActCells = (log, acts) => actCells(acts).filter((c) => !((log && log.acts && log.acts[c.id]) || []).length);

const usable = (model) => !!model && typeof model.ask === 'function' && (typeof model.available !== 'function' || model.available());

// Ten acts a call; a batch that came back short is asked once more for what
// it did not bring; saved after every batch, so a reload finishes the rest.
export async function writeNarration({ model, persona, log, acts, faultsIn = defaultFaults, save = async () => {}, perCall = ACTS_PER_CALL }) {
  if (!usable(model)) return 0;
  const todo = missingActCells(log, acts);
  let written = 0;
  for (let i = 0; i < todo.length; i += perCall) {
    let batch = todo.slice(i, i + perCall);
    for (let attempt = 0; attempt < 2 && batch.length; attempt += 1) {
      const text = typeof persona === 'function' ? persona() : persona;
      let reply = '';
      try {
        reply = await model.ask(buildNarrationPrompt(text, batch), { maxTokens: 200 + batch.length * WAYS_PER_CELL * 90, temperature: 0.9, background: true });
      } catch { reply = ''; }
      const got = parseNarration(reply, batch, faultsIn);
      for (const c of batch) if (got[c.id] && got[c.id].length) { log.acts[c.id] = got[c.id]; written += 1; }
      batch = batch.filter((c) => !(log.acts[c.id] || []).length);
    }
    try { await save(log); } catch { /* the next batch saves the whole log again */ }
  }
  return written;
}

// The page's narration: one world a page, so one log.
const state = { worldId: null, log: emptyNarrationLog(), busy: null };

export function useNarrationLog(worldId, log) {
  state.worldId = worldId;
  state.log = log && log.acts ? log : emptyNarrationLog();
  state.busy = null;
}

export const narrationStatus = () => ({ worldId: state.worldId, written: Object.keys(state.log.acts).length });

// A line for the narration (world/narration.mjs), in the engine's pronoun
// keys that fillWords fills: {them} -> {po}, {their} -> {pp}, {theirs} -> {pq}.
export function narrationWords(actName, dir, random = Math.random) {
  if (!DIRS.includes(dir)) return null;
  const lines = state.log.acts[`${actName}|${dir}`];
  if (!lines || !lines.length) return null;
  const line = lines[Math.min(lines.length - 1, Math.floor(random() * lines.length))];
  return line.replace(/\{Name\}/g, '{name}').replace(/\{them\}/g, '{po}').replace(/\{Them\}/g, '{Po}')
    .replace(/\{their\}/g, '{pp}').replace(/\{Their\}/g, '{Pp}').replace(/\{theirs\}/g, '{pq}').replace(/\{Theirs\}/g, '{Pq}');
}

const saveTo = (store, worldId) => (log) => (store && worldId ? store.saveTable(worldId, NARRATION_TABLE, log) : Promise.resolve());

// Written in the background, once: a second ask while one runs waits on it.
export function writeTheNarration({ model, persona, store, worldId, acts, faultsIn = defaultFaults }) {
  if (state.worldId !== worldId) useNarrationLog(worldId, emptyNarrationLog());
  if (state.busy) return state.busy;
  if (!missingActCells(state.log, acts).length) return Promise.resolve(0);
  const log = state.log;
  const job = writeNarration({ model, persona, log, acts, faultsIn, save: saveTo(store, worldId) })
    .catch((err) => { console.warn('Obscura: the narration could not be written', err); return 0; })
    .finally(() => { if (state.busy === job) state.busy = null; });
  state.busy = job;
  return job;
}

// A page load: the narration written for this world, from the store.
export async function restoreNarration({ store, worldId, faultsIn = defaultFaults }) {
  if (!worldId) return null;
  let raw = null;
  try { raw = store ? await store.loadTable(worldId, NARRATION_TABLE) : null; } catch { raw = null; }
  useNarrationLog(worldId, readNarrationLog(raw, faultsIn));
  return narrationStatus();
}
