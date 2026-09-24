// world/lexicon.mjs — the setting's own vocabulary, substituted into passage text.
//
// The chassis is a college simulator, and renaming it to a different FIXED
// setting would just be a different skin. This project's whole premise is that
// the player names the world, so the vocabulary has to be generated too: a
// cyberpunk premise should call them runners and handlers, a naval one crew and
// officers. Same machinery, different words.
//
// WHY SUBSTITUTION AND NOT A REWRITE. There are 286 passages carrying ~1,300
// occurrences of college vocabulary in prose. Rewriting them by hand is a
// one-time cost that buys one setting; substituting at render time buys every
// setting, and keeps the chassis diffable against the original.
//
// THE HAZARD, MEASURED. Of 1,613 `class` occurrences in passage source, 1,433
// are HTML `class="..."` attributes and 108 are the noun. A blind
// find-and-replace corrupts 1,433 attributes and destroys the UI. So this is
// markup-aware: it substitutes only in PROSE and never inside a tag, a macro,
// a variable name, or a link target.
//
// Link targets were the danger that would have sunk this. Measured: 3 piped
// links ([[text|Target]], display text safe) and ZERO bare links ([[Target]])
// contain any of these words, so no passage name is reachable by substitution.
// The pipe split is implemented anyway, because a future passage could add one.
import { parseModelJson } from './safejson.mjs';

// The neutral default. NOT college vocabulary: if no model generated a lexicon,
// the game should still read as a generic institution rather than a campus,
// because "make it ours" is the point. A generated lexicon overrides all of it.
export const DEFAULT_LEXICON = {
  // TWO institution words, because the chassis uses both and they are not
  // interchangeable. `institution` is the proper name, standing in for the
  // original's brand ("F-K University"). `institution_kind` is the common noun
  // that fills slots like "Renowned university" or "a college" - substituting a
  // proper name there produces "Renowned the Grid", which is how this was first
  // measured and why the two are separate.
  institution: 'the Institute',
  institution_kind: 'institute',
  district: 'grounds',
  division: 'division',
  member: 'member',
  mentor: 'mentor',
  session: 'session',
  program: 'track',
  module: 'module',
  quarters: 'quarters',
  roomshare: 'bunkmate',
  assessment: 'assessment',
  standing: 'standing',
  commons: 'commons',
  prep: 'prep',
  staff: 'staff',
  initiate: 'initiate',
};

// Every term the chassis uses, mapped to a lexicon key. Order matters: longer
// phrases first, so "greek house" wins over "house" and "rush week" over
// "week". Each entry is [pattern, lexiconKey, {plural}] where the pattern is
// matched case-insensitively on word boundaries and the replacement inherits
// the original's capitalisation.
export const TERMS = [
  // The original's brand, which is a proper name and takes the proper-name key.
  ['f-k university', 'institution'],
  ['f-k', 'institution'],
  ['greek house', 'division', { plural: 'greek houses' }],
  ['greekhouse', 'division', { plural: 'greekhouses' }],
  ['greek life', 'division'],
  ['greek row', 'district'],
  ['rush week', 'session'],
  ['dormitory', 'quarters', { plural: 'dormitories' }],
  ['classroom', 'session', { plural: 'classrooms' }],
  ['roommate', 'roomshare', { plural: 'roommates' }],
  ['professor', 'mentor', { plural: 'professors' }],
  ['fraternity', 'division', { plural: 'fraternities' }],
  ['sorority', 'division', { plural: 'sororities' }],
  ['university', 'institution_kind', { plural: 'universities' }],
  ['homework', 'prep'],
  ['student', 'member', { plural: 'students' }],
  ['college', 'institution_kind', { plural: 'colleges' }],
  ['faculty', 'staff'],
  ['campus', 'district', { plural: 'campuses' }],
  ['course', 'module', { plural: 'courses' }],
  ['school', 'institution_kind', { plural: 'schools' }],
  ['pledge', 'initiate', { plural: 'pledges' }],
  ['lecture', 'session', { plural: 'lectures' }],
  ['degree', 'program', { plural: 'degrees' }],
  ['major', 'program', { plural: 'majors' }],
  ['dorm', 'quarters', { plural: 'dorms' }],
  ['class', 'session', { plural: 'classes' }],
  ['exam', 'assessment', { plural: 'exams' }],
  ['frat', 'division', { plural: 'frats' }],
  ['quad', 'commons', { plural: 'quads' }],
  ['gpa', 'standing'],
];

