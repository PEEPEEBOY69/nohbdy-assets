// world/flow.mjs — the build, as one call a passage can make.
//
// This logic used to live inside a <<script>> body in the passage itself. Two
// problems with that. The smaller one: SugarCube's Wikifier truncated the
// payload when an unrelated PassageReady error aborted the render, producing
// "Unexpected end of input" on JavaScript that parses fine everywhere else -
// so the passage got longer and the failure got stranger. The larger one:
// orchestration written into a passage string is untestable, and this is the
// step the whole slice exists for.
//
// The passage is now one <<run>>. Everything below is reachable from tests.
import { buildWorld, applyWorld } from './builder.mjs';
import { createStore } from './store.mjs';
import { AiGenerator } from './ai-generator.mjs';
import { createModel } from './ai-text.mjs';
import { OPENING_SEEDS } from './tiers.mjs';
import { generateLexicon, DEFAULT_LEXICON, install as installLexicon } from './lexicon.mjs';
import { createLivingWorld, installLivingWorld } from './living.mjs';
import { installHub } from './hub.mjs';
import { installEvents } from './events.mjs';

// Harvests the chassis's own tables out of the running engine. The payload
// already ships them, so generation downloads nothing.
export function harvestTables(setup) {
  const tables = {};
  for (const key of Object.keys(setup || {})) {
    const value = setup[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    tables[key] = value;
  }
  return tables;
}

// The key sets are computed at build time and shipped beside the modules:
// they need engine SOURCE, and re-scanning 5.5 MB at play time would be
// absurd. Without them the build has none of slice 2's key rules.
export async function loadKeySets(base, fetchImpl) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return { keep: {}, verbatim: {} };
  try {
    const res = await f(`${base || ''}world/keys.json`);
    if (!res || !res.ok) throw new Error(`HTTP ${res && res.status}`);
    const json = await res.json();
    return { keep: json.keep || {}, verbatim: json.verbatim || {} };
  } catch (err) {
    // A thinner world is better than no world, but never a silent one.
    console.error('Obscura: key sets unavailable, the world will be thinner', err);
    return { keep: {}, verbatim: {} };
  }
}

export async function startBuild(premise, progressId, done, deps = {}) {
  const setup = deps.setup
    || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.setup);
  const base = deps.base
    || (typeof window !== 'undefined' && window.OBSCURA_ASSET_BASE) || '';
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  const el = progressId && doc ? doc.getElementById(progressId) : null;
  const say = (text) => { if (el) el.textContent = text; };

  try {
    if (!setup) throw new Error('the engine is not loaded');
    const keys = await loadKeySets(base, deps.fetch);
    const assetManifest = deps.assetManifest || await loadAssetManifest(base, deps.fetch);
    const tables = deps.tables || harvestTables(setup);
    const chosen = premise || 'an ordinary town with something underneath';

    // The model writes the world's text when the plugin is there, and the
    // deterministic stub carries it when it is not. Same interface either way -
    // that was the point of building the contract before the model existed.
    // The PAGE hands the plugin in; the module never reaches for a global.
    // `ai` is created by the lists panel's {import:ai-text-plugin} in page
    // scope, and a bare `ai` inside an ES module is a ReferenceError, not a
    // fallback. The house rule is the same for any CDN global: never
    // dereference one at module top level - it cost Nohbdy Hub a live mobile
    // crash. So the passage passes it and this only decides what to do with it.
    const model = deps.model || createModel({ plugin: deps.plugin, scope: deps.scope });

    // The vocabulary comes FIRST, and before any table text, for two reasons.
    // It is one cheap call that decides how 366 substitutions across 89
    // passages will read, and the generated table text should be able to use
    // the same words the passages will. A failure here is never fatal: the
    // default lexicon is already neutral rather than college vocabulary.
    say('Naming things...');
    const lex = await generateLexicon(chosen, model);
    if (lex.problems.length) console.warn('Obscura lexicon:', lex.problems);
    setLexicon(lex.lexicon, deps);

    // The generator is built AFTER the lexicon, and carries it. Every field it
    // writes then uses the same words the passages were just rewritten to -
    // otherwise the chassis's prose says "hab" while the generated prose says
    // "dorm room", which is worse than either alone.
    const generator = deps.generator
      || (model.available() ? new AiGenerator({ model, lexicon: lex.lexicon }) : undefined);

    if (generator) say('Writing your world...');

    const built = await buildWorld(tables, {
      generator,
      premise: chosen,
      seed: chosen,
      readDuringWorldgen: deps.seeds || OPENING_SEEDS,
      assetManifest,
      keepKeys: (name) => keys.keep[name] || [],
      verbatimKeys: (name) => keys.verbatim[name] || [],
      onProgress: (p) => say(`Building ${p.done} of ${p.total}  -  ${p.table}`),
    });

    if (built.problems.length) {
      console.error('Obscura world problems:', built.problems.slice(0, 20));
    }
    // Text failures are reported and never fatal: a world with some
    // placeholders left is playable, a world that failed to build is not.
    if (built.textProblems && built.textProblems.length) {
      console.warn(`Obscura: ${built.textProblems.length} field(s) kept their placeholder`,
        built.textProblems.slice(0, 10));
    }

    applyWorld(setup, built.world);

    // A small, bounded summary of what this build actually did. Not the world
    // itself - that is megabytes and would pin it in memory for the session.
    // This is what a bug report needs: the premise, how much text the model
    // wrote, and whether the one-call-at-a-time queue held.
    //
    // It gets its OWN global rather than hanging off window.Obscura, because
    // that is an ES module namespace object: sealed and non-extensible, so
    // `window.Obscura.lastBuild = x` is a TypeError, not a property.
    if (typeof window !== 'undefined') {
      window.ObscuraBuild = {
        premise: chosen,
        lexicon: lex.lexicon,
        lexiconProblems: lex.problems,
        pinnedAssets: built.pinnedAssets || 0,
        mapsLaidOut: built.mapsLaidOut || [],
        tables: Object.keys(built.world).length,
        problems: built.problems.length,
        textProblems: (built.textProblems || []).length,
        text: generator && generator.stats ? Object.assign({}, generator.stats) : null,
        model: model && model.stats ? Object.assign({}, model.stats) : null,
      };
    }

    const store = deps.store || createStore({});
    await store.saveWorld(deps.slot || 'slot1', {
      premise: chosen,
      lexicon: lex.lexicon,
      tables: Object.keys(built.world).length,
      builtAt: Date.now(),
    });

    // The world keeps being written after this returns. Only started when a
    // model is actually present: the stub path builds a complete world and
    // then stays exactly as built, which is the correct behaviour for it.
    if (model.available()) {
      const living = createLivingWorld({
        model,
        setup,
        premise: chosen,
        lexicon: lex.lexicon,
        callsPerDay: deps.idleCallsPerDay,
      });
      if (installLivingWorld(living, deps)) {
        if (typeof window !== 'undefined') window.ObscuraLiving = living;
      }
    }

    say('Ready.');
    if (typeof done === 'function') done(built);
    return built;
  } catch (err) {
    say(`World build failed: ${err && err.message ? err.message : String(err)}`);
    console.error('Obscura world build failed', err);
    throw err;
  }
}

