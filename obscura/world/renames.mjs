// world/renames.mjs — the school's own names, renamed for this world.
//
// The engine is a college at heart and names its things: 144 courses, the
// majors, the halls, the Fighting Elks and their rivals, the breaks and the
// festival days, the Greek houses, even the months. It looks every one of them
// up by name, so nothing can change underneath - only what reaches the screen
// can. This takes the set from `setup`, asks the model what plays the same part
// in this world, keeps only answers safe to apply twice, and leaves the rest to
// world/lexicon.mjs (the rules) and world/guard.mjs (the screen).
import { parseModelJson } from './safejson.mjs';
import { substituteWith } from './lexicon.mjs';

export const RENAMES_KEY = 'obscuraRenames';
export const FRAME_BATCH = 37;
export const COURSE_BATCH = 36;
export const MAX_NAME = 40;

export const emptyRenames = () => ({ exact: {}, words: {}, subjects: {}, done: false });
const upperFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Sports whose names are the school's own; `swimming` is everyday English.
const SPORT_WORDS = ['football', 'cheerleading', 'esports'];
// Years printed alone as a label; only the first two are school words in prose.
const YEAR_WORDS = ['freshman', 'sophomore'];

export function schoolNames(setup) {
  const S = (setup && setup.School) || {};
  const frame = [];
  const add = (original, what, kind = 'exact') => {
    if (typeof original === 'string' && original.trim() && !frame.some((i) => i.original === original)) {
      frame.push({ id: String(frame.length + 1), original, what, kind });
    }
  };
  for (const m of Object.keys(S.majors || {})) add(m, 'a subject members study (answer with the subject, lower case)', 'major');
  for (const h of Object.keys(S.residences || {})) add(h, 'a hall where members live');
  const T = (setup && setup.ob_time) || {};
  const months = Array.isArray(T.months) ? T.months : [];
  months.forEach((m, i) => add(m, `month ${i + 1} of ${months.length}, ${(T.seasons || [])[i] || 'a season'}`));
  for (const e of Object.keys(S.eventdays || {})) add(e, 'a festival day');
  for (const b of Object.keys(S.holidays || {})) add(b, 'a break from sessions (lower case)', 'words');
  for (const y of Object.keys(S.noncohort || {})) add(y, 'what a member is called in this year of membership (lower case)', 'year');
  const team = S.team || {};
  add(team.name, 'the home team');
  add(team.longname, 'the home team, long form');
  add(team.university, 'the home institution, as a rival team calls it');
  add(team.mascot, 'the home team\'s mascot');
  for (const [name, t] of Object.entries(S.other_teams || {})) {
    add(name, 'a rival team');
    add(t && t.longname, 'a rival team, long form');
    add(t && t.university, 'a rival team\'s home');
    add(t && t.mascot, 'a rival team\'s mascot');
  }
  for (const s of Object.keys(S.sports || {})) if (SPORT_WORDS.includes(s)) add(s, 'an organised game or team activity (lower case)', 'words');
  const houses = setup && setup.ob_houses && setup.ob_houses.db;
  for (const h of Object.keys(houses || {})) add(h, 'an exclusive house members can join');
  const courses = Object.entries(S.courses || {}).map(([original, c], i) => ({
    id: String(i + 1), original, group: c && c.major, year: (c && c.year) || 1, kind: 'exact',
  }));
  return { frame, courses };
}

// What the engine prints straight from its data, in this world's words - no
// model call. Only strings the vocabulary actually changes.
export function schoolTooltips(setup, lexicon) {
  const out = {};
  const S = (setup && setup.School) || {};
  for (const info of Object.values(S.noncohort || {})) {
    const t = info && info.tooltip;
    if (typeof t !== 'string' || !t) continue;
    const next = substituteWith(t, lexicon);
    if (next !== t) out[t] = next;
  }
  return out;
}

// ---- asking -----------------------------------------------------------------
const WORDS_SHOWN = ['institution', 'institution_kind', 'member', 'session', 'program', 'module', 'quarters', 'division'];
const wordsLine = (lexicon) => WORDS_SHOWN.filter((k) => lexicon && lexicon[k]).map((k) => `${k}: ${lexicon[k]}`).join('; ');

