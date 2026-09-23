// world/bundle.mjs — the single entry the published page loads.
//
// Everything reachable from here runs in a browser. No node: builtins, no
// filesystem, no import.meta.url path arithmetic - a node: import does not
// fail at build time, it fails in the player's browser, on the one path that
// has no test. tests/build.test.mjs asserts the whole reachable graph.
export { buildWorld, referenceGraph, applyWorld } from './builder.mjs';
export { assignTiers, openingTables, TIER, OPENING_SEEDS } from './tiers.mjs';
export { createStore, sharedStore, browserIdb, STORE_NAMES, DB_NAME } from './store.mjs';
export {
  startBuild, harvestTables, loadKeySets,
  setLexicon, getLexicon, installLexiconHook, installHubHook, installEventsHook, installPlacesHook,
  loadAssetManifest, installWorldRestore, startLivingWorld, markWorldApplied, worldMissing,
  installPainterHook, installSidebarHook, installPhoneHook,
} from './flow.mjs';
export { phoneHome, phoneContacts, phoneCalendar, knownPeople, installPhone } from './phone.mjs';
export { decorateSidebar, installSidebar, iconKey, needTone, ICONS } from './sidebar.mjs';
export {
  createPainter, createLooks, installPainter, paintPrompt, buildLooksPrompt, parseLooks,
  pictureKey, lookKey, processPicture, STYLE as PAINT_STYLE, NEGATIVE as PAINT_NEGATIVE,
} from './painter.mjs';
export { keyOutBackground, alphaBox, fitInto, hardenAlpha, FRAME_W, FRAME_H } from './pixels.mjs';
export {
  WORLD_ID_KEY, newWorldId, persistWorld, loadWorld, createDurable,
} from './durable.mjs';
export { hubHtml, placesIn, startingPlace, exitsOf, installHub, placePictureName } from './hub.mjs';
export { placeRoster, generatePlaceNames, installPlaceNames, displayName } from './places.mjs';
export {
  pruneDanglingEvents, registerAuthoredEvent, authoredEventText, freeSlot,
  EVENT_SLOTS, slotNames, restoreAuthoredEvents,
} from './events.mjs';
export { pinAssets, looksLikeAsset, groupManifest, familyOf } from './assets.mjs';
export { pinMapRegions, gridFor, MAP_W, MAP_H } from './mapgrid.mjs';
export { enforceSingletons, singletonFieldsOf } from './invariants.mjs';
export { findReferenceFields, resolveReferences } from './references.mjs';
export {
  buildPersona, faultsIn, stripPackaging, OUTPUT_RULES,
} from './persona.mjs';
export {
  createLivingWorld, installLivingWorld, TASKS, IDLE_CALLS_PER_DAY,
  replayGrowth, cloneRecord, GROWTH_KEY, runEventTask,
} from './living.mjs';
export {
  DEFAULT_LEXICON, TERMS, LEXICON_PROMPT_KEYS,
  compile as compileLexicon, substitute as substituteLexicon,
  generateLexicon, install as installLexicon,
} from './lexicon.mjs';
export { AiGenerator, findPlaceholders, isPlaceholder, singleWordAt } from './ai-generator.mjs';
export { createModel, sharedModel, estimateTokens, PROMPT_TOKEN_BUDGET } from './ai-text.mjs';
export {
  newMemory, remember, compact, contextFor, feelTowards,
  MEMORY_KEEP_RECENT, MEMORY_WEIGHT_KEEP,
} from './memory.mjs';
