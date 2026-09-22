// world/living.mjs — the world keeps being written after the build finishes.
//
// The chassis already simulates. Measured: ob_nPCSimulation queues and
// processes events, ob_time advances, ob_business tracks jobs and catch-up,
// ob_events registers happenings and refreshes bulletins per game day. None of
// that is replaced here, and none of it needed to be.
//
// What the chassis cannot do is AUTHOR. Its content is generated once at
// worldgen and then frozen, so the simulation shuffles a fixed deck forever: a
// player who explores everything has seen the whole world. This adds new
// records to the deck while they play.
//
// THE POLICY IS IDLE-ONLY, and it is forced by the platform rather than chosen.
// The ai-text plugin shares one iframe and breaks if two calls overlap, so
// background work cannot run alongside a call the player is waiting on. It
// therefore does not try: it schedules only when the model's queue is empty,
// and stops scheduling the moment anything else needs it.
//
// The honest bound: a call already in flight cannot be cancelled. "Yields
// instantly" means it stops SCHEDULING instantly. The worst a player can ever
// wait on background work is one in-flight call. That is the one thing this
// design cannot make zero, so it is stated rather than glossed.
//
// TEXT, NEVER STRUCTURE - the same rule as slice 2b, and it matters more here
// because this runs against a LIVE world with a save attached. A new record is
// a deep clone of an existing one with its text fields rewritten, so it is
// structurally identical to something the engine already handles. The model
// never invents a shape.
import { buildPersona, faultsIn, stripPackaging } from './persona.mjs';

export const IDLE_CALLS_PER_DAY = 3;
export const MIN_TICKS_BETWEEN = 4;
export const MAX_FIELD_CHARS = 240;

// Each task names a table it extends, how to find a record to copy the shape
// from, and which of that record's fields are text worth rewriting.
export const TASKS = [
  {
    key: 'business',
    label: 'a new business opens',
    table: 'ob_business',
    member: 'db',
    ask: 'A business that has just opened here. Give it a name and a short line about what it is.',
    fields: ['employeeLabel'],
    nameHint: 'the name of the business itself',
  },
  {
    key: 'petition',
    label: 'a faction makes a move',
    table: 'ob_petitions',
    member: 'db',
    ask: 'Something a group here is pushing for, that others would argue about.',
    fields: ['description', 'blurb', 'text'],
    nameHint: 'a short name for the proposal',
  },
  {
    key: 'rumour',
    label: 'word gets around',
    table: 'ob_storyhints',
    member: null,
    ask: 'A rumour going round, one or two sentences, concrete and unresolved.',
    fields: [],
    nameHint: 'a short label for the rumour',
  },
];

// A record map's values, ignoring anything that is not a plain object.
function records(container) {
  if (!container || typeof container !== 'object') return [];
  return Object.entries(container).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
}

export function containerFor(setup, task) {
  const table = setup && setup[task.table];
  if (!table || typeof table !== 'object') return null;
  if (!task.member) return table;
  const member = table[task.member];
  return member && typeof member === 'object' ? member : null;
}

// Which text fields a copied record should have rewritten: the ones whose
// original value is a human-readable string. Anything shorter than a few
// characters is a code or a flag, and rewriting it breaks a lookup.
export function textFieldsOf(record, preferred = []) {
  const out = [];
  for (const [k, v] of Object.entries(record || {})) {
    if (typeof v !== 'string') continue;
    if (v.length < 4) continue;
    if (/^[a-z0-9_-]+$/i.test(v) && !v.includes(' ')) continue; // an identifier, not prose
    out.push(k);
  }
  const wanted = preferred.filter(f => typeof record[f] === 'string');
  return [...new Set([...wanted, ...out])].slice(0, 4);
}

export function buildTaskPrompt(task, premise, lexicon, sample) {
  const fields = textFieldsOf(sample, task.fields);
  return [
    buildPersona(premise, lexicon),
    '',
    'TASK',
    task.ask,
    '',
    'RULES',
    '- Reply with ONLY a JSON object. No prose, no markdown, no code fences.',
    `- "name": ${task.nameHint}. Two to four words. It must not repeat an existing one.`,
    ...fields.map(f => `- "${f}": a replacement for this field, in the same spirit as the example.`),
    `- Keep every value under ${MAX_FIELD_CHARS} characters.`,
    '',
    'EXISTING NAMES (do not reuse)',
    '',
    'EXAMPLE OF THE SHAPE',
    JSON.stringify(Object.fromEntries(fields.map(f => [f, sample[f]])), null, 1),
  ].join('\n');
}

export function parseTaskReply(text) {
  const raw = stripPackaging(text);
  if (!raw) return { value: null, error: 'empty reply' };
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1].trim() : raw;
  const a = body.indexOf('{');
  const b = body.lastIndexOf('}');
  if (a === -1 || b <= a) return { value: null, error: 'no JSON object in the reply' };
  try {
    const parsed = JSON.parse(body.slice(a, b + 1));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: null, error: 'reply was not a JSON object' };
    }
    return { value: parsed, error: null };
  } catch (err) {
    return { value: null, error: `reply was not valid JSON: ${err.message}` };
  }
}

