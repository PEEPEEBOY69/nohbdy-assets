// world/persona.mjs — who is writing, and how it is allowed to write.
//
// Every prompt in slice 2b opened with WORLD PREMISE and a task. Nothing said
// what the model WAS, so it fell back on its defaults: stage directions in
// asterisks, meta asides about the scene, headings and bullet points in fields
// that are meant to be a single line of prose, and the chassis's own college
// vocabulary leaking back in after the lexicon had just replaced it.
//
// None of that is fixable per-call. It is a standing instruction, so it lives
// in one place and every call carries it.
//
// THE LEXICON IS PART OF THE PERSONA, and that is the point. The setting's
// words are generated (world/lexicon.mjs); handing them to the model here is
// what stops it writing "dorm" into a world that calls them habs. Substitution
// fixes the chassis's OWN prose; this fixes the prose the model writes next.

// Output discipline. Each line is a failure that was worth naming: a model told
// only "write a description" produces every one of them.
export const OUTPUT_RULES = [
  'Write as though the world is real and already happening.',
  'Never write stage directions or actions in asterisks, brackets or italics.',
  'Never step outside the story: no notes, no asides, no explaining your choices.',
  'Never mention prompts, instructions, models, tokens, fields, tables or the game as software.',
  'Never call anyone "the player", "the user" or "the protagonist".',
  'No headings, no bullet points, no markdown, no quotation marks around the whole answer.',
  'Do not begin with "Here is", "Sure", "Certainly" or any other preamble.',
];

// Only meaningful when a VOCABULARY block is actually present. Included
// unconditionally it points the model at a section that is not there, which is
// worse than saying nothing.
export const VOCABULARY_RULE =
  'Use the words this world uses, listed under VOCABULARY, not the ones a school would use.';

export const PERSONA_LINES = [
  'You are the writer of a single, specific world, and you know it from the inside.',
  'You are not a narrator describing a game. You are the record of a place that exists.',
  'You write plainly and concretely. Specific detail over adjectives, and never more words than the thing needs.',
];

// The lexicon lines the model most needs, in the order it will need them. The
// full lexicon is 17 words and the budget is tight, so this keeps the ones that
// carry the setting and drops the ones that rarely appear in a short field.
export const VOCABULARY_KEYS = [
  ['institution', 'the place itself'],
  ['institution_kind', 'what kind of place it is'],
  ['district', 'its grounds'],
  ['division', 'a group people belong to'],
  ['member', 'an ordinary person here'],
  ['mentor', 'someone who teaches or directs'],
  ['session', 'a scheduled activity'],
  ['quarters', 'where people sleep'],
];

export function vocabularyBlock(lexicon = {}) {
  const lines = [];
  for (const [key, gloss] of VOCABULARY_KEYS) {
    const word = lexicon[key];
    if (typeof word === 'string' && word.trim()) lines.push(`${word.trim()} — ${gloss}`);
  }
  return lines;
}

// Assembled once per build and reused, because it is identical for every call
// and the budget is per-call. CAPS section labels are the house convention: the
// plugin takes one `instruction` string with no role separation, so the labels
// are the only structure the model gets.
export function buildPersona(premise, lexicon = {}, opts = {}) {
  const lines = ['WHO YOU ARE', ...PERSONA_LINES, ''];

  lines.push('WORLD PREMISE');
  lines.push(String(premise || '').trim() || 'an ordinary place with something underneath');
  lines.push('');

  const vocab = vocabularyBlock(lexicon);
  if (vocab.length) {
    lines.push('VOCABULARY');
    lines.push(...vocab);
    lines.push('');
  }

  lines.push('HOW YOU WRITE');
  const rules = vocab.length ? [...OUTPUT_RULES, VOCABULARY_RULE] : OUTPUT_RULES;
  lines.push(...rules.map(r => `- ${r}`));

  if (opts.extra && opts.extra.length) {
    lines.push('', ...opts.extra);
  }
  return lines.join('\n');
}

// Cheap, deterministic checks on what came back. These do not rewrite the
// model's words - they REPORT, so a caller can retry or fall back. Rewriting
// would hide the failure and the next prompt would never improve.
// `scope` matters. Some of these are only faults in a BODY of prose: a place
// legitimately called "Sure Thing Bar" or "Okay Motors" is not an assistant
// preamble, and rejecting it loses a perfectly good name. Checking a short
// name against the body rules was a real false positive, found by a test.
export const REPLY_FAULTS = [
  [/\*[^*\n]{2,}\*/, 'stage direction in asterisks', 'any'],
  [/\b(the (?:player|user)|as an ai|language model|prompt|token limit)\b/i, 'breaks the frame', 'any'],
  [/^\s*(here(?:'s| is)|sure|certainly|of course|okay|ok)\b/i, 'assistant preamble', 'body'],
  [/^\s*#{1,6}\s/m, 'markdown heading', 'body'],
  [/^\s*[-*]\s+\S/m, 'bullet list', 'body'],
];

// kind: 'body' (default) checks everything; 'name' checks only the faults that
// are wrong anywhere.
export function faultsIn(text, kind = 'body') {
  const s = String(text == null ? '' : text);
  if (!s.trim()) return [];
  const found = [];
  for (const [re, label, scope] of REPLY_FAULTS) {
    if (kind === 'name' && scope !== 'any') continue;
    if (re.test(s)) found.push(label);
  }
  return found;
}

// Strips the shapes that are pure packaging rather than content: a wrapping
// pair of quotes, a leading "Here is ...:" line. Anything deeper is a fault to
// report, not to paper over.
// Same scoping as faultsIn, and for the same reason. Stripping the preamble
// off a NAME turns "Okay Motors" into "Motors" - the business is renamed by a
// rule meant for prose. A name only ever gets its wrapping quotes removed.
export function stripPackaging(text, kind = 'body') {
  let s = String(text == null ? '' : text).trim();
  if (kind !== 'name') {
    s = s.replace(/^(?:here(?:'s| is)[^:\n]{0,40}:|sure[,!]?|certainly[,!]?|okay[,!]?)\s*/i, '');
  }
  s = s.trim();
  if (s.length > 1 && /^["'“‘]/.test(s) && /["'”’]$/.test(s)) {
    const inner = s.slice(1, -1);
    if (!/["'“”]/.test(inner)) s = inner;
  }
  return s.trim();
}
