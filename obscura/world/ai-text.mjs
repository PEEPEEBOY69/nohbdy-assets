// world/ai-text.mjs — the Perchance ai-text-plugin, behind one queue.
//
// Three platform facts this exists to respect, all verified in the house guide
// and BlizzardUI rather than assumed:
//
//  1. CONCURRENT CALLS BREAK THE PLUGIN. It uses a single shared iframe and
//     fails with `iframe.contentWindow null` if two ai() calls overlap. A world
//     build wants 35 tables' worth of text, so this is not a corner case - it
//     is the normal path. Every call goes through one chain.
//
//  2. THE PROMPT IS A SINGLE `instruction` STRING. No roles, no system slot.
//     Section labels in CAPITALS are how the model is told what is what.
//
//  3. THE BUDGET IS 6,000 TOKENS AND IT IS HARD. Above it the provider refuses
//     the call: a prompt over budget is a turn that does not happen, not an
//     expensive one. So an over-budget prompt is refused HERE, with a problem
//     the caller can act on, rather than sent and lost.
export const PROMPT_TOKEN_BUDGET = 6000;

// The house estimate, matched deliberately so budgets mean the same thing
// across projects. Conservative on purpose - it over-counts rather than under.
export function estimateTokens(value) {
  const text = String(value || '');
  if (!text) return 0;
  let bytes = text.length * 2;
  try { bytes = new TextEncoder().encode(text).length; } catch { /* no TextEncoder here */ }
  return Math.max(Math.ceil(bytes / 3), Math.ceil(text.length / 3.5));
}

// `ai` is a bare global on a Perchance page, not a property of anything we own.
export function resolvePlugin(scope) {
  const g = scope || (typeof globalThis !== 'undefined' ? globalThis : {});
  if (typeof g.ai === 'function') return g.ai;
  return null;
}

export function createModel(opts = {}) {
  const plugin = opts.plugin || resolvePlugin(opts.scope);
  const budget = opts.budget ?? PROMPT_TOKEN_BUDGET;
  // One chain. The tail must never reject, or every later call inherits the
  // failure - a lesson already paid for in BlizzardUI.
  let chain = Promise.resolve();
  const stats = { calls: 0, refused: 0, failed: 0, maxConcurrent: 0, background: 0 };
  let inFlight = 0;
  // Everything waiting on the single chain, not just what is executing. The
  // background world builder asks this before it schedules anything: with one
  // shared iframe there is no way to run alongside a call the player is
  // waiting on, so the only correct answer is not to start one.
  let queued = 0;

  async function run(instruction, callOpts) {
    inFlight += 1;
    stats.maxConcurrent = Math.max(stats.maxConcurrent, inFlight);
    try {
      stats.calls += 1;
      const request = plugin({
        instruction,
        temperature: callOpts.temperature ?? 0.8,
        maxTokens: callOpts.maxTokens ?? 700,
        stopSequences: callOpts.stopSequences ?? ['\n\nTASK:', '\n\nSHAPE:'],
      });
      const result = request && typeof request.then === 'function' ? await request : request;
      // The plugin returns either a string or an object carrying generatedText.
      return String(result && result.generatedText !== undefined ? result.generatedText : result || '');
    } finally {
      inFlight -= 1;
    }
  }

  return {
    stats,
    available: () => typeof plugin === 'function',
    // Nothing queued and nothing running. Background work checks this and
    // declines to schedule otherwise, which is the whole of the idle-only
    // policy: it cannot preempt, so it must not compete.
    idle: () => queued === 0,
    pending: () => queued,
    async ask(instruction, callOpts = {}) {
      if (typeof plugin !== 'function') {
        throw new Error('ai-text-plugin is not loaded');
      }
      const tokens = estimateTokens(instruction);
      if (tokens > budget) {
        stats.refused += 1;
        const err = new Error(`prompt is ${tokens} tokens, over the ${budget} budget`);
        err.code = 'OBSCURA_OVER_BUDGET';
        throw err;
      }
      queued += 1;
      if (callOpts.background) stats.background += 1;
      const mine = chain.then(() => run(instruction, callOpts));
      chain = mine.then(() => undefined, () => undefined);
      try {
        return await mine;
      } catch (err) {
        stats.failed += 1;
        throw err;
      } finally {
        queued -= 1;
      }
    },
  };
}

// One model per plugin function for the whole page. The build, the living
// world and the painter each need the text model, and two models would be two
// queues calling one plugin that breaks when calls overlap. A WeakMap, so a
// plugin that goes away takes its queue with it.
const shared = new WeakMap();

export function sharedModel(opts = {}) {
  const plugin = opts.plugin || resolvePlugin(opts.scope);
  if (typeof plugin !== 'function') return createModel({ ...opts, plugin: null });
  if (!shared.has(plugin)) shared.set(plugin, createModel({ ...opts, plugin }));
  return shared.get(plugin);
}