// Carries the original's case: lower, UPPER, Title. Mixed case falls back to
// the replacement as written, which is what a proper noun wants.
// A replacement may carry its own leading article ("the Grid"), written
// lower-case on purpose. Title-casing it mid-sentence gives "welcome to The
// Grid", so capitalisation has to know where the sentence starts.
export function carriesArticle(word) {
  return /^(the|a|an)\s/i.test(String(word || ''));
}

export function atSentenceStart(full, offset) {
  if (!offset) return true;
  const before = String(full).slice(0, offset);
  return /(^|[.!?:;]|\n)\s*$/.test(before);
}

// Decides the replacement's case from the ORIGINAL's position, not its
// capitals. The original's capital often comes from being a proper adjective
// - "Greek house", "F-K University" - and inheriting it gives "at the
// Syndicate" mid-sentence. The lexicon already encodes what is a proper noun
// by how it writes the word ("the Grid" keeps its G, "syndicate" does not), so
// the word is used as authored and only position can capitalise it.
export function caseFor(full, offset, original, replacement) {
  if (original === original.toUpperCase() && /[A-Z]{2}/.test(original)) {
    return replacement.toUpperCase();
  }
  if (atSentenceStart(full, offset)) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function matchCase(original, replacement) {
  if (!original) return replacement;
  if (original === original.toUpperCase() && /[A-Z]{2}/.test(original)) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

// Naive-but-adequate pluralisation for the replacement side. The terms are all
// ordinary English nouns chosen for the default lexicon, and a generated
// lexicon supplies its own words - so this only has to not embarrass itself.
export function pluralise(word) {
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  if (/(s|sh|ch|x|z)$/i.test(word)) return word + 'es';
  return word + 's';
}

// Splits passage source into PROSE and CODE segments. Only prose is rewritten.
//
// CODE is anything the engine reads as structure:
//   <<macro ...>>   a macro call, including its arguments and any strings
//   <tag ...>       an HTML tag, where class="..." lives
//   $var  _var      a SugarCube variable name
// LINKS are split: [[display|Target]] keeps the target as code and the display
// text as prose. A bare [[Target]] is entirely code - substituting it would
// retarget the link at a passage that does not exist.
export function segment(text) {
  const out = [];
  const src = String(text == null ? '' : text);
  let i = 0;
  let prose = '';
  const flush = () => { if (prose) { out.push({ kind: 'prose', text: prose }); prose = ''; } };
  const code = (s) => { flush(); out.push({ kind: 'code', text: s }); };

  while (i < src.length) {
    // A script or style BODY is code to its closing tag. Scanned as a macro,
    // `<<script>>` ended at its own '>>' and the JavaScript after it was read
    // as prose: Story.get("School") became Story.get("<the world's word>"),
    // and the institution's button opened a passage that does not exist.
    const block = /^(<<script\b[^>]*>>|<script\b[^>]*>|<style\b[^>]*>)/i.exec(src.slice(i, i + 200));
    if (block) {
      const close = block[1].startsWith('<<') ? '<</script>>'
        : block[1].toLowerCase().startsWith('<script') ? '</script>' : '</style>';
      const end = src.toLowerCase().indexOf(close.toLowerCase(), i + block[1].length);
      const stop = end === -1 ? src.length : end + close.length;
      code(src.slice(i, stop));
      i = stop;
      continue;
    }
    // A macro. Scan to the matching '>>' so `<<if $x > 3>>` is not cut short
    // at the bare '>'.
    if (src.startsWith('<<', i)) {
      // Balanced, not first-match. A label can contain a whole macro of its
      // own - `<<button "<<highlight x>>! College">>` - and stopping at the
      // first '>>' cuts that label in half, leaving its tail to be parsed as
      // loose prose. Counting nesting keeps the macro whole.
      let depth = 0;
      let stop = src.length;
      for (let k = i; k < src.length; k++) {
        if (src.startsWith('<<', k)) { depth++; k++; continue; }
        if (src.startsWith('>>', k)) {
          depth--;
          if (!depth) { stop = k + 2; break; }
          k++;
        }
      }
      const macro = src.slice(i, stop);
      // The LABEL of a link or button is the one part of a macro that is
      // prose: the player reads it. `<<button "College">>` in StoryCaption is
      // why the sidebar still said COLLEGE after every passage had been
      // rewritten - the substitution was skipping the whole macro, label and
      // all. Measured: 511 such labels, 12 of them carrying the vocabulary.
      //
      // Only the FIRST quoted argument, and only when it contains no nested
      // macro of its own: `<<button "<<highlight x>>! College">>` has markup
      // inside the label, and splitting on quotes there would cut a macro in
      // half.
      const m = /^<<(link|button)\s+"([^"<>]*)"/.exec(macro);
      if (m) {
        const head = `<<${m[1]} "`;
        code(head);
        out.push({ kind: 'prose', text: m[2] });
        code(macro.slice(head.length + m[2].length));
      } else {
        code(macro);
      }
      i = stop;
      continue;
    }
    // A link. The display half is prose; the target half never is.
    if (src.startsWith('[[', i)) {
      const end = src.indexOf(']]', i + 2);
      if (end === -1) { prose += src[i++]; continue; }
      const inner = src.slice(i + 2, end);
      const sep = ['|', '->'].map(s => ({ s, at: inner.indexOf(s) })).filter(x => x.at !== -1)
        .sort((a, b) => a.at - b.at)[0];
      const back = inner.indexOf('<-');
      code('[[');
      if (back !== -1) {
        // [[Target<-display]] - target first.
        code(inner.slice(0, back + 2));
        out.push({ kind: 'prose', text: inner.slice(back + 2) });
      } else if (sep) {
        out.push({ kind: 'prose', text: inner.slice(0, sep.at) });
        code(inner.slice(sep.at));
      } else {
        code(inner);
      }
      code(']]');
      i = end + 2;
      continue;
    }
    // An HTML tag.
    if (src[i] === '<') {
      const end = src.indexOf('>', i + 1);
      if (end !== -1 && /^<\/?[A-Za-z]/.test(src.slice(i, i + 2 + 1))) {
        code(src.slice(i, end + 1));
        i = end + 1;
        continue;
      }
      prose += src[i++];
      continue;
    }
    // A variable name.
    if (src[i] === '$' || src[i] === '_') {
      const m = /^[$_][A-Za-z_][\w.]*/.exec(src.slice(i));
      if (m) { code(m[0]); i += m[0].length; continue; }
    }
    prose += src[i++];
  }
  flush();
  return out;
}

