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
import { findPlugin } from './plugins.mjs';
import {
  planWorld, planChassis, replayWriting, createWriter, setCurrentWriter, currentWriter,
  tablesForScreen, writingLine, writerStatus, PLAN_LOG, WRITES_LOG, WRITER_FIELDS_PER_CALL,
} from './writer.mjs';
import { installGuard } from './guard.mjs';
import { createBuildScreen } from './buildscreen.mjs';
import { namesFit, generateNames, applyNameLists } from './names.mjs';
import { worldBriefFrom } from './imports.mjs';
import { castSets, mapPending, joinPending, unmapped, CAST_PENDING_KEY } from './cast.mjs';
import { nameTheSchool, schoolTooltips, emptyRenames, placeRenames, RENAMES_KEY, withCoined } from './renames.mjs';
import { OPENING_SEEDS } from './tiers.mjs';
import {
  generateLexicon, DEFAULT_LEXICON, install as installLexicon,
  compile as compileLexicon, substitute as substituteLexicon, applyLexiconToTables, renameRules, renameText,
} from './lexicon.mjs';
import { createLivingWorld, installLivingWorld, replayGrowth, GROWTH_KEY } from './living.mjs';
import { WORLD_ID_KEY, newWorldId, persistWorld, createDurable, plain } from './durable.mjs';
import { installHub } from './hub.mjs';
import {
  installEvents, restoreAuthoredEvents, pruneDanglingEvents, STATE_KEY as EVENTS_KEY,
} from './events.mjs';
import { generatePlaceNames, installPlaceNames, STATE_KEY as PLACES_KEY } from './places.mjs';
import { GEO_KEY, LAYOUT_KEY, buildGeography, geoNames, placesIn, geoOf } from './geography.mjs';
import { generateLayout } from './layout.mjs';
import { GOODS_KEY, generateGoods } from './goods.mjs';
import { buildPersona, faultsIn } from './persona.mjs';
import { installPainter, paintEnabled, setPaintEnabled } from './painter.mjs';
import { installSidebar } from './sidebar.mjs';
import { installPhone } from './phone.mjs';
import { writeTheWorldBank, restoreTalk, startTalkWorld, installTalk, whoTheyAre, standingWith, tierOf } from './talk.mjs';
import { FOOTING } from './talkbank.mjs';
import { installTexting, useTextLog, restoreTexts, writeTheTextBank } from './texting.mjs';
import { emptyTextLog } from './textbank.mjs';
import { installDates, datesOf } from './dates.mjs';
import { installDateScreen } from './datescreen.mjs';
import { installRelations } from './relations.mjs';
import { dateContext } from './datemoments.mjs';
import { useDateLog, emptyDateLog, restoreDateWords, writeDateWords, personBody } from './datebank.mjs';
import { installNarration } from './narration.mjs';
import { installHints } from './hints.mjs';
import { installInclinationsList } from './inclinationslist.mjs';
import { installDescriptions, configLabel } from './describe.mjs';
import { writeTheNarration, restoreNarration, useNarrationLog, emptyNarrationLog, narrationWords } from './narrationbank.mjs';
import { ensureRent, installRent } from './rent.mjs';
import { installWork, restoreMoments, writeLineMoments, useMomentLog } from './workscreen.mjs';
import { jobsOf } from './work.mjs';
import { emptyMomentsLog, bodyOf } from './momentbank.mjs';
import { installPortraits } from './portraits.mjs';
import { installNeeds } from './needs.mjs';
import { installShop } from './shop.mjs';

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

// Player-facing, and mine: first person.
export const NO_MODEL_MESSAGE = "I can't reach Perchance's AI right now, so I can't build your world. "
  + 'Give it a moment, reload the page, and press Build it again.';

// The message, and a way back to the premise, where the build was going to be.
function refuse(el, doc, message, deps) {
  if (!el) return;
  el.textContent = message;
  if (!doc || typeof doc.createElement !== 'function' || typeof el.appendChild !== 'function') return;
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const back = doc.createElement('button');
  back.className = 'macro-button link-internal ob-build-back';
  back.textContent = 'Back';
  back.addEventListener('click', () => { try { SC.Engine.play('ObscuraPremise'); } catch { /* no engine */ } });
  const row = doc.createElement('div');
  row.style.marginTop = '1em';
  row.appendChild(back);
  el.appendChild(row);
}

