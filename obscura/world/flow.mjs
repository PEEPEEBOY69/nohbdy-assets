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
    const generator = deps.generator
      || (model.available() ? new AiGenerator({ model }) : undefined);
    if (generator) say('Writing your world...');

    const built = await buildWorld(tables, {
      generator,
      premise: chosen,
      seed: chosen,
      readDuringWorldgen: deps.seeds || OPENING_SEEDS,
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

    const store = deps.store || createStore({});
    await store.saveWorld(deps.slot || 'slot1', {
      premise: chosen,
      tables: Object.keys(built.world).length,
      builtAt: Date.now(),
    });

    say('Ready.');
    if (typeof done === 'function') done(built);
    return built;
  } catch (err) {
    say(`World build failed: ${err && err.message ? err.message : String(err)}`);
    console.error('Obscura world build failed', err);
    throw err;
  }
}
