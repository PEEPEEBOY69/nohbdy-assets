// world/ai-generator.mjs — the model writes the world's text.
//
// Slice 2 built the interface for exactly this: specFor derives the spec, a
// generator fills it, remapWorld reconciles it. This replaces the middle step
// and nothing else.
//
// It does NOT ask the model for structure. Nine defect classes in slice 2 and
// three more in slices 3-4 all came from structure the engine required and a
// schema could not express: keys that are contract, enums the engine switches
// on, positional weighted lists, fields whose ABSENCE selects a fallback,
// members indexed by a computed key. A model inventing that structure would
// reintroduce every one of them.
//
// So the base generator produces valid structure first, and the model replaces
// only the PLACEHOLDER strings inside it - the `[...]` fillers that are
// visibly unfinished in game today. Conformance cannot break, because a string
// stays a string; enum fields are never placeholders, because stubFor fills
// those from the enum.
import { StubGenerator } from '../tools/generator.mjs';
import { buildPersona, faultsIn, stripPackaging } from './persona.mjs';
import { createModel, estimateTokens, PROMPT_TOKEN_BUDGET } from './ai-text.mjs';
import { parseModelJson } from './safejson.mjs';

// The filler convention the whole pipeline already uses: `[ob_names-1]`,
// `[description — unwritten #123]`. `#distinguish` and the premise weaving test
// for exactly this shape.
export const isPlaceholder = (v) => typeof v === 'string' && v.startsWith('[') && v.endsWith(']');

export const MAX_REPLACEMENT_CHARS = 320;
// How many fields go in one prompt. This is a CALL-COUNT decision, not a
// budget one: calls cannot run concurrently (one shared iframe), so a world
// build is strictly sequential. At 18 fields the full opening tier took 211
// calls - on a live provider at 2-5s each, that is 7 to 17 minutes to start a
// game. At 40 the prompt is still ~2.5k characters, far under the 6,000-token
// ceiling, and the binding limit becomes the model's OUTPUT size, which is why
// maxTokens scales with the batch below.
export const FIELDS_PER_PROMPT = 40;

// A hard ceiling on how much text one world build will ask for. Without it a
// larger chassis silently turns into a twenty-minute wait. Whatever is left
// keeps its placeholder and can be written lazily on first encounter.
export const MAX_FIELDS_PER_BUILD = 1200;

// Walks generated data and collects every placeholder with its path.
export function findPlaceholders(value, prefix = '', out = [], depth = 0) {
  if (depth > 8 || !value || typeof value !== 'object') return out;
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);
  for (const [k, v] of entries) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (isPlaceholder(v)) {
      // `group` is the container: siblings of one pool share it, which is what
      // makes the distinctness rule enforceable. Slice 2 measured what
      // identical values in an identity pool cost - every generated person got
      // the same name and ob_unique_random_name span at 100% CPU forever.
      out.push({
        path,
        value: v,
        group: prefix || '(root)',
        label: path.split('.').slice(-2).join('.') || path,
        singleWord: false,
      });
    } else if (v && typeof v === 'object') {
      findPlaceholders(v, path, out, depth + 1);
    }
  }
  return out;
}

// Whether a field must be written as ONE word, derived from the ORIGINAL data
// rather than from the placeholder.
//
// The first version read the placeholder: no whitespace meant one word. That
// is wrong in practice, because stubFor emits `[path]` for a prose field too -
// so 2,896 of 3,080 fields demanded one word and a cooperative model was
// rejected on nearly all of them. The world would have been one-word
// descriptions everywhere.
//
// The original knows. ob_names.female held "Emma", "Isabella" - single words,
// because ob_random_name joins first + " " + last and ob_name_in_use compares
// split(' ')[0] and [1]. A description held a sentence. Sampling the siblings
// of the same container answers it without special-casing any table.
export function singleWordAt(source, path) {
  if (!source || typeof source !== 'object') return false;
  const parts = path.split('.');
  let node = source;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!node || typeof node !== 'object') return false;
    node = node[parts[i]];
  }
  if (!node || typeof node !== 'object') return false;
  const last = parts[parts.length - 1];
  const exact = node[last];
  // Stripped prose is prose, whatever is next to it. The chassis only ever
  // stripped the original's writing.
  if (typeof exact === 'string' && /unwritten #\d+/.test(exact)) return false;
  if (typeof exact === 'string' && exact && !isPlaceholder(exact)) return !/\s/.test(exact);
  // Only a POOL is judged by its members: a list, or an object keyed by index.
  // A record's other fields are different fields - a description beside
  // `slot: "floor"` was ruled one word, and the model was refused every
  // sentence it wrote.
  const isPool = Array.isArray(node) || Object.keys(node).every((k) => /^\d+$/.test(k));
  if (!isPool) return false;
  const samples = Object.values(node)
    .filter((v) => typeof v === 'string' && v && !isPlaceholder(v))
    .slice(0, 8);
  if (!samples.length) return false;
  return samples.every((v) => !/\s/.test(v));
}

