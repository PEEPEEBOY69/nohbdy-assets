// world/builder.mjs — premise in, generated world out, progress along the way.
//
// This is the orchestration slice 2's contract was built for: specFor derives
// the spec, StubGenerator fills it, remapWorld reconciles the result against
// itself. The AI generator replaces exactly one of those three steps and
// nothing else - that was the point of putting an interface in front of the
// stubs before a model existed.
import { specFor, StubGenerator, remapWorld, selfIndexKeys, findWeightedReferences } from '../tools/generator.mjs';
import { pinAssets } from './assets.mjs';
import { pinMapRegions } from './mapgrid.mjs';
import { enforceSingletons } from './invariants.mjs';
import { findReferences } from '../tools/schema-refs.mjs';
import { classify, isFunctionValue } from '../tools/schema.mjs';
import { assignTiers, TIER } from './tiers.mjs';

// Both reference views, because they see different things and tiering needs
// both. findReferences reads record fields holding strings; it is structurally
// blind to names sitting positionally between weights, which is where 95 of
// this payload's cross-table references live. Tiering on field references
// alone left ob_startingTraits lazy while ob_archetypes pointed at it, and the
// build reported "names ob_startingTraits, which generated no keys".
export function referenceGraph(tables) {
  return [...findReferences(tables), ...findWeightedReferences(tables)];
}

export async function buildWorld(tables, opts = {}) {
  const refs = opts.refs || referenceGraph(tables);
  // Default: everything is opening tier. A caller that knows the measured read
  // set passes it; a caller that does not should get a complete world rather
  // than a silently partial one.
  const tiers = opts.tiers || assignTiers(tables, {
    readDuringWorldgen: opts.readDuringWorldgen || Object.keys(tables),
    refs,
  });
  const generator = opts.generator || new StubGenerator();
  const onProgress = opts.onProgress || (() => {});
  const keepKeys = opts.keepKeys || (() => []);
  const verbatimKeys = opts.verbatimKeys || (() => []);

  const wanted = Object.keys(tables).filter((t) => tiers[t] === TIER.OPENING);
  const world = {};
  const machineryKeys = {};
  const problems = [];
  // Text failures are tracked apart from structural ones on purpose. A field
  // that kept its placeholder is a cosmetic gap in a playable world; a
  // structural problem means the world must not reach the engine at all.
  const textProblems = [];
  let done = 0;

  for (const name of wanted) {
    const table = tables[name];
    if (!table || typeof table !== 'object') {
      done++;
      onProgress({ table: name, done, total: wanted.length });
      continue;
    }

    // A namespace that is mostly functions is the engine, not content.
    // Replacing it wholesale wipes the machinery the world runs on, so descend
    // and generate only its data members.
    if (classify(table) === 'machinery') {
      machineryKeys[name] = Object.keys(table);
      const selfIndexed = new Set(selfIndexKeys(table));
      const whole = new Set(verbatimKeys(name));
      const inner = {};
      for (const [k, v] of Object.entries(table)) {
        if (!v || typeof v !== 'object') continue;
        if (isFunctionValue(v)) continue;
        // A self-index names its sibling members; stubbing it replaces an index
        // of real names with invented strings that index nothing.
        if (selfIndexed.has(k)) {
          inner[k] = v.filter((x) => Object.prototype.hasOwnProperty.call(table, x));
          continue;
        }
        // A member the engine indexes with a COMPUTED key cannot be capped:
        // the engine has no way to know which keys survived. School.courses is
        // the worked case - 144 courses whose fallbacks resolve through
        // course_for_year, all broken the moment the set is thinned.
        if (whole.has(k)) { inner[k] = v; continue; }
        const spec = specFor(`${name}.${k}`, tables, {
          refs,
          premise: opts.premise,
          seed: opts.seed ? `${opts.seed}:${name}.${k}` : undefined,
          value: v,
          keepKeys: keepKeys(`${name}.${k}`),
        });
        // Awaited: the AI generator is async, and an un-awaited promise
      // would be stored as the table itself.
      const res = await generator.generate(spec);
        for (const p of res.problems) problems.push(`${name}.${k}: ${p}`);
        for (const p of (res.textProblems || [])) textProblems.push(`${name}.${k}: ${p}`);
        inner[k] = res.data;
      }
      if (Object.keys(inner).length) world[name] = inner;
    } else {
      const spec = specFor(name, tables, {
        refs,
        premise: opts.premise,
        seed: opts.seed ? `${opts.seed}:${name}` : undefined,
        keepKeys: keepKeys(name),
        verbatimKeys: verbatimKeys(name),
      });
      // Awaited: the AI generator is async, and an un-awaited promise
      // would be stored as the table itself.
      const res = await generator.generate(spec);
      for (const p of res.problems) problems.push(`${name}: ${p}`);
      for (const p of (res.textProblems || [])) textProblems.push(p);
      world[name] = res.data;
    }

    done++;
    onProgress({ table: name, done, total: wanted.length });
  }

  // Reconcile the world against itself before anything sees it. Each table was
  // generated alone, so a weighted list can still name a key another table's
  // cap removed - and the engine spins or throws on a dangling name rather
  // than degrading.
  const remap = remapWorld(world, tables, { keySpace: machineryKeys });
  problems.push(...remap.problems);

  // Asset references are neither content nor structure: they point into a
  // closed set of shipped files. A model writes plausible names for them
  // ("map_nightmarket", "teamlogo_ravens.png") and every one names a file that
  // cannot exist, so the map is blank and every crest is a broken image. No
  // conformance check catches it, because the value IS a valid string.
  //
  // Driven from the ORIGINAL tables, which are the only thing that knows a
  // field was ever a pointer.
  const assets = opts.assetManifest && opts.assetManifest.length
    ? pinAssets(world, tables, opts.assetManifest)
    : { pinned: [], unmatched: [] };
  for (const p of assets.unmatched) problems.push(`unpinned asset reference: ${p}`);

  // Map regions are the same problem one level down. Pinning the map IMAGE
  // made the map appear; the <area> polygons and marker positions are still
  // generated numbers, so they overlap, leave gaps, fall outside the picture,
  // and put one place's pin inside another's region. Laid out on a grid
  // instead, which is the only way to guarantee the three things the engine
  // needs and generation cannot provide.
  const regions = pinMapRegions(world, tables);

  // Singleton flags: a boolean true in exactly one record because it marks the
  // one that is special. 252 of them in the chassis data. The generator sees
  // an optional boolean and assigns it per record, so a generated world gets
  // three player residences or none - and with none, the engine never runs
  // `if (rinfo.pc)`, $pcroommate stays undefined, and the quickstart throws
  // before the player can reach the game.
  const singletons = enforceSingletons(world, tables);

  return {
    world, problems, textProblems, remapped: remap.remapped, tiers,
    pinnedAssets: assets.pinned.length,
    mapsLaidOut: regions.laidOut,
    singletonsEnforced: singletons.applied.length,
  };
}

