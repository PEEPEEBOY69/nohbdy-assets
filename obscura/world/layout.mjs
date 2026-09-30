// world/layout.mjs — the model lays out the world as places a person can walk.
//
// One background call after the hand-over: areas, and about fifty places in
// them, each with its kind, its area, and whether it is outdoors, opens onto an
// outdoor place, or is inside a building. Lines, not JSON: a reply the token
// budget cuts off keeps every line it finished. world/geography.mjs makes the
// paths - never the model - so every place can be reached.
import { KIND_MAX } from './geography.mjs';
import { faultsIn as defaultFaults } from './persona.mjs';

export const LAYOUT_AREAS = [6, 8];
export const LAYOUT_PLACES = 50;
export const LAYOUT_MIN_PLACES = 20;
const MAX_NAME = 40;

const GLOSS = {
  home: 'the newcomer\'s own room', lodging: 'where others live or sleep', privy: 'a toilet',
  bath: 'where people wash', food: 'where people eat or drink', shop: 'where things are sold',
  learning: 'where people study or are taught', training: 'where people exercise or drill',
  healer: 'where the sick are tended', entertainment: 'games, shows, amusements',
  gathering: 'a hall or meeting place', outdoors: 'a street, square, dock, field or path',
};

export function buildLayoutPrompt(persona, { timetable = false } = {}) {
  const kinds = Object.keys(KIND_MAX).map((k) => `${k} (${GLOSS[k]}) ${KIND_MAX[k]}`).join('; ');
  return [
    persona,
    '',
    'TASK',
    `Lay out this world as a map a person can walk: ${LAYOUT_AREAS[0]} to ${LAYOUT_AREAS[1]} areas, and about `
      + `${LAYOUT_PLACES} places in them - the streets, squares, buildings and rooms a newcomer could go.`,
    '',
    'RULES',
    '- Reply with ONLY lines in these two forms, the areas first:',
    '  AREA <n>. <name> | <what it looks like, under 120 characters> | borders: <numbers of the areas it touches>',
    '  PLACE <n>. <name> | <kind> | area <n> | <outdoors, or: opens onto <place number>, or: inside <place number>>',
    `- Kinds, and the most of each: ${kinds}. Exactly one home.`,
    '- Every area has at least one outdoors place. A building opens onto an outdoors place of its own area; a room is inside a building.',
    '- Names are what people here call each place. No two places with the same name.',
    '- The places the world premise names are among them.',
    ...(timetable ? ['- Lessons are held here: at least three learning places and one training place.'] : []),
  ].join('\n');
}

const AREA_LINE = /^\s*AREA\s+(\d+)\s*[.):-]?\s*(.*)$/i;
const PLACE_LINE = /^\s*PLACE\s+(\d+)\s*[.):-]?\s*(.*)$/i;
const NOT_A_NAME = /[[\]{}<>%\\|]/;

