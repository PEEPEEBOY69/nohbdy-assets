// world/textbank.mjs — what people here send each other, written ahead.
//
// Texting is talk at a distance, and like talk it is not a model call: a text
// and its answer are picked from a bank written for the world in the
// background, the first time the player has someone's number
// (world/texting.mjs). The cells are the talk bank's - what is sent, the
// footing, how it goes - for what can be sent: a friendly message, a
// compliment, a flirt, a sext, a picture of yourself, a request for one of
// theirs, a date, a night. A stranger has no number to text, and a rival
// never takes any of it well. The people who text first get cells of their
// own, written in their own call, because theirs is a message with nothing
// sent before it. The lines built in here answer until the world's land.
import {
  PAIRS_PER_CELL, MAX_HALF, FOOTING, parsePairs, cleanHalf, validHalf, splitPair,
} from './talkbank.mjs';
import { faultsIn as defaultFaults } from './persona.mjs';
import { PEOPLE_BODIES, namesUnknownBody } from './bodyrule.mjs';
export { namesUnknownBody };

export const TEXT_ACTIONS = ['chat', 'compliment', 'flirt', 'sext', 'sendpic', 'askpic', 'meet', 'proposition'];
export const TEXT_TIERS = ['acquaintance', 'friend', 'close', 'romantic', 'rival'];
// Only these can go badly; a message and a compliment always land.
export const TEXT_TWO_WAY = ['flirt', 'sext', 'sendpic', 'askpic', 'meet', 'proposition'];
export const FIRST = 'first';
export const TEXT_CELLS_PER_CALL = 8;
export const TEXT_LOG = '__texts';
export const textCellId = (action, tier, outcome) => `${action}|${tier}|${outcome}`;

// The exchanges footing by footing, then the first texts: 64 exchanges are
// eight full calls, and the first texts, in a form of their own, one more.
export function textCells() {
  const cells = [];
  for (const tier of TEXT_TIERS) {
    for (const action of TEXT_ACTIONS) {
      const outcomes = TEXT_TWO_WAY.includes(action) ? (tier === 'rival' ? ['bad'] : ['good', 'bad']) : ['good'];
      for (const outcome of outcomes) cells.push({ action, tier, outcome, id: textCellId(action, tier, outcome) });
    }
  }
  // the engine's phone_initiators are friendly or admiring: a rival never texts first
  for (const tier of TEXT_TIERS.filter((t) => t !== 'rival')) {
    cells.push({ action: FIRST, tier, outcome: 'good', id: textCellId(FIRST, tier, 'good') });
  }
  return cells;
}
const CELL_IDS = new Set(textCells().map((c) => c.id));

const DOING = {
  chat: 'sending a friendly message to {who}',
  compliment: 'sending a compliment to {who}',
  flirt: 'flirting by message with {who}',
  sext: 'sexting {who}: saying in filthy detail what they want to do to them',
  sendpic: 'sending {who} a naked picture of themself',
  askpic: 'asking {who} for a naked picture',
  meet: 'asking {who} out on a date',
  proposition: 'asking {who} to come over for sex tonight',
  [FIRST]: 'a person here messages {who} first, out of nowhere',
};
const HOW = {
  chat: { good: 'they answer warmly' },
  compliment: { good: 'they like hearing it' },
  flirt: { good: 'they flirt back', bad: 'they shut it down' },
  sext: { good: 'they sext back, just as filthy', bad: 'they want none of it' },
  sendpic: { good: 'they love what they see and say so', bad: 'they did not want it' },
  askpic: { good: 'they send one and say what it shows', bad: 'they refuse' },
  meet: { good: 'they say yes', bad: 'they say no' },
  proposition: { good: 'they say yes, tonight', bad: 'they turn it down' },
};
const WAYS = ['first way', 'second way', 'third way'];
const momentLine = (c) => {
  const doing = DOING[c.action].replace('{who}', FOOTING[c.tier] || FOOTING.acquaintance);
  return c.action === FIRST ? doing : `${doing} - ${HOW[c.action][c.outcome]}`;
};
const items = (cells) => cells.flatMap((c) => WAYS.slice(0, PAIRS_PER_CELL).map((way) => `${momentLine(c)} (${way})`))
  .map((line, i) => `${i + 1}. ${line}`);

