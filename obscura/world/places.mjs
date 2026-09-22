// world/places.mjs — the places get names that belong to the player's world.
//
// The map is carried whole: its nodes are indexed by a computed key, so the
// structure cannot be regenerated without breaking exits, $location and every
// passage tag that names a node. That left the GEOGRAPHY as the original's -
// Hanna Road North, Blodgett Gymnasium, Helleborine-Trillium Quad - in a world
// the player said was a rain-dark city.
//
// Measured before touching anything: the chassis compares `.name` 18 times and
// NONE of them is a place - they are constructor names, clothing and turn-ons -
// and ob_get_location_name() is only ever displayed. So a place's name is
// prose at the point it reaches the player.
//
// The node itself is still left alone. Names live in a STORY VARIABLE keyed by
// node, and only what is DISPLAYED is routed through them: the hub, and
// ob_get_location_name(). Anything that reads node.name directly keeps working,
// and the names travel with the save.
import { parseModelJson } from './safejson.mjs';

export const STATE_KEY = 'obscuraPlaceNames';
export const PLACES_PER_CALL = 30;
export const MAX_NAME = 40;

export function placeRoster(setup) {
  const out = [];
  const seen = new Set();
  const maps = (setup && setup.ob_maps) || {};
  for (const [mapName, map] of Object.entries(maps)) {
    const nodes = map && map.nodes;
    if (!nodes || typeof nodes !== 'object') continue;
    for (const [key, node] of Object.entries(nodes)) {
      if (!node || typeof node !== 'object' || seen.has(key)) continue;
      if (typeof node.name !== 'string' || !node.name.trim()) continue;
      seen.add(key);
      out.push({
        key, map: mapName, name: node.name,
        feature: typeof node.features === 'string' ? node.features : '',
        category: typeof node.category === 'string' ? node.category : '',
      });
    }
  }
  return out;
}

export function buildPlacesPrompt(persona, batch) {
  return [
    persona,
    '',
    'TASK',
    'These are the places in this world, listed by their current working names.',
    'Give each one the name it has in THIS world.',
    '',
    'RULES',
    '- Reply with ONLY a JSON object. No prose, no markdown, no code fences.',
    '- Use each place\'s NUMBER as the key, as a string: {"1": "...", "2": "..."}.',
    '- A plain descriptive name (Laundry Room, Lounge, Bathroom) may stay ONLY if that kind of place',
    '  exists in this world. If it does not, name what stands in its place here: in a world with no',
    '  machines, a laundry room is somewhere washing gets done, and it is named for that.',
    '- A PROPER name (a street, a shop, a hall, a club) must become one that fits the premise.',
    '- Every name must be different from every other.',
    `- Keep each name under ${MAX_NAME} characters.`,
    '',
    'PLACES',
    ...batch.map((p, i) => `${i + 1}. ${p.name}${p.feature ? ` (${p.feature})` : ''}${p.category ? ` [${p.category}]` : ''}`),
  ].join('\n');
}

// Validates a reply against its batch. Anything missing, empty, over-long,
// frame-breaking or duplicated keeps its original name rather than failing.
export function parsePlaceNames(text, batch, faultsIn = () => [], taken = new Set()) {
  const out = {};
  const raw = String(text == null ? '' : text);
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const a = body.indexOf('{');
  const b = body.lastIndexOf('}');
  if (a === -1 || b <= a) return { names: out, error: 'no JSON object in the reply' };
  let parsed;
  try { parsed = parseModelJson(body.slice(a, b + 1)); } catch (e) { return { names: out, error: `bad JSON: ${e.message}` }; }
  batch.forEach((p, i) => {
    const v = parsed[String(i + 1)];
    if (typeof v !== 'string') return;
    const name = v.trim().replace(/^["']|["']$/g, '');
    if (!name || name.length > MAX_NAME) return;
    if (faultsIn(name, 'name').length) return;
    const k = name.toLowerCase();
    if (taken.has(k)) return;
    taken.add(k);
    out[p.key] = name;
  });
  return { names: out, error: null };
}

export async function generatePlaceNames(opts) {
  const { setup, model, persona, faultsIn } = opts;
  const roster = placeRoster(setup);
  const names = {};
  const problems = [];
  if (!model || typeof model.available !== 'function' || !model.available() || !roster.length) {
    return { names, problems: roster.length ? ['no model: places keep their names'] : [] };
  }
  const taken = new Set(roster.map(p => p.name.toLowerCase()));
  for (let i = 0; i < roster.length; i += PLACES_PER_CALL) {
    const batch = roster.slice(i, i + PLACES_PER_CALL);
    // A place keeping its own name is allowed, so its own name must not count
    // as taken against itself.
    for (const p of batch) taken.delete(p.name.toLowerCase());
    let reply;
    try {
      reply = await model.ask(buildPlacesPrompt(persona, batch), { maxTokens: 60 + batch.length * 16, temperature: 0.9 });
    } catch (err) {
      problems.push(`places: ${err && err.message ? err.message : String(err)}`);
      for (const p of batch) taken.add(p.name.toLowerCase());
      continue;
    }
    const res = parsePlaceNames(reply, batch, faultsIn, taken);
    if (res.error) problems.push(`places: ${res.error}`);
    Object.assign(names, res.names);
    for (const p of batch) if (!res.names[p.key]) taken.add(p.name.toLowerCase());
  }
  return { names, problems };
}

export function displayName(state, key, fallback) {
  const store = state && state[STATE_KEY];
  const v = store && store[key];
  return typeof v === 'string' && v ? v : fallback;
}

// Routes the chassis's own display function through the names. Wrapped, not
// replaced: anything the original handled that is not a map node - "your
// place" for housing, for one - still comes from the original.
export function installPlaceNames(setup, getState) {
  if (!setup || typeof setup.ob_get_location_name !== 'function') return false;
  if (setup.ob_get_location_name.__obscuraPlaces) return true;
  const original = setup.ob_get_location_name;
  const wrapped = function (location) {
    const base = original.apply(this, arguments);
    let state = null;
    try { state = getState(); } catch { /* fall through to the original */ }
    return displayName(state, location, base);
  };
  wrapped.__obscuraPlaces = true;
  setup.ob_get_location_name = wrapped;
  return true;
}