// Builds the new record. The clone is what guarantees structural validity; the
// reply only ever overwrites string fields that were already strings.
export function applyTaskReply(container, sample, reply, opts = {}) {
  const name = typeof reply.name === 'string' ? stripPackaging(reply.name, 'name').trim() : '';
  if (!name) return { added: null, error: 'no name in the reply' };
  if (name.length > 60) return { added: null, error: 'name is absurdly long' };
  if (Object.prototype.hasOwnProperty.call(container, name)) {
    return { added: null, error: `"${name}" already exists` };
  }
  // Checked as a NAME, not as prose: "Okay Motors" is a business, not a
  // preamble, and the body rules would throw it away.
  const nameFaults = faultsIn(name, 'name');
  if (nameFaults.length) return { added: null, error: `name ${nameFaults.join(', ')}: "${name}"` };

  const clone = JSON.parse(JSON.stringify(sample));
  let wrote = 0;
  for (const [k, v] of Object.entries(reply)) {
    if (k === 'name') continue;
    if (typeof v !== 'string') continue;
    if (typeof clone[k] !== 'string') continue; // never introduce a field, never change a type
    const clean = stripPackaging(v);
    if (!clean || clean.length > (opts.maxChars ?? MAX_FIELD_CHARS)) continue;
    if (faultsIn(clean).length) continue;
    clone[k] = clean;
    wrote += 1;
  }
  if (typeof clone.name === 'string') clone.name = name;
  container[name] = clone;
  return { added: name, wrote, error: null };
}

export function createLivingWorld(deps = {}) {
  const stats = {
    ticks: 0, scheduled: 0, added: 0, skippedBusy: 0, skippedBudget: 0,
    failed: 0, problems: [],
  };
  let ticksSinceLast = MIN_TICKS_BETWEEN;
  let dayOfBudget = null;
  let spentToday = 0;
  let running = false;
  let taskIndex = 0;

  const budget = deps.callsPerDay ?? IDLE_CALLS_PER_DAY;
  const minTicks = deps.minTicks ?? MIN_TICKS_BETWEEN;

  const currentDay = () => {
    if (typeof deps.day === 'function') return deps.day();
    const state = deps.state
      || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.State);
    const v = state && state.variables;
    return v && typeof v.gameday === 'number' ? v.gameday : 0;
  };

  async function runOnce() {
    const setup = deps.setup
      || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.setup);
    const model = deps.model;
    if (!setup || !model) return null;

    // Rotate, so one table does not grow while the others stay frozen.
    for (let i = 0; i < TASKS.length; i++) {
      const task = TASKS[(taskIndex + i) % TASKS.length];
      const container = containerFor(setup, task);
      const list = records(container);
      if (!list.length) continue;
      taskIndex = (taskIndex + i + 1) % TASKS.length;

      const [, sample] = list[Math.floor(Math.random() * list.length)];
      const names = list.map(([k]) => k).slice(0, 40);
      const prompt = buildTaskPrompt(task, deps.premise, deps.lexicon, sample)
        .replace('EXISTING NAMES (do not reuse)\n', `EXISTING NAMES (do not reuse)\n${names.join(', ')}\n`);

      let reply;
      try {
        reply = await model.ask(prompt, { maxTokens: 260, temperature: 0.95, background: true });
      } catch (err) {
        stats.failed += 1;
        stats.problems.push(`${task.key}: ${err && err.message ? err.message : String(err)}`);
        return null;
      }
      const { value, error } = parseTaskReply(reply);
      if (error) {
        stats.failed += 1;
        stats.problems.push(`${task.key}: ${error}`);
        return null;
      }
      const res = applyTaskReply(container, sample, value, { maxChars: deps.maxChars });
      if (res.error) {
        stats.failed += 1;
        stats.problems.push(`${task.key}: ${res.error}`);
        return null;
      }
      stats.added += 1;
      return { task: task.key, name: res.added, label: task.label };
    }
    return null;
  }

  // Called when the player lands on a passage - the moment they are reading
  // rather than waiting. Returns what it did, or null, and never throws: this
  // runs inside an engine event handler and a throw there breaks the render.
  async function tick() {
    stats.ticks += 1;
    const model = deps.model;
    if (!model || !model.available || !model.available()) return null;
    if (running) return null;

    const day = currentDay();
    if (day !== dayOfBudget) { dayOfBudget = day; spentToday = 0; }
    if (spentToday >= budget) { stats.skippedBudget += 1; return null; }

    ticksSinceLast += 1;
    if (ticksSinceLast < minTicks) return null;

    // The whole idle-only policy, in one line: it cannot preempt, so it does
    // not compete.
    if (typeof model.idle === 'function' && !model.idle()) {
      stats.skippedBusy += 1;
      return null;
    }

    running = true;
    ticksSinceLast = 0;
    spentToday += 1;
    stats.scheduled += 1;
    try {
      return await runOnce();
    } catch (err) {
      stats.failed += 1;
      stats.problems.push(String(err && err.message ? err.message : err));
      return null;
    } finally {
      running = false;
    }
  }

  return { tick, stats, get spentToday() { return spentToday; } };
}

// Installs tick() on the engine's own post-render event. :passagedisplay fires
// after a passage is on screen, which is exactly the idle moment, and it needs
// no polling timer that would keep running after the player leaves.
export function installLivingWorld(world, deps = {}) {
  const $ = deps.jQuery || (typeof window !== 'undefined' ? window.jQuery || window.$ : null);
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  if (!world || typeof world.tick !== 'function') return false;
  const fire = () => { Promise.resolve(world.tick()).catch(() => {}); };
  if ($ && doc) { $(doc).on(':passagedisplay', fire); return true; }
  if (doc && doc.addEventListener) { doc.addEventListener(':passagedisplay', fire); return true; }
  return false;
}