// The lexicon lives in a STORY VARIABLE. SugarCube puts story variables in the
// save and the history, so the words travel with the playthrough and a reload
// reads the same vocabulary - no separate persistence, no version skew.
// The shipped art, by filename. A missing or unreachable manifest is not
// fatal: pinning is skipped and the loader's broken-image handler covers it.
export async function loadAssetManifest(base, fetchFn) {
  const f = fetchFn || (typeof fetch === 'function' ? fetch : null);
  if (!f) return [];
  try {
    const res = await f(`${base}world/assets.json`);
    if (!res || !res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.images) ? json.images : [];
  } catch {
    return [];
  }
}

export function setLexicon(lexicon, deps = {}) {
  const state = deps.state
    || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.State);
  if (!state || !state.variables) return false;
  state.variables.obscuraLexicon = lexicon;
  return true;
}

export function getLexicon(deps = {}) {
  const state = deps.state
    || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.State);
  const v = state && state.variables && state.variables.obscuraLexicon;
  return v && typeof v === 'object' ? v : DEFAULT_LEXICON;
}

// Installed ONCE at boot, reading the lexicon live on every passage render.
// It must be installed before the first passage renders and must not depend on
// a world having been built, because the chassis's own opening passages are
// full of college vocabulary too.
//
// The "installed" flag lives HERE, not on Config.passages. SugarCube's Config
// objects are non-extensible: assigning the existing `onProcess` property is
// allowed, but adding a marker property throws
// "Cannot add property ..., object is not extensible". Same lesson as the
// module namespace object - do not hang state on an object another library
// owns. The bundle is imported once, so a module-level flag is exactly the
// right scope.
const installedOn = new WeakSet();

// The main loop's engine-facing half. Installed at boot rather than after a
// build, because a RESTORED save arrives with a world already in state and
// still needs setup.ob_obscura_* to exist before its passage renders.
export function installHubHook(deps = {}) {
  try { return installHub(deps); } catch { return false; }
}

// Pruning has to happen before anything can pick an event, and a restored save
// needs it as much as a new game does. Idempotent, so running it twice costs
// nothing.
export function installEventsHook(deps = {}) {
  try { return installEvents(deps); } catch { return null; }
}

export function installLexiconHook(deps = {}) {
  const config = deps.config
    || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.Config);
  if (!config || !config.passages) return false;
  if (installedOn.has(config.passages)) return true;
  installLexicon(config, () => getLexicon(deps));
  installedOn.add(config.passages);
  return true;
}
