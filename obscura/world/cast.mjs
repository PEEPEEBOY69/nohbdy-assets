// world/cast.mjs — the characters a player brings, made into people here.
//
// An NPC is an entry in the engine's people database - archetype, type,
// species and gender, who they are attracted to - and the engine's Person
// builds everything else from it, seeded by the name, with a short list of
// looks a record may fix instead (hair, eyes, skin, a nickname). So a card
// becomes a person the engine's own way: one call maps the character's
// description onto the engine's closed sets, every value is checked against
// them, the engine's add_random makes the entry (and picks attraction the way
// it does for everyone), and the card's name and looks go on top. They are
// known from the start, and their own description stays with them.
import { parseModelJson } from './safejson.mjs';

export const CAST_KEY = 'obscuraCast';
export const CAST_PENDING_KEY = 'obscuraCastPending';

const DEFAULT_GENDERS = ['male', 'female', 'transgender male', 'transgender female', 'nonbinary amab', 'nonbinary afab'];

// The engine's genders are the static table, setup.species.human.genders
// ($species holds only a player's custom one). A gender is usable here only
// if the engine can name someone of it: random_name reads its namecomponents.
export function castSets(setup) {
  const table = setup && setup.species && setup.species.human && setup.species.human.genders;
  const named = table ? Object.keys(table).filter(g => table[g] && Array.isArray(table[g].namecomponents)) : [];
  const genders = named.length ? named : (table && Object.keys(table).length ? Object.keys(table) : DEFAULT_GENDERS);
  return {
    genders,
    // an archetype is an entry with an age range - the table also carries
    // inclination_sets, a helper the engine reads, which is nobody
    archetypes: Object.entries((setup && setup.ob_archetypes) || {})
      .filter(([, a]) => a && typeof a === 'object' && Array.isArray(a.age))
      .map(([k]) => k),
    // faculty is left out: the engine's teachers are made with the courses
    // they teach, and one without any is a hole in the timetable
    types: ['student', 'townie'],
    hairColors: [...((setup && setup.ob_hair_colors) || []), ...((setup && setup.ob_dye_hair_colors) || [])],
    hairStyles: Object.keys((setup && setup.ob_hairstyles) || {}),
    eyeColors: [...((setup && setup.ob_eye_colors) || []), ...((setup && setup.ob_eye_colors_exotic) || [])],
    skinColors: [...((setup && setup.ob_skin_colors) || [])],
  };
}

export function buildCastPrompt(premise, character, sets) {
  return [
    'WORLD PREMISE',
    String(premise || '').trim(),
    '',
    'CHARACTER',
    `${character.name}: ${String(character.profile || '').slice(0, 1500)}`,
    '',
    'TASK',
    'Describe this character using ONLY the allowed values below. Pick the closest value for each key;',
    'leave a key out if nothing fits. "type" is student (someone who studies or trains here) or townie',
    '(anyone else).',
    '',
    'RULES',
    '- Reply with ONLY a JSON object with these keys: gender, archetype, type, hair color, hair style,',
    '  eye color, skin color, nickname (a short nickname, or leave it out).',
    '- Every value must be copied exactly from its list.',
    '',
    'ALLOWED',
    `gender: ${sets.genders.join(', ')}`,
    `archetype: ${sets.archetypes.join(', ')}`,
    `type: ${sets.types.join(', ')}`,
    `hair color: ${sets.hairColors.join(', ')}`,
    `hair style: ${sets.hairStyles.join(', ')}`,
    `eye color: ${sets.eyeColors.join(', ')}`,
    `skin color: ${sets.skinColors.join(', ')}`,
  ].join('\n');
}

export function parseCast(reply, sets) {
  const out = { gender: null, archetype: null, type: null, pdata: {} };
  const body = String(reply || '');
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : body;
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start === -1 || end <= start) return out;
  let v;
  try { v = parseModelJson(src.slice(start, end + 1)); } catch { return out; }
  if (!v || typeof v !== 'object') return out;
  const pick = (value, list) => {
    const s = String(value == null ? '' : value).trim().toLowerCase();
    return list.find(x => x.toLowerCase() === s) || null;
  };
  out.gender = pick(v.gender, sets.genders);
  out.archetype = pick(v.archetype, sets.archetypes);
  out.type = pick(v.type, sets.types);
  for (const [key, list] of [['hair color', sets.hairColors], ['hair style', sets.hairStyles],
    ['eye color', sets.eyeColors], ['skin color', sets.skinColors]]) {
    const got = pick(v[key], list);
    if (got) out.pdata[key] = got;
  }
  const nick = String(v.nickname == null ? '' : v.nickname).trim();
  if (nick && nick.length <= 24 && !/\s{2,}/.test(nick)) out.pdata.nickname = nick;
  return out;
}

// The engine splits a name into first and last; a one-word card name gets a
// surname from this world's own list. Never a name already in use.
export function castName(raw, surnames, used, random = Math.random) {
  const clean = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!clean) return null;
  const words = clean.split(' ');
  const pool = (surnames && surnames.length ? surnames : ['Vale']);
  if (words.length >= 2 && !used.has(clean)) return clean;
  const first = words[0];
  // any surname of this world's, not always the list's first
  const start = Math.floor(random() * pool.length);
  for (let i = 0; i < pool.length; i++) {
    const candidate = `${first} ${pool[(start + i) % pool.length]}`;
    if (!used.has(candidate)) return candidate;
  }
  let n = 2;
  while (used.has(`${first} ${pool[0]}${n}`)) n += 1;
  return `${first} ${pool[0]}${n}`;
}