// The bank is the world's, answered by people of every body to one player:
// the real model wrote "i am wet for you" and "your cock deep in my throat"
// for everyone, "[image]" for every picture, and "in a meeting" in the ice age
// (probed 2026-09-30). So the people never name their own parts, the player
// never names theirs, and only the player's body - which the writer is told -
// is named.
const OF_THIS_WORLD = '- Messages sound like this world and its time: nothing of offices, meetings, reports or phones unless this world has them.';
const NO_GARMENTS = '- Never name a garment: clothes are only ever "clothes".';
const exchangeRules = () => [
  '- Reply with ONLY one line for every numbered moment, in this exact form, numbered like the moment:',
  '  N. you: <the message sent> || them: <the answer>',
  '- Each line holds exactly one pair: one you: and one them:.',
  '- The same moment asked a second or third way gets different words each time.',
  `- Each part is one message of one to three short sentences, under ${MAX_HALF - 20} characters, in the voice of this world's people.`,
  '- Where a moment is sexual, say it plainly and lewdly: bodies, wants and acts named as they are.',
  PEOPLE_BODIES,
  '- The one sending never names the other\'s body parts: only their own, and what they want to do.',
  '- For a picture, the you: part is the words sent with it, never the picture itself.',
  OF_THIS_WORLD,
  NO_GARMENTS,
  '- Words only: no names, no narration, no quotation marks, no brackets.',
];
const firstRules = () => [
  '- Reply with ONLY one line for every numbered moment, in this exact form, numbered like the moment:',
  '  N. them: <the message they send>',
  '- The same moment asked a second or third way gets different words each time.',
  `- Each message is one to three short sentences, under ${MAX_HALF - 20} characters, in the voice of this world's people.`,
  '- Between people romantically involved, a message may be as lewd as they are with each other; say it plainly.',
  PEOPLE_BODIES,
  OF_THIS_WORLD,
  NO_GARMENTS,
  '- Words only: no names, no narration, no quotation marks, no brackets.',
];


// One call's prompt. A call is all exchanges or all first texts, never both
// (textCells orders them so). sender: the player's body (world/momentbank.mjs
// bodyOf), where it is known.
export function buildTextPrompt(persona, cells, { sender = '' } = {}) {
  const first = cells.length > 0 && cells.every((c) => c.action === FIRST);
  return [
    persona,
    '',
    'TASK',
    first
      ? 'The people who live here send messages to someone new to this world, the way people here reach each other when they are apart. For each numbered moment below, write the message they send.'
      : 'Someone new to this world sends messages to the people who live here, the way people here reach each other when they are apart. For each numbered moment below, write the message they send and the answer that comes back.',
    ...(sender ? [first ? `The one they message is ${sender}.` : `The one sending is ${sender}.`] : []),
    '',
    'RULES',
    ...(first ? firstRules() : exchangeRules()),
    '',
    'MOMENTS',
    ...items(cells),
  ].join('\n');
}

const NUMBERED = /^\s*(\d+)\s*[.):-]?\s*([\s\S]*)$/;
const THEM_ONLY = /^\s*them\s*:\s*([\s\S]*)$/i;

// A reply, back into its cells: cell id -> up to three lines. An exchange is
// read the way the talk bank reads a pair; a first text is the message alone.
const PICTURE_MARK = /\byou\s*:\s*\[[^\]]*\]/i;
export const PICTURE_SENT = 'Sent you a picture.';

export function parseTexts(reply, cells, faultsIn = defaultFaults) {
  const count = cells.length * PAIRS_PER_CELL;
  const cellOf = (n) => cells[Math.floor((Number(n) - 1) / PAIRS_PER_CELL)];
  // a picture the model marked in brackets ("[image]") is a picture sent
  const text = String(reply == null ? '' : reply).split(/\r?\n/).map((line) => {
    const m = NUMBERED.exec(line.replace(/\*\*/g, ''));
    const c = m ? cellOf(m[1]) : null;
    return c && c.action === 'sendpic' ? line.replace(PICTURE_MARK, `you: ${PICTURE_SENT}`) : line;
  }).join('\n');
  const out = {};
  const add = (id, line) => {
    const list = out[id] || (out[id] = []);
    if (list.length < PAIRS_PER_CELL && !list.includes(line)) list.push(line);
  };
  for (const [n, pairs] of Object.entries(parsePairs(text, count, faultsIn))) {
    const c = cellOf(n);
    if (!c || c.action === FIRST) continue;
    for (const p of pairs) {
      const { you, them } = splitPair(p);
      if (!namesUnknownBody(you, them)) add(c.id, p);
    }
  }
  for (const raw of text.split(/\r?\n/)) {
    const m = NUMBERED.exec(raw.replace(/\*\*/g, ''));
    if (!m) continue;
    const n = Number(m[1]);
    if (!Number.isInteger(n) || n < 1 || n > count) continue;
    const c = cellOf(n);
    const t = c && c.action === FIRST ? THEM_ONLY.exec(m[2]) : null;
    if (!t) continue;
    const message = cleanHalf(t[1]);
    if (validHalf(message, faultsIn) && !namesUnknownBody('', message)) add(c.id, message);
  }
  return out;
}