// "an" before a vowel SOUND, not a vowel letter. The replacement words come
// from a generated lexicon, so this cannot be a lookup table - but it only has
// to beat the naive letter test, which turns "a unique post" into "an unique
// post". The exceptions are the ordinary consonant-onset u- and eu- words.
export function articleFor(word) {
  const w = String(word || '').toLowerCase();
  if (/^(uni|use|user|usual|utili|one|euro|eu)/.test(w)) return 'a';
  return /^[aeiou]/.test(w) ? 'an' : 'a';
}

// The zero-article idiom. English says "go to college" with no article but
// "go to the academy" with one, so replacing the noun alone leaves "go to
// academy". Measured: 12 occurrences across the corpus. The preposition is
// part of the pattern so the article can be inserted with it.
// 'just' is not a preposition, but "all just school" is the same zero-article
// mass-noun use and reads as "all just arcology" without it.
const ZERO_ARTICLE_PREPS = ['to', 'at', 'in', 'of', 'from', 'through', 'after', 'before', 'just', 'about'];
const ZERO_ARTICLE_NOUNS = { college: 'institution_kind', school: 'institution_kind', university: 'institution_kind' };

// Built once per lexicon, not per passage: 286 passages x 25 terms is a lot of
// RegExp construction to repeat on every render.
const MARK = /\uE000(\d+)\uE001/g;

// The school's own names renamed for this world (world/renames.mjs): proper
// names matched exactly, ordinary words in any case with the original's case
// kept. No lookbehind - Safari before 16.4 cannot parse it - so a match takes
// the character before it along and gives it back.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

export function renameRules(renames) {
  const rules = [];
  const r = renames || {};
  const exact = Object.entries(r.exact || {}).filter(([k, v]) => k && v).sort((a, b) => b[0].length - a[0].length);
  if (exact.length) {
    const to = new Map(exact);
    rules.push({
      re: new RegExp(`(^|[^\\w-])(${exact.map(([k]) => escapeRe(k)).join('|')})(?![\\w-])`, 'g'),
      build: (m, pre, name) => pre + (to.get(name) ?? name),
    });
  }
  const words = Object.entries(r.words || {}).filter(([k, v]) => k && v).sort((a, b) => b[0].length - a[0].length);
  if (words.length) {
    const to = new Map(words.map(([k, v]) => [k.toLowerCase(), v]));
    rules.push({
      re: new RegExp(`(^|[^\\w-])(${words.map(([k]) => escapeRe(k).replace(/ /g, '\\s+')).join('|')})(?![\\w-])`, 'gi'),
      build: (m, pre, name) => pre + matchCase(name, to.get(name.toLowerCase().replace(/\s+/g, ' ')) ?? name),
    });
  }
  return rules;
}