// A student is more than an entry: a year, a major, courses on a timetable.
// Someone arriving after the world was made takes those from a student who
// is already enrolled - the way the engine seats its best friend - and lives
// off-campus, so nobody's room changes hands.
const STUDENT_PROPS = ['year', 'major', 'courses', 'schedule'];

export function enrolLike(db, name, pick = (list) => list[Math.floor(Math.random() * list.length)]) {
  const peers = Object.entries(db)
    .filter(([k, p]) => k !== name && p && p.type === 'student' && !p.special && Array.isArray(p.courses) && p.courses.length)
    .map(([, p]) => p);
  if (!peers.length) return false;
  const peer = pick(peers);
  for (const k of STUDENT_PROPS) if (peer[k] !== undefined) db[name][k] = Array.isArray(peer[k]) ? [...peer[k]] : peer[k];
  db[name].residence = 'off-campus';
  return true;
}

// What the engine does for everyone at world generation, done for one person
// arriving late: a daily routine, nights out, a place in the lookup table.
// Each step is the engine's own and each is optional - an older or newer
// chassis without one still gets its person.
// The chassis renames part of `setup` (chassis/rename-map.json:
// ensure_schedules is ob_ensure_schedules, NPCSimulation is ob_nPCSimulation),
// so each is looked for under both names.
const either = (obj, ...names) => {
  for (const n of names) if (obj && obj[n] != null) return obj[n];
  return null;
};

export function settleIn(setup, name) {
  const sim = either(setup, 'ob_nPCSimulation', 'NPCSimulation');
  const call = (owner, fn, ...args) => { if (typeof fn === 'function') fn.apply(owner, args); };
  const steps = [
    () => call(setup, either(setup, 'ob_ensure_schedules', 'ensure_schedules')),
    () => call(setup, either(setup, 'determine_virginity', 'ob_determine_virginity'), name),
    () => call(setup.people, setup.people && setup.people.bake_schedule, name),
    () => call(sim, sim && sim.build_lookup_table),
  ];
  let done = 0;
  for (const step of steps) { try { step(); done += 1; } catch (err) { console.warn('Obscura: a step of settling in failed for', name, err); } }
  return done;
}

export function addCastMember(setup, V, member) {
  const db = setup.people_db();
  const sets = castSets(setup);
  const mapped = member.mapped || {};
  const pickOr = (v, list) => (v && list.includes(v) ? v : list[Math.floor(Math.random() * list.length)]);
  const gender = pickOr(mapped.gender, sets.genders);
  const archetype = pickOr(mapped.archetype, sets.archetypes.length ? sets.archetypes : ['Nerd']);
  let type = mapped.type && sets.types.includes(mapped.type) ? mapped.type : 'townie';
  const used = new Set(Object.keys(db));
  const name = castName(member.name, setup.ob_names && setup.ob_names.surnames, used);
  if (!name) return null;
  const temp = setup.people.add_random(gender, archetype, type);
  const entry = db[temp];
  delete db[temp];
  db[name] = { ...entry, ...(mapped.pdata || {}), obscuraImported: true };
  if (type === 'student' && !enrolLike(db, name)) { db[name].type = 'townie'; type = 'townie'; }
  settleIn(setup, name);
  try { setup.people.become_known(name); } catch { /* known next time they are met */ }
  if (!V[CAST_KEY] || typeof V[CAST_KEY] !== 'object') V[CAST_KEY] = {};
  V[CAST_KEY][name] = {
    profile: String(member.profile || '').slice(0, 2000),
    portraitUrl: /^https:\/\/\S+$/i.test(String(member.portraitUrl || '')) ? member.portraitUrl : '',
    from: String(member.from || '').slice(0, 90),
  };
  return name;
}

// One call per character, in the background, one at a time. The people wait
// in the save from the hand-over on, and each answer is written into the list
// as it stands when the answer lands: the player has moved on meanwhile, and
// SugarCube gives every move a new variables object. A reload in the middle
// loses only the call in flight, and the next page load asks again.
export const unmapped = (list) => (Array.isArray(list) ? list.filter(m => m && !m.mapped) : []);

export async function mapPending({ model, premise, sets, vars }) {
  let done = 0;
  for (;;) {
    const next = unmapped((vars() || {})[CAST_PENDING_KEY])[0];
    if (!next) return done;
    let got = { gender: null, archetype: null, type: null, pdata: {} };
    try {
      const reply = await model.ask(buildCastPrompt(typeof premise === 'function' ? premise() : premise, next, sets),
        { maxTokens: 220, temperature: 0.4, background: true });
      got = parseCast(reply, sets);
    } catch { /* the engine decides what the model could not */ }
    const same = unmapped((vars() || {})[CAST_PENDING_KEY]).find(m => m.name === next.name);
    if (!same) return done; // they joined already, or this is a new game
    same.mapped = got;
    done += 1;
  }
}

// At a real place: everyone whose answer has come in joins; anyone still
// waiting on theirs joins at the next place.
export function joinPending(setup, V) {
  const list = V && V[CAST_PENDING_KEY];
  if (!Array.isArray(list) || !list.length) return [];
  const names = [];
  const waiting = [];
  for (const m of list) {
    if (!m) continue;
    if (!m.mapped) { waiting.push(m); continue; }
    try { const n = addCastMember(setup, V, m); if (n) names.push(n); } catch (err) { console.warn('Obscura: a character could not join', err); }
  }
  V[CAST_PENDING_KEY] = waiting;
  return names;
}