// One instruction string, CAPS section labels - the platform has no roles and
// no system slot, and the prompt viewer splits on these same labels.
export function buildPrompt(premise, table, fields, opts = {}) {
  const max = opts.maxChars ?? MAX_REPLACEMENT_CHARS;
  // The persona replaces the bare WORLD PREMISE header this used to open with.
  // It carries the premise, the generated vocabulary and the standing output
  // rules, so the model knows what it is writing before it is told what to
  // write. Without it the model narrates stage directions and reaches for the
  // chassis's college vocabulary that the lexicon has just replaced.
  const lines = [
    buildPersona(premise, opts.lexicon || {}),
    '',
    'TABLE',
    `${table} — writing the text for ${fields.length} field(s) of a life simulator's data`,
    '',
    'RULES',
    '- Reply with ONLY a JSON object. No prose, no markdown, no code fences.',
    '- Use the NUMBER of each field as the JSON key, as a string: {"1": "...", "2": "..."}.',
    '- Every number below must appear exactly once, with a string value.',
    '- Values in the same field group must all be DIFFERENT from each other.',
    `- Keep each value under ${max} characters.`,
    '- Write it as it would read in the world itself, never about the game.',
    '- SINGLE-WORD fields must be one word containing no spaces.',
    '',
    'FIELDS',
  ];
  // Numbered ids, not paths. A path like `T-shirt and Jeans.items.0.item`
  // contains spaces and dots, and a model cannot reliably echo it as a JSON
  // key - measured at 35% of fields written before this changed. Numbers are
  // also far cheaper against the 6,000-token budget.
  fields.forEach((f, i) => {
    lines.push(`${i + 1}. ${f.label}${f.singleWord ? '   (SINGLE-WORD)' : ''}`);
  });
  lines.push('', 'TASK', 'Write every field above so it belongs to the world in WORLD PREMISE.');
  if (opts.errors && opts.errors.length) {
    lines.push('', 'PREVIOUS ATTEMPT FAILED', ...opts.errors.slice(0, 6).map(e => `- ${e}`),
      'Return only the JSON object, with every key present.');
  }
  return lines.join('\n');
}

// Models wrap JSON in prose and fences however often you ask them not to.
export function parseReply(text) {
  const raw = String(text || '').trim();
  if (!raw) return { value: null, error: 'empty reply' };
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1].trim() : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return { value: null, error: 'no JSON object in the reply' };
  try {
    const parsed = parseModelJson(body.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: null, error: 'reply was not a JSON object' };
    }
    return { value: parsed, error: null };
  } catch (err) {
    return { value: null, error: `reply was not valid JSON: ${err.message}` };
  }
}

// Only a string, only under the cap, only single-word where the placeholder
// was. Anything else is reported and the placeholder is kept.
export function checkReplacement(field, replacement, opts = {}) {
  const max = opts.maxChars ?? MAX_REPLACEMENT_CHARS;
  if (typeof replacement !== 'string') return `${field.path}: not a string`;
  // Packaging is removed, not rejected: a good sentence wrapped in quotes or
  // prefixed with "Here is:" is a formatting slip, and throwing the whole
  // batch away over it costs a call to get the same words back.
  const trimmed = stripPackaging(replacement);
  if (!trimmed) return `${field.path}: empty`;
  if (trimmed.length > max) return `${field.path}: ${trimmed.length} chars, over ${max}`;
  if (field.singleWord && /\s/.test(trimmed)) return `${field.label}: must be one word, got "${trimmed}"`;
  if (isPlaceholder(trimmed)) return `${field.label}: still a placeholder`;
  // The persona forbids these; this is where the forbidding is enforced. A
  // rejected value is retried with the fault named in PREVIOUS ATTEMPT FAILED,
  // which is the only feedback the model ever gets.
  const faults = faultsIn(trimmed);
  if (faults.length) return `${field.label}: ${faults.join(', ')}`;
  // Identical values inside one pool are the spin from slice 2: every person
  // got the same name, ob_name_in_use rejected every candidate, and
  // ob_unique_random_name never exited. A model asked for 30 names WILL repeat
  // itself, so this is enforced rather than requested.
  if (opts.taken && opts.taken.has(trimmed.toLowerCase())) {
    return `${field.label}: duplicates another value in the same group ("${trimmed}")`;
  }
  return null;
}

// A path is a dot-joined string, or - where a key can contain a dot (a book
// titled "vol. 1: ...") - the exact list of keys.
function setPath(root, path, value) {
  const parts = Array.isArray(path) ? path : path.split('.');
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    node = node && node[parts[i]];
    if (!node || typeof node !== 'object') return false;
  }
  const last = parts[parts.length - 1];
  if (!node || typeof node !== 'object' || !(last in node)) return false;
  node[last] = value;
  return true;
}

