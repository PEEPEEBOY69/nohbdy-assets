// world/bundle.mjs — the single entry the published page loads.
//
// Everything reachable from here runs in a browser. No node: builtins, no
// filesystem, no import.meta.url path arithmetic - a node: import does not
// fail at build time, it fails in the player's browser, on the one path that
// has no test. tests/build.test.mjs asserts the whole reachable graph.
export { buildWorld, referenceGraph, applyWorld } from './builder.mjs';
export { assignTiers, openingTables, TIER, OPENING_SEEDS } from './tiers.mjs';
export { createStore, browserIdb, STORE_NAMES, DB_NAME } from './store.mjs';
export {
  startBuild, harvestTables, loadKeySets,
  setLexicon, getLexicon, installLexiconHook,
} from './flow.mjs';
export {
  DEFAULT_LEXICON, TERMS, LEXICON_PROMPT_KEYS,
  compile as compileLexicon, substitute as substituteLexicon,
  generateLexicon, install as installLexicon,
} from './lexicon.mjs';
export { AiGenerator, findPlaceholders, isPlaceholder, singleWordAt } from './ai-generator.mjs';
export { createModel, estimateTokens, PROMPT_TOKEN_BUDGET } from './ai-text.mjs';
export {
  newMemory, remember, compact, contextFor, feelTowards,
  MEMORY_KEEP_RECENT, MEMORY_WEIGHT_KEEP,
} from './memory.mjs';