const RULES = [
  'RULES',
  '- Reply with ONLY a JSON object keyed by the numbers: {"1": "...", "2": "..."}. No prose, no code fences.',
  '- A new name every time: never the old one, and never containing it.',
  '- Proper names capitalised as names; ordinary things in lower case where asked.',
  `- Under ${MAX_NAME} characters each.`,
];

export function buildFramePrompt(premise, lexicon, items) {
  return [
    'WORLD', String(premise || '').trim(), '',
    'THIS WORLD\'S WORDS', wordsLine(lexicon), '',
    'TASK',
    'This world is played on the bones of a school. Each numbered thing below is the school\'s; name the thing',
    'that plays the same part in this world. Keep what each thing is: a month stays a month in its order and',
    'season, a festival stays a festival, a team stays a team, a hall stays where people live.', '',
    ...RULES, '',
    'THINGS',
    ...items.map((i) => `${i.id}. [${i.what}] ${i.original}`),
  ].join('\n');
}

export function buildCoursePrompt(premise, lexicon, items) {
  const module = (lexicon && lexicon.module) || 'module';
  const program = (lexicon && lexicon.program) || 'program';
  return [
    'WORLD', String(premise || '').trim(), '',
    'THIS WORLD\'S WORDS', wordsLine(lexicon), '',
    'TASK',
    `Each numbered ${module} below belongs to the ${program} and year in brackets. Name the ${module} of that ${program}`,
    'that plays the same part here: keep its subject and its level - an introduction stays an introduction, a',
    'course about numbers stays about numbers, so what it trains still fits.', '',
    ...RULES, '',
    'MODULES',
    ...items.map((i) => `${i.id}. [${i.what}] ${i.original}`),
  ].join('\n');
}

export function parseRenameReply(reply, items) {
  const body = String(reply || '');
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : body;
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start === -1 || end <= start) return {};
  let v;
  try { v = parseModelJson(src.slice(start, end + 1)); } catch { return {}; }
  const out = {};
  for (const it of items) {
    const a = v && v[it.id];
    if (typeof a === 'string' && a.trim()) out[it.id] = a.replace(/\s+/g, ' ').trim();
  }
  return out;
}

// ---- keeping ----------------------------------------------------------------
// Every form that gets renamed on screen, as a whole word. A new name holding
// one of them would be renamed again by the next pass, so it is refused. A
// major is renamed only as the engine prints it ("Psychology major"): its bare
// word ("art", "history") is everyday English and stays free to use.
export function collisionSet({ frame = [], courses = [] } = {}) {
  const set = new Set();
  for (const i of [...frame, ...courses]) {
    set.add(i.kind === 'major' ? `${upperFirst(i.original)} major`.toLowerCase() : String(i.original).toLowerCase());
  }
  return set;
}

const holdsWord = (text, word) => new RegExp(`(^|[^\\w-])${String(word).replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}(?![\\w-])`, 'i').test(text);