export class AiGenerator {
  constructor(opts = {}) {
    this.base = opts.base || new StubGenerator();
    this.model = opts.model || createModel(opts);
    this.maxChars = opts.maxChars ?? MAX_REPLACEMENT_CHARS;
    this.fieldsPerPrompt = opts.fieldsPerPrompt ?? FIELDS_PER_PROMPT;
    // Set after the lexicon call, which happens first in the build, so the
    // model writes new text in the same words the passages were rewritten to.
    this.lexicon = opts.lexicon || {};
    this.maxFields = opts.maxFields ?? MAX_FIELDS_PER_BUILD;
    this.retries = opts.retries ?? 1;
    this.stats = { fields: 0, written: 0, rejected: 0, batches: 0, fallbacks: 0, deferred: 0 };
  }

  async generate(spec) {
    // Structure first, and it is already valid. The model never sees a chance
    // to break it.
    const built = this.base.generate(spec);
    if (built.problems.length) return built;

    const found = this.plan(spec, built.data);
    // Bounded on purpose. Calls are strictly sequential, so an unbounded field
    // count is an unbounded wait before the player can start. What is left
    // keeps its placeholder, which is playable, and can be written lazily.
    const fields = found.slice(0, this.maxFields);
    this.stats.fields += fields.length;
    this.stats.deferred += found.length - fields.length;
    if (!fields.length || !this.model.available()) return built;

    const problems = await this.fill(spec, built.data, fields);
    // Problems here are reported but never fatal: a world with some
    // placeholders left is playable, a world that failed to build is not.
    return { data: built.data, problems: built.problems, textProblems: problems };
  }

  // What there is to write in a table's data: every placeholder, with whether
  // the original says it is one word.
  plan(spec, data) {
    const found = findPlaceholders(data);
    for (const f of found) f.singleWord = singleWordAt(spec.source, f.path);
    return found;
  }

  // Writes the given fields into `data`, batch by batch, one call at a time.
  // The background writer calls this directly, with fields it planned at build
  // time; `spec` needs only { table, premise }. `used` is shared across calls
  // so distinctness holds for a pool written over several visits. Returns the
  // problems; never throws for a text failure.
  async fill(spec, data, fields, used = new Map(), callOpts = {}) {
    const problems = [];
    // Shared across batches, so distinctness holds for a pool split over
    // several prompts, and seeded with the values already in the data so the
    // model cannot collide with one it was never shown.
    for (const f of fields) {
      if (!used.has(f.group)) used.set(f.group, new Set());
    }
    for (let i = 0; i < fields.length; i += this.fieldsPerPrompt) {
      const batch = fields.slice(i, i + this.fieldsPerPrompt);
      batch.forEach((f, n) => { f.id = n + 1; });
      await this.#writeBatch(spec, data, batch, problems, used, callOpts);
    }
    return problems;
  }

  async #writeBatch(spec, data, batch, problems, used, callOpts = {}) {
    let errors = [];
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const prompt = buildPrompt(spec.premise, spec.table, batch, {
        lexicon: this.lexicon,
        maxChars: this.maxChars,
        errors: attempt ? errors : null,
      });
      if (estimateTokens(prompt) > PROMPT_TOKEN_BUDGET) {
        problems.push(`${spec.table}: prompt over budget with ${batch.length} fields`);
        this.stats.fallbacks += 1;
        return;
      }
      this.stats.batches += 1;
      let reply;
      try {
        // A one-word field is a few tokens; asking room for a sentence per
        // name only let a slow model take longer.
        const perField = (f) => (f.singleWord ? 16 : 70);
        reply = await this.model.ask(prompt, {
          ...callOpts,
          maxTokens: 60 + batch.reduce((n, f) => n + perField(f), 0),
        });
      } catch (err) {
        problems.push(`${spec.table}: ${err.message}`);
        this.stats.fallbacks += 1;
        return;
      }
      const { value, error } = parseReply(reply);
      if (error) {
        errors = [error];
        // On the LAST attempt a parse failure has to be recorded here. Falling
        // through to `continue` ended the loop silently, so a model that never
        // returned JSON produced no problem at all - the one failure mode this
        // whole path exists to report.
        if (attempt === this.retries) {
          problems.push(`${spec.table}: ${error}`);
          this.stats.fallbacks += 1;
        }
        continue;
      }

      errors = [];
      let wrote = 0;
      for (const field of batch) {
        const candidate = value[String(field.id)] ?? value[field.label] ?? value[field.path];
        const bad = checkReplacement(field, candidate, {
          maxChars: this.maxChars,
          taken: used.get(field.group),
        });
        if (bad) { errors.push(bad); this.stats.rejected += 1; continue; }
        // The SAME cleaning checkReplacement validated. Using candidate.trim()
        // here would store the packaging the check just looked past, and the
        // duplicate set would key on a different string than the one written.
        const text = stripPackaging(candidate);
        if (setPath(data, field.path, text)) {
          wrote += 1; this.stats.written += 1;
          if (!used.has(field.group)) used.set(field.group, new Set());
          used.get(field.group).add(text.toLowerCase());
        }
      }
      if (!errors.length) return;
      if (attempt === this.retries) {
        // Keep what was good, report what was not, leave those placeholders.
        for (const e of errors) problems.push(`${spec.table}: ${e}`);
        if (!wrote) this.stats.fallbacks += 1;
      }
    }
  }
}
