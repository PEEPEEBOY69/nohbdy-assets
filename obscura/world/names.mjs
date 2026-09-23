// world/names.mjs — names that belong to the world.
//
// The engine has its own name generator (ob_random_name) and ships its own
// lists - modern English names, a legacy set, a fantasy set - and every NPC and
// the player's "Random name" draw from them. For a modern English-speaking
// world they are exactly right, and a model rewriting them only made the build
// longer. For a world with another language, culture or period - Edo Kyoto, a
// Norse saga, 1920s Harlem - they are wrong in every mouth.
//
// So the vocabulary call answers one more question, what people's names are
// here, and only a world whose answer is not modern English pays for a call:
// that world gets its own lists, dropped into the engine's by kind, and the
// engine's own generator draws from them from then on.
import { parseModelJson } from './safejson.mjs';

export const NAME_COUNTS = { female: 40, male: 40, neutral: 20, surnames: 60 };
// Below these a list is too thin: the engine draws until a name is unused,
// and 562 people need enough combinations.
const MINIMUM = { female: 20, male: 20, neutral: 8, surnames: 30 };

// What the vocabulary call said about names, read as "do the engine's fit".
export function namesFit(answer) {
  const a = String(answer == null ? '' : answer).trim().toLowerCase();
  if (!a) return true;
  return /^(ordinary |plain |modern |contemporary )*(english|american|british|us|uk)( english)?( names)?\.?$/.test(a);
}

export function buildNamesPrompt(premise, culture) {
  return [
    'WORLD PREMISE',
    String(premise || '').trim(),
    '',
    'TASK',
    `List the names people in this world really have. Their names are ${culture}.`,
    '',
    'RULES',
    '- Reply with ONLY a JSON object: {"female": [...], "male": [...], "neutral": [...], "surnames": [...]}.',
    `- ${NAME_COUNTS.female} female given names, ${NAME_COUNTS.male} male given names, ${NAME_COUNTS.neutral} given names that suit anyone, ${NAME_COUNTS.surnames} surnames or family names.`,
    '- Each name is ONE word: no spaces. A hyphen or an apostrophe inside a name is fine.',
    '- All different. Names a person there would be given - no titles, epithets or nicknames.',
  ].join('\n');
}

const ONE_WORD = /^[\p{L}][\p{L}\p{M}'’-]{0,23}$/u;

export function parseNameLists(reply) {
  const problems = [];
  const body = String(reply || '');
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : body;
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start === -1 || end <= start) return { lists: null, problems: ['no JSON object in the reply'] };
  let parsed;
  try { parsed = parseModelJson(src.slice(start, end + 1)); } catch (err) {
    return { lists: null, problems: [`not valid JSON: ${err.message}`] };
  }
  const lists = {};
  for (const [kind, want] of Object.entries(NAME_COUNTS)) {
    const seen = new Set();
    const clean = [];
    for (const raw of Array.isArray(parsed && parsed[kind]) ? parsed[kind] : []) {
      const name = String(raw == null ? '' : raw).trim().replace(/^["']|["']$/g, '');
      if (!ONE_WORD.test(name)) continue;
      const k = name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      clean.push(name);
      if (clean.length >= want) break;
    }
    if (clean.length < MINIMUM[kind]) problems.push(`${kind}: only ${clean.length} usable names`);
    lists[kind] = clean;
  }
  return { lists: problems.length ? null : lists, problems };
}

// The engine's lists, with every name pool replaced by kind. What is not a
// pool of names - the online usernames, the index of unusual keys - stays.
export function applyNameLists(obNames, lists) {
  const out = {};
  for (const [key, value] of Object.entries(obNames || {})) {
    if (!Array.isArray(value) || key === 'usernames' || key === 'unusual_name_keys') { out[key] = value; continue; }
    const k = key.toLowerCase();
    if (/surname/.test(k)) out[key] = [...lists.surnames];
    else if (/nonbinary|neutral|^fun$/.test(k)) out[key] = [...lists.neutral];
    else if (/female/.test(k)) out[key] = [...lists.female];
    else if (/male/.test(k)) out[key] = [...lists.male];
    else out[key] = value;
  }
  return out;
}

export async function generateNames(premise, culture, model, callOpts = {}) {
  if (!model || typeof model.ask !== 'function' || !model.available()) {
    return { lists: null, problems: ['no model: the engine keeps its names'] };
  }
  try {
    const reply = await model.ask(buildNamesPrompt(premise, culture), {
      maxTokens: 1200, temperature: 0.9, ...callOpts,
    });
    return parseNameLists(reply);
  } catch (err) {
    return { lists: null, problems: [`names: ${err && err.message ? err.message : String(err)}`] };
  }
}
