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

  const out = {};
  for (const name of Object.keys(tables)) {
    out[name] = opening.has(name) ? TIER.OPENING : TIER.LAZY;
  }
  return out;
}

export function openingTables(tiers) {
  return Object.keys(tiers).filter((t) => tiers[t] === TIER.OPENING).sort();
}
