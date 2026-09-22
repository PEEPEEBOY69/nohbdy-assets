// world/hub.mjs — the main loop, built from the generated world.
//
// The chassis extraction keeps STRUCTURAL passages and deliberately drops
// COT's authored scenes. That is the whole point of the project - their
// content is not ours to ship - but it left a consequence nobody had written
// down: the machinery that survived still points at those scenes. The audit
// puts numbers on it: 59 literal link targets that do not exist, 1,630 events
// whose passage is missing, and both YourDorm and PrologueFinal absent, so the
// prologue and the quickstart each end on a dead link.
//
// The game therefore had a worldgen pipeline and a shell, and nowhere to go.
//
// This is the somewhere. It is not a port of COT's location screens; it is a
// small loop driven entirely by the world that was just generated - where you
// are, what time it is, who is here, where you can go. A generated world
// already contains all of that.
//
// WHY NOT ONE PASSAGE PER LOCATION. The chassis identifies a location from a
// `loc<Name>` tag on the passage, which is static. Locations are generated, so
// there cannot be a passage per location - a single hub sets V.location itself
// and reads everything else from the world.

export const MAX_PEOPLE_SHOWN = 8;

// The world's places, as a flat map of node name -> node, across every map
// that has nodes. Generated worlds name their own maps and nodes, so nothing
// here may assume a fixed name.
export function placesIn(setup) {
  const out = new Map();
  const maps = setup && setup.ob_maps;
  if (!maps || typeof maps !== 'object') return out;
  for (const [mapName, map] of Object.entries(maps)) {
    const nodes = map && map.nodes;
    if (!nodes || typeof nodes !== 'object') continue;
    for (const [key, node] of Object.entries(nodes)) {
      if (!node || typeof node !== 'object') continue;
      if (!out.has(key)) out.set(key, { ...node, key, map: mapName });
    }
  }
  return out;
}

// Where a new game starts. Deterministic: the first node of the map with the
// most nodes, so the player begins somewhere central rather than in whichever
// one-room location happened to sort first.
export function startingPlace(setup) {
  const maps = (setup && setup.ob_maps) || {};
  let best = null;
  for (const [mapName, map] of Object.entries(maps)) {
    const nodes = (map && map.nodes) || {};
    const keys = Object.keys(nodes).filter(k => nodes[k] && typeof nodes[k] === 'object');
    if (!keys.length) continue;
    if (!best || keys.length > best.count) best = { key: keys[0], map: mapName, count: keys.length };
  }
  return best ? best.key : null;
}

// Only exits that actually lead somewhere. A generated world's `exits` are
// names, and a name that no node answers to is a link into nothing - the exact
// class of defect this module exists because of.
export function exitsOf(place, places) {
  const raw = place && Array.isArray(place.exits) ? place.exits : [];
  return raw.filter(e => typeof e === 'string' && places.has(e) && e !== place.key);
}

export function peopleAt(setup, location) {
  try {
    if (setup && typeof setup.ob_people_at_location === 'function') {
      const list = setup.ob_people_at_location(location);
      if (Array.isArray(list)) return list;
    }
  } catch { /* the chassis needs more state than a fresh world has; fall through */ }
  return [];
}

export function personName(p) {
  if (typeof p === 'string') return p;
  if (p && typeof p === 'object') return p.person || p.name || null;
  return null;
}

export function clockOf(setup, V) {
  const h = V && typeof V.hour === 'number' ? V.hour : null;
  const m = V && typeof V.minute === 'number' ? V.minute : 0;
  if (h === null) return '';
  try {
    if (setup && setup.ob_time && typeof setup.ob_time.clock === 'function') {
      const s = setup.ob_time.clock();
      if (s) return String(s);
    }
  } catch { /* fall back to the plain reading below */ }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The hub, as markup. Pure: everything it needs is passed in, so it can be
// tested without an engine. Returns SugarCube markup, not plain HTML, because
// the links have to be real passage links the engine will wire up.
export function hubHtml(setup, V, opts = {}) {
  const places = placesIn(setup);
  const here = places.get(V && V.location) || null;
  const lines = [];

  const name = here
    ? (here.name || here.key)
    : (opts.unknownName || 'somewhere you do not recognise');
  lines.push(`<div class="ob-hub-place"><b>${esc(name)}</b></div>`);

  const clock = clockOf(setup, V);
  if (clock) lines.push(`<div class="ob-hub-clock">${esc(clock)}</div>`);

  if (here && here.features) lines.push(`<div class="ob-hub-feature">${esc(here.features)}</div>`);

  const names = peopleAt(setup, V && V.location)
    .map(personName).filter(Boolean).slice(0, MAX_PEOPLE_SHOWN);
  if (names.length) {
    lines.push(`<div class="ob-hub-people">Here: ${names.map(esc).join(', ')}</div>`);
  }

  const exits = here ? exitsOf(here, places) : [];
  if (exits.length) {
    lines.push('<div class="ob-hub-exits">');
    for (const e of exits) {
      const label = (places.get(e).name || e);
      // The target is always the hub; the destination travels in a variable,
      // because a generated place has no passage of its own.
      lines.push(`<<link "${esc(label)}">><<run setup.ob_obscura_go("${esc(e)}")>><</link>>`);
    }
    lines.push('</div>');
  } else {
    lines.push('<div class="ob-hub-exits ob-hub-noexit">Nowhere to go from here yet.</div>');
  }

  lines.push('<div class="ob-hub-actions">');
  lines.push('<<link "Wait a while">><<run setup.ob_obscura_wait()>><</link>>');
  lines.push('</div>');

  return lines.join('\n');
}

// The engine-facing half. Installed onto `setup` so a passage can call it by
// name, which is the only thing passage markup can do.
export function installHub(deps = {}) {
  const setup = deps.setup
    || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.setup);
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  if (!setup || !SC) return false;

  const V = () => (deps.state || SC.State).variables;

  setup.ob_obscura_hub = () => hubHtml(setup, V());

  setup.ob_obscura_go = (to) => {
    const places = placesIn(setup);
    if (!places.has(to)) return false;
    V().location = to;
    try {
      if (setup.ob_time && typeof setup.ob_time.advance_time === 'function') {
        setup.ob_time.advance_time(deps.travelMinutes ?? 15);
      }
    } catch { /* time is decoration here, not a precondition for moving */ }
    SC.Engine.play('ObscuraHub');
    return true;
  };

  setup.ob_obscura_wait = () => {
    try {
      if (setup.ob_time && typeof setup.ob_time.advance_time === 'function') {
        setup.ob_time.advance_time(deps.waitMinutes ?? 60);
      }
    } catch { /* as above */ }
    SC.Engine.play('ObscuraHub');
    return true;
  };

  setup.ob_obscura_start = () => {
    const v = V();
    if (!v.location || !placesIn(setup).has(v.location)) {
      const start = startingPlace(setup);
      if (start) v.location = start;
    }
    return v.location || null;
  };

  return true;
}
