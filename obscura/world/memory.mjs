// world/memory.mjs — what one NPC personally witnessed.
//
// An NPC can only know what it saw. That is the simulation behaving correctly
// and it is also the answer to the 6,000-token prompt budget: a scene injects
// the participants' records, so cost scales with SCENE size rather than WORLD
// size. That is the difference between working at 50 NPCs and working at 646.
//
// Compaction lives here because IndexedDB raises the ceiling without removing
// it. An append-only log per NPC grows without bound across a long
// playthrough, and the failure is silent until a save will not load - by which
// point the cause is thousands of turns behind the symptom. The design names
// this as the thing that would otherwise be forgotten, so it ships with the
// record type rather than after it.

// How many recent events a compacted log keeps.
export const MEMORY_KEEP_RECENT = 40;
// At or above this weight an event is formative and survives compaction
// however old it is.
export const MEMORY_WEIGHT_KEEP = 5;

export function newMemory(name) {
  return { name, events: [], feeling: {} };
}

export function remember(memory, event) {
  return { ...memory, events: [...memory.events, event] };
}

// A directed feeling: Ada's feeling toward Bo says nothing about Bo's toward
// Ada. Modelling it symmetrically would make every relationship mutual by
// construction, which is not how any of this works.
export function feelTowards(memory, other, delta) {
  const current = memory.feeling[other] ?? 0;
  return { ...memory, feeling: { ...memory.feeling, [other]: current + delta } };
}

// Keeps the most recent window plus anything formative. Recency alone forgets
// the event that defined the relationship; weight alone forgets what just
// happened. Both failure modes are visible in play, so the policy keeps both
// and the recent window is the bound.
export function compact(memory, opts = {}) {
  const keep = opts.keepRecent ?? MEMORY_KEEP_RECENT;
  const heavy = opts.weightKeep ?? MEMORY_WEIGHT_KEEP;
  const events = memory.events;
  if (events.length <= keep) return memory;

  // Formative events get RESERVED slots inside the bound rather than competing
  // with recency for them. Merging the two lists and trimming the result drops
  // the formative ones first - they sort oldest - which is the exact failure
  // this policy exists to prevent.
  const reserve = Math.max(1, Math.floor(keep / 4));
  const older = events.slice(0, -keep);
  const formative = older
    .filter((e) => (e.weight ?? 0) >= heavy)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (b.day ?? 0) - (a.day ?? 0))
    .slice(0, reserve);
  const recent = events.slice(-(keep - formative.length));
  const merged = [...formative, ...recent].sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
  return { ...memory, events: merged, compactedAt: events.length };
}

// The prompt fragment for one NPC, hard-bounded. Built newest-first and
// truncated by construction: a budget checked after assembly is a budget that
// is exceeded.
export function contextFor(memory, opts = {}) {
  const budget = opts.budgetChars ?? 1200;
  const head = `${memory.name}:`;
  if (head.length >= budget) return head.slice(0, budget);

  const lines = [];
  let used = head.length;
  for (let i = memory.events.length - 1; i >= 0; i--) {
    const line = ` ${memory.events[i].text};`;
    if (used + line.length > budget) break;
    lines.unshift(line);
    used += line.length;
  }
  return head + lines.join('');
}
