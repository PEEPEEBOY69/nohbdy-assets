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
import { sharedStore } from './store.mjs';
import { AiGenerator } from './ai-generator.mjs';
import { sharedModel } from './ai-text.mjs';
import { OPENING_SEEDS } from './tiers.mjs';
import {
  generateLexicon, DEFAULT_LEXICON, install as installLexicon,
  compile as compileLexicon, substitute as substituteLexicon,
} from './lexicon.mjs';
import { createLivingWorld, installLivingWorld, replayGrowth, GROWTH_KEY } from './living.mjs';
import { WORLD_ID_KEY, newWorldId, persistWorld, createDurable, plain } from './durable.mjs';
import { installHub } from './hub.mjs';
import {
  installEvents, restoreAuthoredEvents, pruneDanglingEvents, STATE_KEY as EVENTS_KEY,
} from './events.mjs';
import { generatePlaceNames, installPlaceNames, STATE_KEY as PLACES_KEY } from './places.mjs';
import { buildPersona, faultsIn } from './persona.mjs';
import { installPainter, paintEnabled, setPaintEnabled } from './painter.mjs';
import { installSidebar } from './sidebar.mjs';
import { installPhone } from './phone.mjs';

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
    // SHARED, not created: the living world and the painter use the same
    // plugin, and two queues would overlap calls the plugin cannot take.
    const model = deps.model || sharedModel({ plugin: deps.plugin, scope: deps.scope });

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

    // The world is applied as the data that is saved - no generated function
    // stubs - so a fresh session and a reloaded one run the same world.
    applyWorld(setup, plain(built.world) || built.world);

    // The geography. The map is carried whole, so without this every place
    // keeps the original's name - Blodgett Gymnasium in a rain-dark city.
    // Names are written into a story variable and only what is DISPLAYED is
    // routed through them; the nodes themselves are never touched.
    if (model.available()) {
      say('Naming places...');
      const places = await generatePlaceNames({
        setup, model, faultsIn, persona: buildPersona(chosen, lex.lexicon),
      });
      if (places.problems.length) console.warn('Obscura places:', places.problems);
      const st = deps.state
        || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.State);
      if (st && st.variables) st.variables[PLACES_KEY] = places.names;
    }

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
        singletonsEnforced: built.singletonsEnforced || 0,
        referencesResolved: built.referencesResolved || 0,
        tables: Object.keys(built.world).length,
        problems: built.problems.length,
        textProblems: (built.textProblems || []).length,
        text: generator && generator.stats ? Object.assign({}, generator.stats) : null,
        model: model && model.stats ? Object.assign({}, model.stats) : null,
      };
    }

    // The world itself goes to IndexedDB under a new id, and the id goes in
    // the save. `setup` is rebuilt from the chassis on every page load, so
    // without this a reload put the save back on the placeholder tables.
    // A world starts with nothing grown and no authored events of its own.
    const st = deps.state
      || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.State);
    const vars = st && st.variables;
    const worldId = deps.worldId || newWorldId();
    if (vars) {
      vars[WORLD_ID_KEY] = worldId;
      vars[GROWTH_KEY] = [];
      vars[EVENTS_KEY] = {};
    }
    markWorldApplied(worldId);
    const store = deps.store || sharedStore();
    try {
      const saved = await persistWorld(store, worldId, built.world, {
        premise: chosen, lexicon: lex.lexicon, builtAt: Date.now(),
      });
      built.persisted = { worldId, tables: saved.length };
    } catch (err) {
      // Playable now, gone on reload - which the player must be told, not
      // discover.
      built.persisted = { worldId, error: String(err && err.message ? err.message : err) };
      console.warn('Obscura: this world could not be stored in the browser and will not survive a reload', err);
    }

    // The world keeps being written after this returns. Only started when a
    // model is actually present: the stub path builds a complete world and
    // then stays exactly as built, which is the correct behaviour for it.
    if (model.available()) {
      startLivingWorld({
        ...deps,
        model,
        setup,
        state: st,
        premise: () => (vars && vars.obscuraPremise) || chosen,
        lexicon: () => getLexicon(deps),
        callsPerDay: deps.idleCallsPerDay,
      });
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

// ONE living world per page. It is started after a build and again when a
// save's world is restored, and both can happen in one session.
let livingWorld = null;

export function startLivingWorld(deps = {}) {
  if (livingWorld) return livingWorld;
  const world = createLivingWorld(deps);
  if (installLivingWorld(world, deps)) {
    livingWorld = world;
    if (typeof window !== 'undefined') window.ObscuraLiving = world;
  }
  return world;
}

// The restore side of world/durable.mjs, installed at boot. A build marks its
// world as applied so the hook does not load back what is already in `setup`;
// the mark is kept here in case the build finishes before the hook exists.
let durable = null;
let builtWorldId = null;

export function markWorldApplied(id) {
  builtWorldId = id;
  if (durable) durable.markApplied(id);
}

export function installWorldRestore(deps = {}) {
  if (durable) return durable;
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  if (!SC && !deps.setup) return null;
  const setupOf = () => deps.setup || (SC && SC.setup);
  const varsOf = () => (deps.state || (SC && SC.State) || {}).variables;
  const has = deps.hasPassage
    || ((name) => { try { return !!(SC && SC.Story && SC.Story.has(name)); } catch { return false; } });
  durable = createDurable({
    store: deps.store || sharedStore(),
    setup: setupOf,
    state: varsOf,
    apply: applyWorld,
    afterApply: ({ setup, vars }) => {
      // A restored world can carry event records the shipped passages do not
      // have, and the save's own additions must go back on top of it.
      const pruned = pruneDanglingEvents(setup, has);
      const events = restoreAuthoredEvents(setup, vars);
      const grown = replayGrowth(setup, vars && vars[GROWTH_KEY]);
      const plugin = deps.plugin || null;
      if (plugin) {
        startLivingWorld({
          ...deps,
          model: sharedModel({ plugin }),
          setup,
          state: deps.state || (SC && SC.State),
          premise: () => (varsOf() || {}).obscuraPremise || '',
          lexicon: () => getLexicon(deps),
        });
      }
      return { pruned: pruned.removed, events, grown };
    },
    rerender: deps.rerender || (() => { try { SC.Engine.show(); } catch { /* nothing on screen yet */ } }),
    reload: deps.reload || (() => { if (typeof window !== 'undefined') window.location.reload(); }),
  });
  if (builtWorldId) durable.markApplied(builtWorldId);

  const report = (r) => {
    durable.last = r;
    if (r && r.status === 'restored') console.info('Obscura: world restored', r);
    if (r && r.status === 'missing') console.warn('Obscura: this save\'s world is not stored in this browser', r);
    return r;
  };
  const check = () => durable.ensure().then(report, (err) => {
    durable.last = { status: 'failed', error: String(err && err.message ? err.message : err) };
    console.error('Obscura: world restore failed', err);
  });
  if (typeof window !== 'undefined') window.ObscuraDurable = durable;
  const $ = deps.jQuery || (typeof window !== 'undefined' ? window.jQuery || window.$ : null);
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  if ($ && doc) $(doc).on(':passagedisplay', check);
  else if (doc && doc.addEventListener) doc.addEventListener(':passagedisplay', check);
  durable.firstCheck = check();
  return durable;
}

// For the hub: true when the save names a world this browser does not have.
export function worldMissing(deps = {}) {
  if (!durable) return false;
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const vars = (deps.state || (SC && SC.State) || {}).variables;
  return !!(vars && vars[WORLD_ID_KEY] && durable.missing().includes(vars[WORLD_ID_KEY]));
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
  try {
    return installHub({
      // A map's own name is the original's ("Campus"); its title goes through
      // this world's vocabulary, as the passages' text does.
      mapName: (key, map) => substituteLexicon(String((map && map.name) || key), compileLexicon(getLexicon(deps))),
      // The switch is offered only where a painter was installed.
      paint: () => ({ available: typeof window !== 'undefined' && !!window.ObscuraPainter, on: paintEnabled() }),
      togglePaint: () => setPaintEnabled(!paintEnabled()),
      notice: () => (worldMissing(deps)
        ? 'This world was built in another browser, or this browser has forgotten it. Its places and people are placeholders here.'
        : null),
      ...deps,
    });
  } catch { return false; }
}

// The phone's screens (world/phone.mjs). None of the original's shipped.
export function installPhoneHook(deps = {}) {
  try { return installPhone(deps); } catch { return false; }
}

// The sidebar as Obscura's own (world/sidebar.mjs): the chassis's markup,
// decorated. The institution's button is labelled by the world's vocabulary,
// so its word is worked out the way the label itself is.
export function installSidebarHook(deps = {}) {
  try {
    return installSidebar({
      ...deps,
      institutionWord: () => substituteLexicon('College', compileLexicon(getLexicon(deps))),
    });
  } catch (err) {
    console.warn('Obscura: the sidebar decoration could not start', err);
    return null;
  }
}

// Perchance paints each place for this world (world/painter.mjs). Installed at
// boot beside the restore hook; `plugin` is the lists panel's textToImage and
// `textPlugin` its ai, whose SHARED queue the looks use.
export function installPainterHook(deps = {}) {
  try {
    if (typeof deps.plugin !== 'function') return null;
    const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
    const vars = () => ((deps.state || (SC && SC.State) || {}).variables || {});
    return installPainter({
      ...deps,
      store: deps.store || sharedStore(),
      model: deps.model || (typeof deps.textPlugin === 'function' ? sharedModel({ plugin: deps.textPlugin }) : null),
      persona: () => buildPersona(vars().obscuraPremise || '', getLexicon(deps)),
      faultsIn,
    });
  } catch (err) {
    console.warn('Obscura: the painter could not start', err);
    return null;
  }
}

// Pruning has to happen before anything can pick an event, and a restored save
// needs it as much as a new game does. Idempotent, so running it twice costs
// nothing.
// The display route for place names. At boot, so a restored save shows the
// names it was built with before its first passage renders.
export function installPlacesHook(deps = {}) {
  try {
    const setup = deps.setup
      || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.setup);
    const state = deps.state
      || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.State);
    return installPlaceNames(setup, () => state && state.variables);
  } catch { return false; }
}

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