export function validName(original, candidate, taken) {
  const c = String(candidate == null ? '' : candidate).replace(/^["'\s]+|["'\s]+$/g, '');
  if (!c || c.length > MAX_NAME) return null;
  if (c.toLowerCase() === String(original).toLowerCase()) return null;
  if (holdsWord(c, original)) return null;
  for (const t of taken || []) if (holdsWord(c, t)) return null;
  return c;
}

// Writes each safe answer into `renames` in the form the screen shows it: a
// major as the engine prints it ("Psychology major"), a year as its label and,
// for the two school-only years, as a word too.
export function applyAnswers(renames, items, answers, lexicon, taken) {
  let n = 0;
  for (const it of items) {
    const name = validName(it.original, answers[it.id], taken);
    if (!name) continue;
    if (it.kind === 'major') {
      renames.subjects[it.original] = name.toLowerCase();
      renames.exact[`${upperFirst(it.original)} major`] = `${upperFirst(name.toLowerCase())} ${(lexicon && lexicon.program) || 'major'}`;
    } else if (it.kind === 'year') {
      renames.exact[upperFirst(it.original)] = upperFirst(name);
      if (YEAR_WORDS.includes(it.original)) renames.words[it.original] = name.toLowerCase();
    } else if (it.kind === 'words') {
      renames.words[it.original] = name.toLowerCase();
    } else {
      renames.exact[it.original] = name;
    }
    n += 1;
  }
  return n;
}

// ---- the background calls ------------------------------------------------
const chunk = (list, n) => { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };

const answered = (r, it) => (it.kind === 'major' ? !!r.subjects[it.original]
  : it.kind === 'year' ? !!r.exact[upperFirst(it.original)]
    : it.kind === 'words' ? !!r.words[it.original] : !!r.exact[it.original]);

// In the background, after the places: the frame first (the courses are named
// by their subjects' new names), each batch asked again once if under half of
// it came back usable. Every answer is written into the state the player is in
// when it lands - SugarCube replaces its variables on every move - and items
// already answered are not asked again, so a reload resumes. `done` says the
// whole set has been asked.
export async function nameTheSchool({ setup, model, premise, lexicon, live, onBatch }) {
  const stats = { calls: 0, named: 0, failed: 0 };
  if (!model || typeof model.ask !== 'function') return stats;
  const state = () => {
    const v = (typeof live === 'function' ? live() : live) || {};
    if (!v[RENAMES_KEY] || typeof v[RENAMES_KEY] !== 'object') v[RENAMES_KEY] = emptyRenames();
    const r = v[RENAMES_KEY];
    r.exact = r.exact || {}; r.words = r.words || {}; r.subjects = r.subjects || {};
    return r;
  };
  if (state().done) return stats;
  const set = schoolNames(setup);
  const taken = collisionSet(set);
  const ask = async (prompt, items) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      stats.calls += 1;
      let answers = {};
      try {
        answers = parseRenameReply(await model.ask(prompt, { maxTokens: 40 + items.length * 18, temperature: 0.7, background: true }), items);
      } catch { answers = {}; }
      const got = applyAnswers(state(), items, answers, lexicon, taken);
      stats.named += got;
      if (got && typeof onBatch === 'function') { try { onBatch(got); } catch { /* the screen refresh is not the renamer's */ } }
      if (got * 2 >= items.length) return;
    }
    stats.failed += 1;
  };
  for (const batch of chunk(set.frame.filter((it) => !answered(state(), it)), FRAME_BATCH)) {
    await ask(buildFramePrompt(premise, lexicon, batch), batch);
  }
  const courses = set.courses.filter((it) => !answered(state(), it))
    .map((it) => ({ ...it, what: `${state().subjects[it.group] || it.group}, year ${it.year}` }));
  for (const batch of chunk(courses, COURSE_BATCH)) {
    await ask(buildCoursePrompt(premise, lexicon, batch), batch);
  }
  state().done = true;
  return stats;
}

// ---- the places, on the screens that read them from the map --------------
// Places are renamed through the engine's display lookup (world/places.mjs),
// but some screens read a place's name straight off the map - the sidebar's
// "at Thoreau Building" (measured, 2026-09-24). Those names are renamed on
// screen like the school's: a building's map name and each node's name, to
// the place's new name, when it has one that is safe to apply twice.
export function placeRenames(setup, placeNames) {
  const out = {};
  const names = placeNames || {};
  const maps = (setup && setup.ob_maps) || {};
  const originals = new Map();
  for (const [mapKey, map] of Object.entries(maps)) {
    if (!map || typeof map !== 'object') continue;
    if (typeof map.name === 'string' && names[mapKey]) originals.set(map.name, mapKey);
    for (const [nodeKey, node] of Object.entries(map.nodes || {})) {
      if (node && typeof node.name === 'string' && names[nodeKey]) originals.set(node.name, nodeKey);
    }
  }
  const taken = new Set([...originals.keys()].map((n) => n.toLowerCase()));
  for (const [name, key] of originals) {
    const next = validName(name, names[key], taken);
    if (next) out[name] = next;
  }
  return out;
}