// For text already on screen: no passage markup to step around. One pass, the
// same inert markers as substitute().
export function renameText(text, rules) {
  if (typeof text !== 'string' || !text || !rules || !rules.length) return text;
  const made = [];
  let s = text;
  for (const r of rules) {
    s = s.replace(r.re, (...a) => { made.push(r.build(...a)); return `\uE000${made.length - 1}\uE001`; });
  }
  return made.length ? s.replace(MARK, (m, i) => made[Number(i)]) : text;
}

export function compile(lexicon = {}, renames = null) {
  const lex = { ...DEFAULT_LEXICON, ...lexicon };
  const rules = [];
  // the school's names first: a course whose name holds a term is renamed whole
  rules.push(...renameRules(renames));

  // 1. Zero-article idioms first - they are longer and more specific than the
  //    bare noun, and the bare-noun rule would otherwise consume them.
  for (const [noun, key] of Object.entries(ZERO_ARTICLE_NOUNS)) {
    const word = lex[key];
    if (!word) continue;
    rules.push({
      re: new RegExp('\\b(' + ZERO_ARTICLE_PREPS.join('|') + ')\\s+' + noun + '\\b', 'gi'),
      build: (m, prep) => prep + ' ' + (/^the\b/i.test(word) ? word : 'the ' + word),
    });
  }

  // 2. "a college" / "an exam" - the article has to agree with the new word.
  for (const [pattern, key, opts = {}] of TERMS) {
    const word = lex[key];
    if (!word) continue;
    // A replacement that already carries its own article ("the Deep") takes
    // the place of the original's: "a the Deep" and "the the Tide Shrine"
    // are both wrong, and the chassis writes "the F-K University crest".
    // Phrases too - "f-k university" is the one that needs it most.
    if (carriesArticle(word)) {
      rules.push({
        re: new RegExp('\\b(the|a|an)\\s+' + pattern.replace(/[-]/g, '\\-').replace(/ /g, '\\s+') + '\\b', 'gi'),
        build: (...a) => caseFor(a[a.length - 1], a[a.length - 2], a[0], word),
      });
      continue;
    }
    if (pattern.includes(' ')) continue;
    rules.push({
      re: new RegExp('\\b(a|an)\\s+' + pattern + '\\b', 'gi'),
      build: (m, art) => matchCase(art, articleFor(word)) + ' ' + word,
    });
    if (opts.plural) {
      const pl = pluralise(word);
      rules.push({ re: new RegExp('\\b' + opts.plural.replace(/ /g, '\\s+') + '\\b', 'gi'), build: (m) => matchCase(m, pl) });
    }
  }

  // 3. The generic terms, longest first so phrases beat their parts.
  for (const [pattern, key, opts = {}] of TERMS) {
    const word = lex[key];
    if (!word) continue;
    if (opts.plural) {
      const pl = pluralise(word);
      rules.push({
        re: new RegExp('\\b' + opts.plural.replace(/ /g, '\\s+') + '\\b', 'gi'),
        build: (...a) => caseFor(a[a.length - 1], a[a.length - 2], a[0], pl),
      });
    }
    rules.push({
      re: new RegExp('\\b' + pattern.replace(/[-]/g, '\\-').replace(/ /g, '\\s+') + '\\b', 'gi'),
      build: (...a) => caseFor(a[a.length - 1], a[a.length - 2], a[0], word),
    });
  }
  return { lex, rules };
}

// One pass. Each replacement goes in as an inert marker and the words are put
// in at the end, so no rule ever matches a word another rule wrote. Run one
// after another over the text, "university" became "shrine school" and then
// the "school" rule rewrote its own output: "the shrine shrine school", in
// every passage, whenever the model's word held another term (2026-09-23).
// A marker holds no letters and no sentence punctuation, so a word after one
// reads as mid-sentence - which it is.

export function substitute(text, compiled) {
  const { rules } = compiled;
  return segment(text).map(seg => {
    if (seg.kind === 'code') return seg.text;
    const made = [];
    let s = seg.text;
    for (const r of rules) {
      s = s.replace(r.re, (...a) => {
        made.push(r.build(...a));
        return `\uE000${made.length - 1}\uE001`;
      });
    }
    return s.replace(MARK, (m, i) => made[Number(i)]);
  }).join('');
}