// Until the world's lines land, and wherever they fail: plain, no names,
// nothing of any one world.
export const TEXT_BUILT_IN = {
  'chat|good': [
    "you: Hey. How's your day been? || them: Long. Better now that you asked.",
    "you: What are you up to? || them: Not much. Glad of the distraction.",
    "you: Thought I'd say hi. || them: Hi yourself. Nice to hear from you.",
  ],
  'compliment|good': [
    'you: Just so you know, you made my day earlier. || them: You are sweet. Keep that up.',
    "you: I like the way you think. || them: Careful, I'll get a big head.",
    'you: You looked good today. Really good. || them: I noticed you noticing.',
  ],
  'flirt|good': [
    "you: Can't stop thinking about you. || them: Good. I'd hate to be the only one.",
    "you: What are you wearing right now? || them: Wouldn't you like to know. Come and find out.",
    "you: You're trouble, you know that? || them: The fun kind. You'll see.",
  ],
  'flirt|bad': [
    "you: Can't stop thinking about you. || them: That sounds like your problem.",
    "you: What are you wearing right now? || them: Don't text me that.",
    "you: You're trouble, you know that? || them: And you're reading far too much into things.",
  ],
  'sext|good': [
    "you: I keep thinking about pinning you down and taking my time with you. || them: Stop. I'm touching myself reading this. Keep going.",
    "you: I want my mouth on you. Everywhere. || them: Tell me where you'd start. Slowly.",
    "you: Tonight I'm going to fuck you until you can't walk. || them: Promises. Make me beg for it first.",
  ],
  'sext|bad': [
    "you: I keep thinking about pinning you down and taking my time with you. || them: Whoa. No. We're not like that.",
    'you: I want my mouth on you. Everywhere. || them: That is way too much. Stop.',
    "you: Tonight I'm going to fuck you until you can't walk. || them: Don't ever send me something like that again.",
  ],
  'sendpic|good': [
    "you: Sent you something. Don't open it in company. || them: Fuck. You look incredible. Send more.",
    "you: Thinking of you. Here's proof. || them: I've looked at it ten times already. You're unreal.",
    'you: All yours, if you want it. || them: I want it. Every inch of it.',
  ],
  'sendpic|bad': [
    "you: Sent you something. Don't open it in company. || them: I didn't ask for that.",
    "you: Thinking of you. Here's proof. || them: Delete that. Seriously.",
    "you: All yours, if you want it. || them: I don't. Please don't send me those.",
  ],
  'askpic|good': [
    'you: Send me something to think about tonight. || them: Here. Just me, nothing on, on my bed. Your turn to think.',
    "you: I want to see you. All of you. || them: Fine. That's me fresh from the bath, still dripping. Nobody else sees it.",
    "you: Show me what I'm missing. || them: This is what you're missing. Hurry up and come get it.",
  ],
  'askpic|bad': [
    'you: Send me something to think about tonight. || them: Not happening.',
    "you: I want to see you. All of you. || them: You'll have to earn that. You haven't.",
    "you: Show me what I'm missing. || them: Nothing you're getting.",
  ],
  'meet|good': [
    "you: Let me take you out. || them: Yes. I've been waiting for you to ask.",
    "you: Dinner. You and me. || them: Deal. Don't be late.",
    "you: I want to see you properly. Out somewhere. || them: I'd like that. A lot.",
  ],
  'meet|bad': [
    "you: Let me take you out. || them: I don't think so. Sorry.",
    "you: Dinner. You and me. || them: I'm busy. For a while.",
    "you: I want to see you properly. Out somewhere. || them: Let's keep things how they are.",
  ],
  'proposition|good': [
    "you: Come over tonight. I want you in my bed. || them: I'll be there. Don't bother getting dressed.",
    "you: I need you. Tonight. || them: Then you'll have me. Tonight.",
    "you: My place, tonight. We both know why. || them: We do. I'm coming.",
  ],
  'proposition|bad': [
    "you: Come over tonight. I want you in my bed. || them: No. That's not what this is.",
    'you: I need you. Tonight. || them: Find someone else.',
    "you: My place, tonight. We both know why. || them: I really don't. And no.",
  ],
  'first|good': [
    'Hey. You busy? I was thinking about you.',
    'Random, but I saw something today that made me think of you.',
    "What are you up to? I'm bored out of my mind.",
  ],
};

