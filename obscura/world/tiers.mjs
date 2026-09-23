// world/tiers.mjs — what the opening needs, and what can wait.
//
// Generation is tiered by cost: a skeleton up front, everything else on first
// encounter. The skeleton is NOT simply the instrumented read set.
// chassis/reads.json records its own blind spot - "boot-time reads happen
// before instrumentation and are NOT measured" - so the read set is a floor,
// not the answer.
//
// A table the opening REFERENCES is part of the opening whether or not the
// instrumented walk happened to touch it. Slice 2 measured what a dangling
// reference costs: the engine reads undefined and either throws or spins, it
// does not degrade. So the opening tier is the read set closed over references.
export const TIER = { OPENING: 1, LAZY: 2 };

// The tables an instrumented playthrough actually read during world
// generation, measured in slice 1 (chassis/reads.json) and inlined here
// because this list has to ship to the browser with the builder.
//
// It is a FLOOR, not the answer. reads.json records its own limit: boot-time
// reads happen before instrumentation and are not measured. assignTiers closes
// it over the reference graph, which on this payload turns 23 seeds into 35
// opening-tier tables.
export const OPENING_SEEDS = [
  "School",
  "inclinations",
  "ob_archetypes",
  "ob_business",
  "ob_dialogue",
  "ob_events",
  "ob_hair_colors",
  "ob_hair_colors_simple",
  "ob_hairstyles",
  "ob_houses",
  "ob_housing",
  "ob_nPCSimulation",
  "ob_names",
  "ob_pregnancy",
  "ob_relationships",
  "ob_riverRat",
  "ob_skills",
  "ob_subarchetypes",
  "ob_time",
  "ob_weather",
  "ob_worldgen",
  "people",
  "species",
];

// Tables carried WHOLE even when the opening reaches them. Their records are
// structure, not prose: an outfit is a list of clothing pointers with
// conditions on who wears which piece. Generating one produced a Starting
// Outfit of a single item for a single gender - every other player began the
// game naked. The same rule as the map and every other pointer: a closed set
// or the original, never generation.
//
// Parallel arrays too: the engine finds a value's position in one array and
// reads the same position in its partner (ob_hair_colors[i] is described as
// ob_hair_colors_simple[i]). Generated separately, the two stop lining up and
// an NPC is described as "undefined-haired". tests/tiers.test.mjs re-scans the
// engine for every such pair, so a new one cannot slip through.
//
// And the colour table: a colour's name maps to the hex code the clothing
// validator and the swatches read. Inferred as an enum, the stub dealt the
// codes out at random, so "navy blue" could render as any colour at all.
export const CARRIED_WHOLE = [
  'ob_outfits',
  'ob_hair_colors', 'ob_hair_colors_simple',
  'ob_dye_hair_colors', 'ob_dye_hair_colors_simple',
  'ob_hairlengths', 'ob_hairlengths_updo',
  'ob_color_table',
];

export function assignTiers(tables, opts = {}) {
  const seeds = opts.readDuringWorldgen || [];
  const refs = opts.refs || [];
  const opening = new Set(seeds.filter((t) => Object.prototype.hasOwnProperty.call(tables, t)));

  // Transitive closure. The `grew` flag rather than recursion because the
  // reference graph has cycles - ob_archetypes and ob_subarchetypes point at
  // each other - and a visited set makes termination obvious.
  let grew = true;
  while (grew) {
    grew = false;
    for (const ref of refs) {
      if (!opening.has(ref.table)) continue;
      if (!Object.prototype.hasOwnProperty.call(tables, ref.target)) continue;
      if (opening.has(ref.target)) continue;
      opening.add(ref.target);
      grew = true;
    }
  }

  const carried = new Set(opts.carry || CARRIED_WHOLE);
  const out = {};
  for (const name of Object.keys(tables)) {
    out[name] = opening.has(name) && !carried.has(name) ? TIER.OPENING : TIER.LAZY;
  }
  return out;
}

export function openingTables(tiers) {
  return Object.keys(tiers).filter((t) => tiers[t] === TIER.OPENING).sort();
}