// The same words for text the engine builds in JavaScript - the hub's lines,
// a clothing record's name - which never passes through the passage hook.
// Compiled once per lexicon.
let memoKey = null;
let memoCompiled = null;
export function substituteWith(text, lexicon) {
  const key = JSON.stringify(lexicon || {});
  if (key !== memoKey) { memoKey = key; memoCompiled = compile(lexicon || {}); }
  return substitute(String(text == null ? '' : text), memoCompiled);
}

// Records whose display fields the engine prints straight from the table:
// what you are wearing ("%style %color F-K University t-shirt" is a clothing
// NAME template) and what a shop describes. Keys, and every field that points
// at a key, are left alone. Always rewritten from the ORIGINAL text, kept
// aside the first time: a second pass over "shrine school" would find
// "school" again.
export const DISPLAY_FIELDS = { clothes: /^(name|description\b.*)$/ };
const originals = new WeakMap();

export function applyLexiconToTables(setup, lexicon, tables = DISPLAY_FIELDS) {
  let changed = 0;
  for (const [name, fields] of Object.entries(tables)) {
    const table = setup && setup[name];
    if (!table || typeof table !== 'object') continue;
    for (const rec of Object.values(table)) {
      if (!rec || typeof rec !== 'object' || Array.isArray(rec)) continue;
      let kept = originals.get(rec);
      if (!kept) {
        kept = {};
        for (const [k, v] of Object.entries(rec)) if (typeof v === 'string' && fields.test(k)) kept[k] = v;
        originals.set(rec, kept);
      }
      for (const [k, v] of Object.entries(kept)) {
        const next = substituteWith(v, lexicon);
        if (rec[k] !== next) { rec[k] = next; changed++; }
      }
    }
  }
  return changed;
}

// The keys a generated lexicon supplies, with the question each one answers.
// Sent to the model as the shape to fill, so the prompt stays one small call.
export const LEXICON_PROMPT_KEYS = [
  ['institution', 'the proper name of the place the story happens in, with its article if it takes one'],
  ['institution_kind', 'the common noun for that kind of place, no article'],
  ['district', 'the grounds or area it occupies'],
  ['division', 'a social sub-group people belong to'],
  ['member', 'what an ordinary person here is called'],
  ['initiate', 'a newcomer who has not been accepted yet'],
  ['mentor', 'someone who teaches or directs members'],
  ['staff', 'the people who run the place, collectively'],
  ['session', 'a single scheduled activity a member attends'],
  ['program', 'a long-term specialisation a member commits to'],
  ['module', 'one unit of instruction inside a program'],
  ['assessment', 'a test of a member\'s ability'],
  ['standing', 'a member\'s measured reputation or score'],
  ['prep', 'work done alone outside a session'],
  ['quarters', 'where a member sleeps'],
  ['roomshare', 'the person they share it with'],
  ['commons', 'the open space where members gather'],
];

// A premise shorter than this is made concrete by the first call.
export const SETTING_UNDER_WORDS = 20;
export const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

// Which of the school's systems this world has. Asked in the first call, and
// only a clear "no" switches one off: a failed or vague answer leaves the
// world as the engine made it.
export const SYSTEM_QUESTIONS = [
  ['timetable', 'do members keep scheduled sessions they must attend (lessons, drills, shifts)?'],
  ['grades', 'is their work formally marked or graded?'],
  ['sports', 'do teams from this place play organised games against rival places, the way a school or a town fields a team?'],
  ['divisions', 'can members join exclusive houses or societies that recruit newcomers and throw parties, the way fraternities do?'],
];

export function parseSystems(parsed) {
  const no = (v) => v === false || /^\s*no\b/i.test(String(v == null ? '' : v));
  const systems = Object.fromEntries(SYSTEM_QUESTIONS.map(([k]) => [k, !no(parsed && parsed[k])]));
  // grades only exist through courses
  if (!systems.timetable) systems.grades = false;
  return systems;
}