export async function startBuild(premise, progressId, done, deps = {}) {
  const setup = deps.setup
    || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.setup);
  const base = deps.base
    || (typeof window !== 'undefined' && window.OBSCURA_ASSET_BASE) || '';
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  // Looked up on every line, never once: SugarCube runs this <<run>> while it
  // renders the passage OFF the document, so a lookup here is null and every
  // progress line went nowhere - the player watched "Starting..." for a
  // forty-minute build. By the first await the passage is attached.
  const progressEl = () => (progressId && doc ? doc.getElementById(progressId) : null);
  // The build screen (world/buildscreen.mjs), made the first time there is a
  // real element to put it in. Without one - the tests, a page with no DOM -
  // progress is a line of text in whatever element there is.
  let screen = null;
  const ui = () => {
    if (screen) return screen;
    const el = progressEl();
    if (el && doc && typeof doc.createElement === 'function' && typeof el.appendChild === 'function') {
      try { screen = createBuildScreen(el, { document: doc }); } catch (err) { console.warn('Obscura: no build screen', err); }
    }
    return screen;
  };
  const say = (text) => {
    const s = ui();
    if (s) { s.status(text); return; }
    const el = progressEl();
    if (el) el.textContent = text;
  };
  const stepTo = (key) => { const s = ui(); if (s) s.step(key); };

  try {
    if (!setup) throw new Error('the engine is not loaded');
    const keys = await loadKeySets(base, deps.fetch);
    const assetManifest = deps.assetManifest || await loadAssetManifest(base, deps.fetch);
    const tables = deps.tables || harvestTables(setup);
    // A world brought in on the premise screen (world/premise.mjs) is folded
    // into the premise as a bounded brief: title, setting, what is always
    // true, then as much of the rest as fits.
    const stateVars = (deps.state || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.State) || {}).variables || {};
    const brought = stateVars.obscuraImport && typeof stateVars.obscuraImport === 'object' ? stateVars.obscuraImport : null;
    const brief = brought && (brought.lore && brought.lore.length || brought.setting) ? worldBriefFrom(brought, 1400) : '';
    const typed = premise || '';
    const chosen = (brief && typed && !brief.startsWith(typed) ? `${typed}\n\n${brief}` : (brief || typed))
      || 'an ordinary town with something underneath';

    // The model writes the world's text. It is found on Perchance's `root`
    // (plugins.mjs): a bare `ai` - what the passage used to hand in - is
    // undefined everywhere but the panel's own inline scripts, so every
    // published world was built with no model while every local walk passed.
    // SHARED, not created: the living world and the painter use the same
    // plugin, and two queues would overlap calls the plugin cannot take.
    const model = deps.model
      || sharedModel({ plugin: deps.plugin || findPlugin('ai', deps.scope), scope: deps.scope });

    // No model, no world. Without one the build can only lay the chassis's
    // placeholders out as a world, which is what players met: a name reading
    // "[ob_names-20]", the original's places, nothing written. An honest stop
    // with a way back beats that. The stub path stays for the tests and the
    // local harness, which ask for it by name.
    if (!model.available() && !deps.allowStub) {
      console.error('Obscura: no ai-text-plugin on this page; the world was not built');
      refuse(progressEl(), doc, NO_MODEL_MESSAGE, deps);
      return { refused: 'no-model' };
    }

    // The vocabulary comes FIRST, and before any table text, for two reasons.
    // It is one cheap call that decides how 366 substitutions across 89
    // passages will read, and the generated table text should be able to use
    // the same words the passages will. A failure here is never fatal: the
    // default lexicon is already neutral rather than college vocabulary.
    stepTo('words');
    say('Naming things...');
    const lex = await generateLexicon(chosen, model);
    if (lex.problems.length) console.warn('Obscura lexicon:', lex.problems);
    setLexicon(lex.lexicon, deps);
    // what the engine prints straight from a table - what you are wearing -
    // speaks the same words as the passages
    applyLexiconToTables(setup, lex.lexicon);
    // The world as the first call made it: a short premise made concrete, and
    // which of the school's systems it has (world/renames.mjs). Every later
    // call builds from the same picture.
    const world = { setting: lex.setting || '', systems: lex.systems || { timetable: true, grades: true, sports: true, divisions: true } };
    const told = world.setting ? `${chosen}\n\n${world.setting}` : chosen;

    // The structure, from the stub alone - no model. The engine's own data is
    // kept whole; the original's stripped prose is left to the writer. With
    // the model writing every field here, this step was forty minutes of a
    // screen that said "Starting..." (measured on perchance.org, 2026-09-23).
    // Names that belong to the world (world/names.mjs): the engine's own lists
    // unless the vocabulary call said this world's people are not modern
    // English speakers - then one call for lists of its own.
    stepTo('names');
    let nameLists = null;
    if (!namesFit(lex.names)) {
      if (screen) screen.expect('names', 40000);
      say(`Finding ${lex.names} names...`);
      const got = await generateNames(told, lex.names, model);
      if (got.problems.length) console.warn('Obscura names:', got.problems);
      nameLists = got.lists;
    }
    stepTo('layout');
    say('Laying out your world...');
    const built = await buildWorld(tables, {
      generator: deps.generator,
      premise: told,
      seed: chosen,
      readDuringWorldgen: deps.seeds || OPENING_SEEDS,
      assetManifest,
      keepKeys: (name) => keys.keep[name] || [],
      verbatimKeys: (name) => keys.verbatim[name] || [],
    });

    if (built.problems.length) {
      console.error('Obscura world problems:', built.problems.slice(0, 20));
    }

    // Everything still to write, with a blank where it stands: the world's
    // own prose first, then - once the world is applied - the original's
    // stripped prose everywhere else in `setup`. Nothing unwritten is ever a
    // token on screen; the writer fills the blanks while the player plays.
    // The world's own names go into the engine's lists by kind, and into the
    // stored world, so a reload keeps them.
    if (nameLists && tables.ob_names) built.world.ob_names = applyNameLists(tables.ob_names, nameLists);
    const worldPlan = planWorld(built.world, tables);

    // The world is applied as the data that is saved - no generated function
    // stubs - so a fresh session and a reloaded one run the same world.
    applyWorld(setup, plain(built.world) || built.world);
    const plan = [...worldPlan, ...planChassis(setup)];
    built.planned = plan.length;


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
        premise: told,
        world,
        lexicon: lex.lexicon,
        lexiconProblems: lex.problems,
        pinnedAssets: built.pinnedAssets || 0,
        mapsLaidOut: built.mapsLaidOut || [],
        singletonsEnforced: built.singletonsEnforced || 0,
        referencesResolved: built.referencesResolved || 0,
        tables: Object.keys(built.world).length,
        problems: built.problems.length,
        planned: plan.length,
        names: nameLists ? lex.names : 'the engine\'s own',
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
    // SugarCube gives every move a NEW variables object (momentActivate
    // clones the moment), so `vars` is only the state until the player
    // enters the world. Anything that lands later - places, the cast - is
    // written through this, into the moment the player is in when it lands.
    const live = () => (st && st.variables) || vars;
    const worldId = deps.worldId || newWorldId();
    if (vars) {
      vars[WORLD_ID_KEY] = worldId;
      vars[GROWTH_KEY] = [];
      vars[EVENTS_KEY] = {};
      // the week's rent on the player's room (world/rent.mjs)
      ensureRent(vars);
    }
    // no work's moments written yet (world/workscreen.mjs)
    useMomentLog(worldId, emptyMomentsLog());
    // a new world's texts, its people's date words, its narration: none yet
    useTextLog(worldId, emptyTextLog());
    useDateLog(worldId, emptyDateLog());
    useNarrationLog(worldId, emptyNarrationLog());
    markWorldApplied(worldId);
    stepTo('save');
    const store = deps.store || sharedStore();
    try {
      const saved = await persistWorld(store, worldId, built.world, {
        premise: told, lexicon: lex.lexicon, builtAt: Date.now(), logs: [PLAN_LOG, WRITES_LOG],
      });
      await store.saveTable(worldId, PLAN_LOG, plan);
      await store.saveTable(worldId, WRITES_LOG, {});
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
        premise: () => (live() && live().obscuraPremise) || told,
        lexicon: () => getLexicon(deps),
        callsPerDay: deps.idleCallsPerDay,
      });
    }

    // What the build was told - a brought world's brief, a short premise's
    // setting - is carried by the premise from here on: every later prompt
    // (the writer, the living world, the painter) reads $obscuraPremise, and
    // the lore itself - up to 40,000 characters - is not kept in a save that
    // SugarCube copies into every history moment. The world's rulings and
    // the school's renames (data the engine prints as it is, first; the
    // model's names as they land) go in the save beside it.
    if (vars) {
      if (told !== (vars.obscuraPremise || '')) vars.obscuraPremise = told;
      vars.obscuraWorld = world;
      vars[RENAMES_KEY] = { ...emptyRenames(), exact: schoolTooltips(setup, lex.lexicon) };
      // the world's own places, asked for after the hand-over (world/layout.mjs)
      if (model.available()) vars[LAYOUT_KEY] = 'pending';
    }
    // The people the player brought wait in the save from here (world/cast.mjs).
    if (vars && brought) {
      const people = Array.isArray(brought.characters) ? brought.characters : [];
      vars[CAST_PENDING_KEY] = people.map(c => ({ ...c, from: String(brought.title || '').slice(0, 90) }));
      vars.obscuraImport = { title: String(brought.title || '').slice(0, 90), characters: people.length };
    }

    say('Ready.');
    // The player enters when they choose to - or by themselves in a moment if
    // nobody is mid-game on the build screen. Places and the writer start now
    // either way.
    const enterWorld = () => { if (typeof done === 'function') done(built); };
    const shown = ui();
    if (shown) shown.ready(enterWorld); else enterWorld();

    // The world's own places, after the hand-over (world/layout.mjs). Without
    // them every world is the original's campus and town - Blodgett Gymnasium
    // in a rain-dark city. Places are shown from the hub on, and character
    // creation takes longer than this one call; the places named up front were
    // 118 of 141 seconds of waiting (perchance.org, 2026-09-23). Asked before
    // anything else, so it is first in the queue.
    if (model.available()) {
      layTheWorld({ setup, model, persona: buildPersona(told, lex.lexicon), live, SugarCube: deps.SugarCube,
        timetable: !(world && world.systems && world.systems.timetable === false) });
    }

    // Then, one queue in the order the player meets them: the school's names
    // (on every sidebar from the first screen), the people the player brought
    // (read onto the engine's closed sets, made into people at the first real
    // place - installCastHook), and the rest of the world's prose, written
    // while the player picks a name and plays.
    const school = model.available()
      ? nameTheSchool({ setup, model, premise: told, lexicon: lex.lexicon, live, onBatch: () => refreshPlace(deps.SugarCube) })
        .catch((err) => console.warn('Obscura: the school could not be renamed', err))
      : Promise.resolve();
    // How people talk here (world/talk.mjs): the world's own lines, after the
    // school's names and before the people brought in and the writer. Until
    // they land, and wherever a call fails, a conversation uses the lines
    // built in: nobody is ever silent.
    startTalkWorld(worldId);
    const talk = school.then(() => (model.available()
      ? writeTheWorldBank({ model, store, worldId, faultsIn,
        persona: () => buildPersona((live() && live().obscuraPremise) || told, getLexicon(deps)) })
      : null)).catch((err) => console.warn('Obscura: the world\'s lines could not be written', err));
    const cast = talk.then(() => (model.available() && unmapped(vars && vars[CAST_PENDING_KEY]).length
      ? mapPending({ model, premise: told, sets: castSets(setup), vars: live })
      : null)).catch((err) => console.warn('Obscura: the characters could not be read', err));
    if (model.available() && plan.length) {
      cast.finally(() => startWriter({
        model, setup, plan, writes: {}, worldId, store, document: doc,
        premise: () => (live() && live().obscuraPremise) || told,
        lexicon: () => getLexicon(deps),
        jQuery: deps.jQuery,
      }));
    }
    return built;
  } catch (err) {
    if (screen) screen.destroy();
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

// Shows the place on screen again, so what just landed in the background - a
// layout, names - is read on it.
function refreshPlace(SugarCube) {
  const SC = SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  try {
    const tags = SC && SC.Story && SC.State ? SC.Story.get(SC.State.passage).tags : [];
    if (tags && tags.includes('location') && typeof SC.Engine.show === 'function') SC.Engine.show();
  } catch { /* nothing on screen to refresh */ }
}

// Lays the world out in the background (world/layout.mjs) and puts it in the
// state the player is in when it lands: the geography, the names everything
// that prints a place reads, and the on-screen renames of the originals under
// it. A player standing where the new geography has no place is moved to its
// start. Until it lands the world has the original's places, joined; if it
// cannot be made they are named for the world, as they were before there were
// layouts, and the layout is asked for again on the next page load.
function layTheWorld({ setup, model, persona, live, SugarCube, timetable }) {
  return layOut({ setup, model, persona, live, SugarCube, timetable })
    // what its kitchens serve and its shops sell, for the places it has now
    .then(() => nameTheGoods({ setup, model, persona, live }));
}

function layOut({ setup, model, persona, live, SugarCube, timetable }) {
  return generateLayout({ model, persona, timetable, faultsIn })
    .then(({ layout, problems }) => {
      if (problems.length) console.warn('Obscura layout:', problems);
      const geo = layout ? buildGeography(layout, { timetable, setup }) : null;
      const v = live();
      if (!v) return null;
      if (!geo) {
        const named = v[PLACES_KEY] && Object.keys(v[PLACES_KEY]).length;
        return named ? null : nameThePlaces({ setup, model, persona, live, SugarCube }).then(() => null);
      }
      v[GEO_KEY] = geo;
      v[LAYOUT_KEY] = 'done';
      const names = geoNames(geo);
      // the places under no place of the geography keep the names they had
      v[PLACES_KEY] = { ...(v[PLACES_KEY] || {}), ...names };
      const r = v[RENAMES_KEY];
      if (r && typeof r === 'object') { r.exact = r.exact || {}; Object.assign(r.exact, placeRenames(setup, names)); }
      if (v.location && !geo.places[v.location]) {
        v.location = geo.start;
        const node = placesIn(setup).get(geo.start);
        if (node) v.locationblock = node.map;
      }
      refreshPlace(SugarCube);
      return geo;
    })
    .catch((err) => { console.warn('Obscura: the world could not be laid out', err); });
}

// A mark of the places a world's goods were named for: its kitchens and shops,
// by key and name. New places, new goods.
export function goodsSignature(geo) {
  const s = Object.entries((geo && geo.places) || {})
    .filter(([, p]) => p && (p.kind === 'food' || p.kind === 'shop'))
    .map(([k, p]) => `${k}=${p.name}`).join('|');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return `${(geo && geo.source) || 'none'}:${h}`;
}

// What the world's kitchens serve and its shops sell (world/goods.mjs), named
// in the background for the places in play and written into the state the
// player is in when it lands - unless the places changed meanwhile, when they
// are named again for the new ones.
function nameTheGoods({ setup, model, persona, live }) {
  const v0 = live();
  if (!v0) return Promise.resolve(null);
  const geo = geoOf(v0, setup);
  const sig = goodsSignature(geo);
  return generateGoods({ model, persona, geo, faultsIn })
    .then(({ goods, problems }) => {
      if (problems.length) console.warn('Obscura goods:', problems);
      const v = live();
      if (!v || !goods || goodsSignature(geoOf(v, setup)) !== sig) return null;
      v[GOODS_KEY] = { ...goods, for: sig };
      return goods;
    })
    .catch((err) => { console.warn('Obscura: the world\'s goods could not be named', err); });
}

// The original's places, named for the world: for a world that could not be
// laid out (above), as every world's were before there were layouts.
function nameThePlaces({ setup, model, persona, live, SugarCube }) {
  return generatePlaceNames({ setup, model, faultsIn, persona, background: true })
    .then((places) => {
      if (places.problems.length) console.warn('Obscura places:', places.problems);
      const v = live();
      if (v) {
        v[PLACES_KEY] = places.names;
        // and on the screens that read a place's name straight off the map
        const r = v[RENAMES_KEY];
        if (r && typeof r === 'object') { r.exact = r.exact || {}; Object.assign(r.exact, placeRenames(setup, places.names)); }
      }
      refreshPlace(SugarCube);
      return places;
    })
    .catch((err) => { console.warn('Obscura: the places could not be named', err); });
}

// ONE writer per page (world/writer.mjs), started after a build and again
// after a restore with what the log says is still unwritten.
export function startWriter(deps) {
  const previous = currentWriter();
  if (previous) previous.stop();
  const generator = new AiGenerator({
    model: deps.model,
    lexicon: deps.lexicon ? deps.lexicon() : {},
    fieldsPerPrompt: WRITER_FIELDS_PER_CALL,
  });
  const writer = createWriter({
    model: deps.model,
    generator,
    root: () => deps.setup,
    premise: deps.premise,
    plan: deps.plan,
    writes: deps.writes || {},
    save: (writes) => deps.store.saveTable(deps.worldId, WRITES_LOG, writes),
    onProgress: (p) => showWriting(p, deps.document),
  });
  setCurrentWriter(writer);
  if (typeof window !== 'undefined') window.ObscuraWriter = writer;
  installSeenHooks(deps);
  writer.start();
  return writer;
}

// The hub's line, updated in place as the writer goes.
function showWriting(progress, doc) {
  const d = doc || (typeof document !== 'undefined' ? document : null);
  const el = d && typeof d.getElementById === 'function' ? d.getElementById('ob-writing') : null;
  if (!el) return;
  const line = writingLine(progress);
  el.textContent = line;
  if (!line && el.style) el.style.display = 'none';
}

// A screen the player opens moves its tables to the front of the writer's
// queue: the Inventory's items, the Character screen's traits.
let seenHooked = false;
function installSeenHooks(deps = {}) {
  if (seenHooked) return;
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return;
  const $ = deps.jQuery !== undefined ? deps.jQuery : (typeof window !== 'undefined' ? window.jQuery : null);
  const note = (name) => { const w = currentWriter(); if (w) w.seen(tablesForScreen(name)); };
  const onDialog = () => {
    const t = typeof doc.getElementById === 'function' ? doc.getElementById('ui-dialog-title') : null;
    note(t && t.textContent);
  };
  const onPassage = (ev) => note(ev && ev.passage && ev.passage.title);
  if ($) {
    $(doc).on(':dialogopened', onDialog);
    $(doc).on(':passagedisplay', onPassage);
  } else if (typeof doc.addEventListener === 'function') {
    doc.addEventListener(':dialogopened', onDialog);
    doc.addEventListener(':passagedisplay', onPassage);
  }
  seenHooked = true;
}

// The World tab in Options: where the writing is, and pause / carry on.
let writerPaused = false;
export function installWriterControls(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  if (!SC || !SC.setup) return false;
  SC.setup.ob_writer_status = () => writerStatus(currentWriter(), writerPaused);
  SC.setup.ob_writer_pause = (on) => {
    const w = currentWriter();
    writerPaused = !!on && !!w;
    if (!w) return;
    if (on) w.stop(); else w.start();
  };
  return true;
}

// People the player brought join the world at the first place with a
// population to join: a location passage, after character creation.
let castHooked = false;
export function installCastHook(deps = {}) {
  if (castHooked) return true;
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  if (!SC || !doc) return false;
  const $ = deps.jQuery !== undefined ? deps.jQuery : (typeof window !== 'undefined' ? window.jQuery : null);
  const arrive = (ev) => {
    const tags = (ev && ev.passage && ev.passage.tags) || [];
    if (!tags.includes('location')) return;
    const names = joinPending(SC.setup, SC.State.variables);
    if (names.length) console.info('Obscura: joined the world:', names);
  };
  if ($) $(doc).on(':passagedisplay', arrive);
  else if (typeof doc.addEventListener === 'function') doc.addEventListener(':passagedisplay', arrive);
  castHooked = true;
  return true;
}

// The net under the writer's blanks (world/guard.mjs), installed at boot.
let guard = null;
export function installGuardHook(deps = {}) {
  if (guard) return guard;
  // the renames, then a clothing configuration's label in Obscura's words (world/describe.mjs)
  const renames = renamesTransform(deps);
  try { guard = installGuard({ ...deps, transform: (t) => configLabel(renames(t)) }); } catch (err) { console.warn('Obscura: the guard could not start', err); }
  return guard;
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
    afterApply: ({ setup, vars, logs }) => {
      // What the writer wrote goes back FIRST; what it had not reached is
      // blank again (the chassis put its placeholders back on load). First,
      // because the living world's growth is cloned from existing records: a
      // clone replayed before this copied blank fields - the walk counted
      // twenty written fields gone after a reload.
      const plan = logs && Array.isArray(logs[PLAN_LOG]) ? logs[PLAN_LOG] : null;
      const writes = logs && logs[WRITES_LOG] && typeof logs[WRITES_LOG] === 'object' ? logs[WRITES_LOG] : {};
      const remaining = plan ? replayWriting(setup, plan, writes) : [];
      // `setup` came back from the chassis: the world's words go back on its tables
      applyLexiconToTables(setup, getLexicon(deps));
      // A restored world can carry event records the shipped passages do not
      // have, and the save's own additions must go back on top of it.
      const pruned = pruneDanglingEvents(setup, has);
      const events = restoreAuthoredEvents(setup, vars);
      const grown = replayGrowth(setup, vars && vars[GROWTH_KEY]);
      const plugin = deps.plugin || findPlugin('ai', deps.scope);
      const model = plugin ? sharedModel({ plugin }) : null;
      // a layout the page went away before (world/layout.mjs), first in the
      // queue, and the goods after it; a world laid out with no goods for its
      // places (named before v37, or before its places changed) gets them now
      if (model && vars && vars[LAYOUT_KEY] === 'pending') {
        layTheWorld({ setup, model, live: varsOf, SugarCube: SC,
          persona: buildPersona((varsOf() || {}).obscuraPremise || '', getLexicon(deps)),
          timetable: !(vars.obscuraWorld && vars.obscuraWorld.systems && vars.obscuraWorld.systems.timetable === false) });
      } else if (model && vars && (!vars[GOODS_KEY] || vars[GOODS_KEY].for !== goodsSignature(geoOf(vars, setup)))) {
        nameTheGoods({ setup, model, live: varsOf,
          persona: buildPersona((varsOf() || {}).obscuraPremise || '', getLexicon(deps)) });
      }
      // how people talk here: the lines written for this world, from the
      // store, and the world's bank finished if the page went away half-way
      restoreTalk({ store: deps.store || sharedStore(), worldId: vars && vars[WORLD_ID_KEY], model, faultsIn,
        persona: () => buildPersona((varsOf() || {}).obscuraPremise || '', getLexicon(deps)) })
        .catch((err) => console.warn('Obscura: the world\'s lines could not be restored', err));
      // the week's rent on a world made before there was one (world/rent.mjs),
      // and the moments written for the work the player holds, any line of it
      // still unwritten written now (world/workscreen.mjs)
      ensureRent(vars);
      // the world's texts, finished if the player has anyone's number; the
      // words written for the people they date, and for a date set before the
      // page went away (world/texting.mjs, world/datebank.mjs)
      restoreTexts({ store: deps.store || sharedStore(), worldId: vars && vars[WORLD_ID_KEY], model, faultsIn, setup, V: vars,
        sender: bodyOf(setup, vars),
        persona: () => buildPersona((varsOf() || {}).obscuraPremise || '', getLexicon(deps)) })
        .catch((err) => console.warn('Obscura: the texts could not be restored', err));
      restoreDateWords({ store: deps.store || sharedStore(), worldId: vars && vars[WORLD_ID_KEY] })
        .then(() => { for (const d of datesOf(vars || {}).list) if (d.state === 'set') writeWordsFor(setup, vars, deps, d.with); })
        .catch((err) => console.warn('Obscura: the date words could not be restored', err));
      // the world's narration of every act (world/narrationbank.mjs), finished
      // if the player has ever set a date or a night
      restoreNarration({ store: deps.store || sharedStore(), worldId: vars && vars[WORLD_ID_KEY], faultsIn })
        .then(() => { if (datesOf(vars || {}).list.length) writeNarrationFor(setup, vars, deps); })
        .catch((err) => console.warn('Obscura: the narration could not be restored', err));
      restoreMoments({ store: deps.store || sharedStore(), worldId: vars && vars[WORLD_ID_KEY], model, faultsIn,
        jobs: Object.entries(jobsOf(vars)).map(([key, job]) => ({ line: job.line, placeName: (geoOf(vars, setup).places[key] || { name: key }).name })),
        who: bodyOf(setup, vars),
        persona: () => buildPersona((varsOf() || {}).obscuraPremise || '', getLexicon(deps)) })
        .catch((err) => console.warn('Obscura: the moments could not be restored', err));
      if (plugin) {
        startLivingWorld({
          ...deps,
          model,
          setup,
          state: deps.state || (SC && SC.State),
          premise: () => (varsOf() || {}).obscuraPremise || '',
          lexicon: () => getLexicon(deps),
        });
        // a reload in the middle of the renaming resumes it (world/renames.mjs)
        const renames = vars && vars[RENAMES_KEY];
        if (renames && !renames.done) {
          nameTheSchool({ setup, model, premise: (varsOf() || {}).obscuraPremise || '', lexicon: getLexicon(deps), live: varsOf,
            onBatch: () => refreshPlace(SC) }).catch((err) => console.warn('Obscura: the school could not be renamed', err));
        }
        // people still waiting on their answer when the page went away
        if (unmapped(vars && vars[CAST_PENDING_KEY]).length) {
          mapPending({ model, premise: () => (varsOf() || {}).obscuraPremise || '', sets: castSets(setup), vars: varsOf })
            .catch((err) => console.warn('Obscura: the characters could not be read', err));
        }
        if (remaining.length) {
          startWriter({
            model, setup, plan, writes, store: deps.store || sharedStore(),
            worldId: vars && vars[WORLD_ID_KEY],
            document: deps.document,
            premise: () => (varsOf() || {}).obscuraPremise || '',
            lexicon: () => getLexicon(deps),
            jQuery: deps.jQuery,
          });
        }
      }
      return { pruned: pruned.removed, events, grown, unwritten: remaining.length };
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

// The school's names renamed for this world, as the save holds them.
export function getRenames(deps = {}) {
  const state = deps.state
    || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.State);
  const r = state && state.variables && state.variables[RENAMES_KEY];
  return r && typeof r === 'object' ? r : null;
}

// For the guard, which asks on every text node: compiled once per map object
// and per size. SugarCube gives each move a new copy, so this compiles once a
// passage at most.
const renameMemo = new WeakMap();
function renamesTransform(deps) {
  return (text) => {
    // the original's coined names in Obscura's words until the world's land (world/renames.mjs)
    const r = withCoined(getRenames(deps));
    const key = `${Object.keys(r.exact || {}).length}/${Object.keys(r.words || {}).length}`;
    let hit = renameMemo.get(r);
    if (!hit || hit.key !== key) { hit = { key, rules: renameRules(r) }; renameMemo.set(r, hit); }
    return renameText(text, hit.rules);
  };
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
      // An area of the original's places is named for its map ("Campus"); its
      // name goes through this world's vocabulary, as the passages' text does.
      areaName: (area) => substituteLexicon(String((area && area.name) || ''), compileLexicon(getLexicon(deps))),
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

// What an empty need does, and no move into a passage that does not ship
// (world/needs.mjs). After the engine's own scripts have set their override.
export function installNeedsHook(deps = {}) {
  try { return installNeeds(deps); } catch { return false; }
}

// Menus, wares and the home's stores (world/shop.mjs), and the Inventory's
// snack.
export function installShopHook(deps = {}) {
  try { return installShop(deps); } catch { return false; }
}

// Work at the world's places (world/workscreen.mjs): the shift, its moments,
// the Work screen; a line of work's moments written for the world when the
// player first takes it.
export function installWorkHook(deps = {}) {
  try {
    const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
    const V = () => (SC && SC.State && SC.State.variables) || null;
    return installWork({
      ...deps,
      SugarCube: SC,
      onHired: ({ line, placeName }) => {
        const v = V();
        const plugin = deps.plugin || findPlugin('ai', deps.scope);
        const model = plugin ? sharedModel({ plugin }) : null;
        if (!model || !v) return;
        writeLineMoments({ model, store: deps.store || sharedStore(), worldId: v[WORLD_ID_KEY], line, placeName, faultsIn,
          who: bodyOf(SC && SC.setup, v),
          persona: () => buildPersona((V() || {}).obscuraPremise || '', getLexicon(deps)) })
          .catch((err) => console.warn('Obscura: the moments could not be written', err));
      },
    });
  } catch { return false; }
}

// Texting (world/texting.mjs): the engine's PhoneText, its unread count and
// people who text first; the world's texts written in the background the
// first time the player is given a number.
export function installTextingHook(deps = {}) {
  try {
    const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
    const V = () => (SC && SC.State && SC.State.variables) || null;
    return installTexting({
      ...deps,
      SugarCube: SC,
      onNumber: () => {
        const v = V();
        const plugin = deps.plugin || findPlugin('ai', deps.scope);
        const model = plugin ? sharedModel({ plugin }) : null;
        if (!model || !v) return;
        writeTheTextBank({ model, store: deps.store || sharedStore(), worldId: v[WORLD_ID_KEY], faultsIn,
          sender: bodyOf(SC && SC.setup, v),
          persona: () => buildPersona((V() || {}).obscuraPremise || '', getLexicon(deps)) })
          .catch((err) => console.warn('Obscura: the texts could not be written', err));
      },
    });
  } catch (err) {
    console.warn('Obscura: texting could not start', err);
    return false;
  }
}

// Who a date is with, for their words: the engine's words for them (as talk
// reads them), both bodies, how they stand, what they remember.
function whoForDate(setup, vars, name) {
  const SC = { setup, State: { variables: vars } };
  const tier = tierOf(standingWith(setup, name));
  const PersonClass = typeof window !== 'undefined' ? window.Person : null;
  const who = whoTheyAre(SC, name, tier, PersonClass);
  let p = {};
  try { p = setup.people.pronouns(name) || {}; } catch { p = {}; }
  let first = name;
  try { first = setup.people.firstname(name) || name; } catch { first = name; }
  return {
    name: first,
    description: `${who.description}${who.profile ? ` In their own words: ${who.profile}` : ''}`,
    body: personBody(setup, name),
    playerBody: bodyOf(setup, vars),
    footing: FOOTING[tier] || FOOTING.acquaintance,
    pronouns: `${p.ps || 'they'} and ${p.po || 'them'}`,
    memories: who.memories,
  };
}

// A person's date and night words (world/datebank.mjs), in the background;
// a no-op once they are written.
function writeWordsFor(setup, vars, deps, name) {
  if (!setup || !vars || !vars.people || !vars.people[name]) return;
  const plugin = deps.plugin || findPlugin('ai', deps.scope);
  const model = plugin ? sharedModel({ plugin }) : null;
  if (!model) return;
  writeDateWords({ model, store: deps.store || sharedStore(), worldId: vars[WORLD_ID_KEY], name, faultsIn,
    who: whoForDate(setup, vars, name), ctx: dateContext(setup, vars, { with: name }),
    persona: () => buildPersona(vars.obscuraPremise || '', getLexicon(deps)) })
    .catch((err) => console.warn('Obscura: a date\'s words could not be written', err));
}

// The world's own narration of every act of the engine's encounter
// (world/narrationbank.mjs), in the background; a no-op once written.
function writeNarrationFor(setup, vars, deps) {
  if (!setup || !vars || !setup.ob_sexacts) return;
  const plugin = deps.plugin || findPlugin('ai', deps.scope);
  const model = plugin ? sharedModel({ plugin }) : null;
  if (!model) return;
  writeTheNarration({ model, store: deps.store || sharedStore(), worldId: vars[WORLD_ID_KEY], acts: setup.ob_sexacts, faultsIn,
    persona: () => buildPersona(vars.obscuraPremise || '', getLexicon(deps)) })
    .catch((err) => console.warn('Obscura: the narration could not be written', err));
}

// Dates (world/dates.mjs), the date on screen (world/datescreen.mjs) and what
// it leads to (world/relations.mjs); a person's words written the moment a
// date or a night is set with them.
export function installDatesHook(deps = {}) {
  try {
    const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
    const setup = SC && SC.setup;
    const ok = installDates({ ...deps, SugarCube: SC }) && installDateScreen({ ...deps, SugarCube: SC })
      && installRelations({ ...deps, SugarCube: SC });
    if (!ok || !setup || setup.ob_date_set.__obscuraWords) return ok;
    const vars = () => SC.State.variables;
    const set = setup.ob_date_set;
    const withWords = (name, kind) => {
      const d = set(name, kind);
      if (d) { writeWordsFor(setup, vars(), deps, name); writeNarrationFor(setup, vars(), deps); }
      return d;
    };
    withWords.__obscuraWords = true;
    setup.ob_date_set = withWords;
    const begin = setup.ob_hookup_begin;
    setup.ob_hookup_begin = (name) => {
      const r = begin(name);
      if (r) { writeWordsFor(setup, vars(), deps, name); writeNarrationFor(setup, vars(), deps); }
      return r;
    };
    return ok;
  } catch (err) {
    console.warn('Obscura: dates could not start', err);
    return false;
  }
}

// The engine's encounter (world/narration.mjs): what its round did, told in
// Obscura's words by Obscura's EncounterActs and EncounterPositions, which
// then run the engine's own logic silently.
export function installEncounterHook(deps = {}) {
  try {
    const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
    return installNarration({ ...deps, SugarCube: SC, words: (name, dir) => narrationWords(name, dir) });
  } catch (err) {
    console.warn('Obscura: the encounter could not start', err);
    return false;
  }
}

// The hints (world/hints.mjs): Obscura's own, which its StoryHints prints
// where the engine's opened the original's campus storylines.
export function installHintsHook(deps = {}) {
  try {
    const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
    return installHints({ SugarCube: SC });
  } catch (err) {
    console.warn('Obscura: the hints could not start', err);
    return false;
  }
}

// Every inclination there is (world/inclinationslist.mjs): the list the
// Inclinations tab's last link opens, which the engine never shipped.
export function installInclinationsHook(deps = {}) {
  try {
    const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
    return installInclinationsList({ SugarCube: SC });
  } catch (err) {
    console.warn('Obscura: the inclinations list could not start', err);
    return false;
  }
}

// How a person's hair reads (world/describe.mjs): the engine's sentence, its
// hairstyle in Obscura's words where the original phrased it at length.
export function installDescriptionsHook(deps = {}) {
  try {
    const Person = deps.Person !== undefined ? deps.Person : (typeof window !== 'undefined' ? window.Person : null);
    return installDescriptions({ Person });
  } catch (err) {
    console.warn('Obscura: the descriptions could not start', err);
    return false;
  }
}

// The week's rent (world/rent.mjs): the engine's Monday evening, answered.
export function installRentHook(deps = {}) {
  try { return installRent(deps); } catch { return false; }
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
    const plugin = typeof deps.plugin === 'function' ? deps.plugin : findPlugin('textToImage', deps.scope);
    if (!plugin) return null;
    const textPlugin = typeof deps.textPlugin === 'function' ? deps.textPlugin : findPlugin('ai', deps.scope);
    const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
    const vars = () => ((deps.state || (SC && SC.State) || {}).variables || {});
    return installPainter({
      ...deps,
      plugin,
      store: deps.store || sharedStore(),
      model: deps.model || (textPlugin ? sharedModel({ plugin: textPlugin }) : null),
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
  installLexicon(config, () => getLexicon(deps), () => withCoined(getRenames(deps)));
  installedOn.add(config.passages);
  return true;
}

// People you can talk to (world/talk.mjs) and their faces
// (world/portraits.mjs), at boot: a restored save can open a conversation on
// its first screen.
export function installTalkHook(deps = {}) {
  try {
    const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
    const vars = () => ((deps.state || (SC && SC.State) || {}).variables || {});
    return installTalk({
      ...deps,
      model: () => { const p = deps.plugin || findPlugin('ai', deps.scope); return p ? sharedModel({ plugin: p }) : null; },
      store: () => deps.store || sharedStore(),
      persona: () => buildPersona(vars().obscuraPremise || '', getLexicon(deps)),
      faultsIn,
    });
  } catch (err) {
    console.warn('Obscura: talking could not start', err);
    return false;
  }
}

export function installPortraitsHook(deps = {}) {
  try {
    return installPortraits({
      ...deps,
      painter: () => (typeof window !== 'undefined' && window.ObscuraPainter ? window.ObscuraPainter.painter : null),
      enabled: () => paintEnabled(),
    });
  } catch (err) {
    console.warn('Obscura: faces could not start', err);
    return false;
  }
}