// Writes a generated world into the live `setup` object.
//
// Assigning a generated table straight over setup[name] loses every method
// riding on it - 39 of 110 tables carry functions on the same object as their
// data, and the engine calls them. Assigning INTO the original instead keeps
// the methods but never removes the original content, so the world would be
// COT's data with ours layered on top.
//
// So: build a fresh object, carry the functions across, then swap. Machinery
// namespaces are handled member by member, because replacing one wholesale
// wipes the engine it is made of.
export function applyWorld(setup, world) {
  let tables = 0, members = 0, methods = 0;
  for (const [name, generated] of Object.entries(world)) {
    const original = setup[name];
    if (!original || typeof original !== 'object') continue;

    if (classify(original) === 'machinery') {
      for (const [k, v] of Object.entries(generated)) {
        if (typeof original[k] === 'function') continue;
        original[k] = v;
        members++;
      }
      continue;
    }

    if (Array.isArray(generated)) { setup[name] = generated; tables++; continue; }

    const next = Array.isArray(generated) ? [] : {};
    for (const [k, v] of Object.entries(generated)) next[k] = v;
    for (const [k, v] of Object.entries(original)) {
      if (typeof v === 'function' && !(k in next)) { next[k] = v; methods++; }
    }
    setup[name] = next;
    tables++;
  }
  return { tables, members, methods };
}