export function cleanPlaceName(raw, faultsIn = defaultFaults) {
  const s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().replace(/^["'“‘]+|["'”’]+$/g, '').trim();
  if (!s || s.length > MAX_NAME || NOT_A_NAME.test(s) || faultsIn(s, 'name').length) return null;
  return s;
}

const kindWord = (w) => {
  const k = String(w || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (KIND_MAX[k] !== undefined) return k;
  if (k.endsWith('s') && KIND_MAX[k.slice(0, -1)] !== undefined) return k.slice(0, -1);
  return null;
};

export function parseLayout(reply, faultsIn = defaultFaults) {
  const areas = [];
  const places = [];
  const names = new Set();
  for (const raw of String(reply == null ? '' : reply).split(/\r?\n/)) {
    const line = raw.replace(/\*\*/g, '');
    let m = AREA_LINE.exec(line);
    if (m) {
      const [name, look = '', borders = ''] = m[2].split('|').map((s) => s.trim());
      const n = Number(m[1]);
      const clean = cleanPlaceName(name, faultsIn);
      if (!clean || areas.some((a) => a.n === n)) continue;
      areas.push({ n, name: clean, look: look.slice(0, 160), borders: [...borders.matchAll(/\d+/g)].map((x) => Number(x[0])) });
      continue;
    }
    m = PLACE_LINE.exec(line);
    if (!m) continue;
    const [name, kind, area, where = ''] = m[2].split('|').map((s) => s.trim());
    const clean = cleanPlaceName(name, faultsIn);
    const k = kindWord(kind);
    const a = /(\d+)/.exec(area || '');
    if (!clean || !k || !a || names.has(clean.toLowerCase())) continue;
    names.add(clean.toLowerCase());
    const inside = /inside\s+(?:place\s+)?(\d+)/i.exec(where);
    const onto = /opens?\s+onto\s+(?:place\s+)?(\d+)/i.exec(where);
    places.push({
      n: Number(m[1]), name: clean, kind: k, area: Number(a[1]),
      outdoor: k === 'outdoors' || (!inside && !onto && /outdoor/i.test(where)),
      inside: inside ? Number(inside[1]) : null,
      opensOnto: onto ? Number(onto[1]) : null,
    });
  }
  return { areas, places };
}

// The ai-text-plugin sends the platform no length - its request carries only
// the instruction, startWith and stopSequences (read from its source,
// 2026-09-29) - and a reply ends at about 2,900 characters, whatever was
// asked: three real layouts stopped mid-line there, each naming an area in its
// borders it never reached. A line is whole when it has all its parts.
const partsOf = (rest) => rest.split('|').map((x) => x.trim());
function wholeLine(raw) {
  const line = raw.replace(/\*\*/g, '');
  let m = PLACE_LINE.exec(line);
  if (m) { const parts = partsOf(m[2]); return parts.length >= 4 && parts[3] !== ''; }
  m = AREA_LINE.exec(line);
  if (m) return /\bborders\s*:/i.test(m[2]);
  return /^\s*(?:AREA|PLACE)\b/i.test(line) ? false : null;
}
const linesOf = (reply) => String(reply == null ? '' : reply).split(/\r?\n/).map((l) => l.replace(/\*\*/g, '').trim()).filter(Boolean);
// The areas the written AREA lines name in their borders and never wrote.
function unwrittenAreas(lines) {
  const areas = lines.map((l) => AREA_LINE.exec(l)).filter(Boolean);
  const written = new Set(areas.map((m) => Number(m[1])));
  const named = areas.flatMap((m) => [...(partsOf(m[2])[2] || '').matchAll(/\d+/g)].map((x) => Number(x[0])));
  return [...new Set(named)].filter((n) => !written.has(n)).sort((a, b) => a - b);
}

// The class places a timetable world still needs, from what is written:
// three learning places and one training place (the class buildings).
function classPlacesWanted(lines) {
  const kinds = lines.map((l) => PLACE_LINE.exec(l)).filter(Boolean).map((m) => kindWord(partsOf(m[2])[1]));
  const count = (k) => kinds.filter((x) => x === k).length;
  return { learning: Math.max(0, 3 - count('learning')), training: Math.max(0, 1 - count('training')) };
}

// Stopped in the middle of a line, or before an area its borders name.
export function wasCutOff(reply) {
  const lines = linesOf(reply);
  if (!lines.length) return false;
  return wholeLine(lines[lines.length - 1]) === false || unwrittenAreas(lines).length > 0;
}

// The same task, with what was written so far - every whole AREA line and the
// last places - and where to go on from.
export function buildContinuePrompt(persona, reply, { timetable = false } = {}) {
  const whole = linesOf(reply).filter((l) => wholeLine(l) === true);
  const areas = whole.filter((l) => AREA_LINE.test(l));
  const places = whole.filter((l) => PLACE_LINE.test(l));
  const last = places.reduce((n, l) => Math.max(n, Number(PLACE_LINE.exec(l)[1])), 0);
  const missing = unwrittenAreas(areas);
  // how many more: six for each area still to write, or to about fifty in
  // all - told nothing, the real model wrote as many again as the first reply
  const more = Math.max(6 * missing.length, LAYOUT_PLACES - places.length, 6);
  const wanted = timetable ? classPlacesWanted(places) : { learning: 0, training: 0 };
  const plural = (n, what) => (n ? `${n} ${what} place${n > 1 ? 's' : ''}` : '');
  const among = [plural(wanted.learning, 'learning'), plural(wanted.training, 'training')].filter(Boolean).join(' and ');
  return [
    buildLayoutPrompt(persona, { timetable }),
    '',
    'WRITTEN SO FAR (the reply stopped here)',
    ...areas,
    ...places.slice(-12),
    '',
    `Continue from PLACE ${last + 1}: first an AREA line for each area named in borders and not yet written`
      + `${missing.length ? ` (${missing.join(', ')})` : ''}, then about ${more} new places, for those areas first`
      + `${among ? ` - among them ${among}, where lessons are held` : ''}.`
      + ' Reply with ONLY the new lines.',
  ].join('\n');
}

export function layoutProblem(layout) {
  if (!layout.areas.length) return 'no areas';
  if (layout.places.length < LAYOUT_MIN_PLACES) return `only ${layout.places.length} places`;
  if (!layout.places.some((p) => p.kind === 'home')) return 'no home';
  return null;
}

// One call, in the background - and one more to go on from where a cut-off
// reply stopped - asked again from the start if what came back cannot be
// used. With no layout the world keeps the original's places, joined.
export async function generateLayout({ model, persona, timetable = false, faultsIn = defaultFaults }) {
  if (!model || typeof model.ask !== 'function' || (typeof model.available === 'function' && !model.available())) {
    return { layout: null, problems: ['no model'], calls: 0 };
  }
  const problems = [];
  let calls = 0;
  const text = () => (typeof persona === 'function' ? persona() : persona);
  const ask = (prompt) => { calls += 1; return model.ask(prompt, { maxTokens: 3400, temperature: 0.85, background: true }); };
  const why = (err) => (err && err.message ? err.message : String(err));
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let reply = '';
    try {
      reply = await ask(buildLayoutPrompt(text(), { timetable }));
    } catch (err) {
      problems.push(`layout: ${why(err)}`);
      continue;
    }
    // cut off, or - with a timetable - short of the places classes meet in;
    // a reply with no whole area has nothing to go on from, and is asked again
    const whole = linesOf(reply).filter((l) => wholeLine(l) === true);
    const short = timetable && Object.values(classPlacesWanted(whole)).some((n) => n > 0);
    if (whole.some((l) => AREA_LINE.test(l)) && (wasCutOff(reply) || short)) {
      try { reply = `${reply}\n${await ask(buildContinuePrompt(text(), reply, { timetable }))}`; }
      catch (err) { problems.push(`layout, going on: ${why(err)}`); }
    }
    const layout = parseLayout(reply, faultsIn);
    const problem = layoutProblem(layout);
    if (!problem) return { layout, problems, calls };
    problems.push(problem);
  }
  return { layout: null, problems, calls };
}