// The log kept beside the world in the store: world: {cellId: [lines]}.
export const emptyTextLog = () => ({ world: {} });

const IS_PAIR = (p) => typeof p === 'string' && p.startsWith('you: ') && p.includes(' || them: ');
const IS_MESSAGE = (p) => typeof p === 'string' && p.trim().length > 0 && p.length <= MAX_HALF && !p.includes('||');

// What the store gave back, made safe: only cells the bank has, only lines of
// their cell's form, three a cell.
export function readTextLog(raw) {
  const log = emptyTextLog();
  if (!raw || typeof raw !== 'object') return log;
  for (const [id, v] of Object.entries(raw.world || {})) {
    if (!CELL_IDS.has(id) || !Array.isArray(v)) continue;
    const ok = id.startsWith(`${FIRST}|`) ? IS_MESSAGE : IS_PAIR;
    const lines = v.filter(ok).slice(0, PAIRS_PER_CELL);
    if (lines.length) log.world[id] = lines;
  }
  return log;
}

export const missingTextCells = (log) => textCells().filter((c) => !(((log && log.world) || {})[c.id] || []).length);

// The world's text at this footing, else at any footing, else the lines built
// in; not one just sent while there are others.
export function pickText({ log, action, tier, outcome, avoid = [], random = Math.random }) {
  const world = (log && log.world) || {};
  const read = (raw) => (action === FIRST ? { you: '', them: raw } : splitPair(raw));
  const choose = (pool, source) => {
    const fresh = pool.filter((p) => !avoid.includes(p));
    const use = fresh.length ? fresh : pool;
    const raw = use[Math.min(use.length - 1, Math.floor(random() * use.length))];
    return { ...read(raw), raw, source };
  };
  const any = textCells().filter((c) => c.action === action && c.outcome === outcome).map((c) => c.id);
  for (const ids of [[textCellId(action, tier, outcome)], any]) {
    const pool = ids.flatMap((id) => world[id] || []);
    if (pool.length) return choose(pool, 'world');
  }
  return choose(TEXT_BUILT_IN[`${action}|${outcome}`] || TEXT_BUILT_IN[`${action}|good`] || TEXT_BUILT_IN['chat|good'], 'built-in');
}

const usable = (model) => !!model && typeof model.ask === 'function' && (typeof model.available !== 'function' || model.available());

// The bank, eight cells a call, the first texts in a call of their own; a
// batch that came back short is asked once more for what it did not bring.
// Saved after every batch, so a reload finishes what is missing.
export async function writeTextBank({
  model, persona, log, save = async () => {}, onBatch = () => {}, faultsIn = defaultFaults, perCall = TEXT_CELLS_PER_CALL, sender = '',
}) {
  if (!usable(model)) return 0;
  const todo = missingTextCells(log);
  const groups = [todo.filter((c) => c.action !== FIRST), todo.filter((c) => c.action === FIRST)];
  let written = 0;
  for (const group of groups) {
    for (let i = 0; i < group.length; i += perCall) {
      let batch = group.slice(i, i + perCall);
      for (let attempt = 0; attempt < 2 && batch.length; attempt += 1) {
        const text = typeof persona === 'function' ? persona() : persona;
        let reply = '';
        try {
          reply = await model.ask(buildTextPrompt(text, batch, { sender }),
            { maxTokens: 200 + batch.length * PAIRS_PER_CELL * 70, temperature: 0.9, background: true });
        } catch { reply = ''; }
        const got = parseTexts(reply, batch, faultsIn);
        for (const c of batch) {
          if (got[c.id] && got[c.id].length) { log.world[c.id] = got[c.id]; written += 1; }
        }
        batch = batch.filter((c) => !(log.world[c.id] || []).length);
      }
      try { await save(log); } catch { /* the next batch saves the whole log again */ }
      try { onBatch(log); } catch { /* a listener is not the bank's failure */ }
    }
  }
  return written;
}