export function buildLexiconPrompt(premise) {
  return [
    'WORLD PREMISE',
    String(premise || '').trim() || 'an ordinary place with something underneath',
    '',
    'TASK',
    'Name the vocabulary this world uses for the things listed below.',
    '',
    'RULES',
    '- Reply with ONLY a JSON object. No prose, no markdown, no code fences.',
    '- Use each KEY below exactly as written, once, with a short string value.',
    '- These replace the words of a generic institution, so they must fit the premise.',
    '- Give ordinary nouns, not proper names, EXCEPT for "institution".',
    '- No articles, EXCEPT "institution" may take one if it reads better ("the Grid").',
    '- Singular. Keep each under 24 characters.',
    '',
    'KEYS',
    ...LEXICON_PROMPT_KEYS.map(([k, q]) => `${k}: ${q}`),
    // Not vocabulary: whether the engine's own (modern English) name lists
    // fit this world. Asked here because a separate call costs 20-30 s on
    // perchance.org whatever it asks (world/names.mjs).
    'names: the language, culture and era of people\'s names here - "english" if ordinary modern English names fit, otherwise say which (for example "Edo-period Japanese")',
    // A short premise made concrete once, so every later call builds the same
    // world; and which of the school's systems it has (world/renames.mjs,
    // planning/specs/2026-09-24-world-shape-design.md).
    ...(wordCount(premise) < SETTING_UNDER_WORDS
      ? ['setting: two or three sentences that make this world concrete - where and when it is, and what the player belongs to and does there']
      : []),
    ...SYSTEM_QUESTIONS.map(([k, q]) => `${k}: "yes" or "no" - ${q}`),
  ].join('\n');
}

// One model call, and a failure is never fatal: the default lexicon is already
// neutral, so a world with no generated vocabulary still reads as an
// institution rather than a campus.
export async function generateLexicon(premise, model) {
  if (!model || typeof model.ask !== 'function' || !model.available()) {
    return { lexicon: { ...DEFAULT_LEXICON }, problems: ['no model: using the default lexicon'], setting: '', systems: parseSystems({}) };
  }
  const problems = [];
  try {
    const reply = await model.ask(buildLexiconPrompt(premise), { maxTokens: 560, temperature: 0.9 });
    const body = String(reply || '');
    const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/);
    const src = fenced ? fenced[1] : body;
    const start = src.indexOf('{');
    const end = src.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('no JSON object in the reply');
    const parsed = parseModelJson(src.slice(start, end + 1));
    const out = { ...DEFAULT_LEXICON };
    for (const [key] of LEXICON_PROMPT_KEYS) {
      const v = parsed[key];
      if (typeof v !== 'string' || !v.trim()) { problems.push(`${key}: missing`); continue; }
      const word = v.trim().replace(/^["']|["']$/g, '');
      if (word.length > 40) { problems.push(`${key}: too long`); continue; }
      out[key] = word;
    }
    const names = typeof parsed.names === 'string' ? parsed.names.trim().slice(0, 80) : '';
    const setting = wordCount(premise) < SETTING_UNDER_WORDS && typeof parsed.setting === 'string'
      ? parsed.setting.replace(/\s+/g, ' ').trim().slice(0, 600) : '';
    return { lexicon: out, problems, names, setting, systems: parseSystems(parsed) };
  } catch (err) {
    return {
      lexicon: { ...DEFAULT_LEXICON },
      problems: [`lexicon generation failed: ${err && err.message ? err.message : String(err)}`],
      setting: '',
      systems: parseSystems({}),
    };
  }
}

// Installs the substitution on SugarCube's documented passage hook. onProcess
// receives the passage SOURCE before the wikifier parses it, which is the only
// place a single hook can reach every passage's prose.
//
// `source` may be a function, and that is the point: the lexicon lives in a
// STORY VARIABLE, so it travels in the save automatically and a reloaded game
// reads the same words. Installing a captured lexicon instead would make every
// reload fall back to the default.
//
// Compilation is memoised on the lexicon's identity - 25 terms is ~50 RegExp
// objects, and building them per passage render would be wasteful.
export function install(config, source, renamesSource = null) {
  const previous = config.passages.onProcess;
  let key = null;
  let compiled = null;
  const read = (fn) => { try { return typeof fn === 'function' ? fn() : fn; } catch { return null; } };
  config.passages.onProcess = function (p) {
    const text = typeof previous === 'function' ? previous.call(this, p) : p.text;
    const lex = read(source);
    const renames = read(renamesSource);
    const next = JSON.stringify(lex || {}) + '\u0000' + JSON.stringify(renames || {});
    if (next !== key) { key = next; compiled = compile(lex || {}, renames); }
    return substitute(text, compiled);
  };
  return config.passages.onProcess;
}
