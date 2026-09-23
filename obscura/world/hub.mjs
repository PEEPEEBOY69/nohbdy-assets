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

import { displayName } from './places.mjs';

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

// The file the chassis's own caption would show for a node - the same rules
// StoryCaption applies: the alternate picture when the player chose it, then
// "_snow" in a snowy world, else "_<season>" for a place that changes.
export function placePictureName(node, V = {}, setup = null) {
  if (!node || typeof node.img !== 'string' || !node.img) return null;
  let name = V.usealtlocimg && node.altimg ? node.altimg : node.img;
  if (node.snowvariation && V.snowyworld) return `${name}_snow`;
  if (node.seasonvariation) {
    let season = null;
    try { season = setup && setup.ob_weather && setup.ob_weather.season(); } catch { /* no weather yet */ }
    if (season) name += `_${season}`;
  }
  return name;
}

// The hub, as markup. Pure: everything it needs is passed in, so it can be
// tested without an engine. Returns SugarCube markup, not plain HTML, because
// the links have to be real passage links the engine will wire up.
export function hubHtml(setup, V, opts = {}) {
  const places = placesIn(setup);
  const here = places.get(V && V.location) || null;
  const lines = [];

  const name = here
    ? displayName(V, here.key, here.name || here.key)
    : (opts.unknownName || 'somewhere you do not recognise');

  // The place's picture, big enough to see on a phone, where the sidebar that
  // normally shows it is hidden. It starts as the shipped room; the painter
  // (world/painter.mjs) swaps in the one painted for this world, matching on
  // data-ob-place.
  if (here && opts.pictureBase) {
    const file = placePictureName(here, V, setup);
    if (file) {
      lines.push(`<div class="ob-hub-picture" style="margin:0 0 0.8em">`
        + `<img data-ob-place="${esc(here.key)}" src="${esc(`${opts.pictureBase}${file}.png`)}" alt=""`
        + ` style="width:256px;max-width:100%;height:auto;image-rendering:pixelated"></div>`);
      // Only offered where there is a painter to switch. A plain control, not
      // a passage link: the hub numbers its links as hotkeys, and the switch
      // took [1] from the first exit and looked like a place to go.
      if (opts.paint && opts.paint.available) {
        lines.push(`<div class="ob-hub-paint">Pictures painted for this world: ${opts.paint.on ? 'on' : 'off'} `
          + `<span class="ob-hub-paint-toggle" role="button" tabindex="0" `
          + `onclick="SugarCube.setup.ob_obscura_paint_toggle()">${opts.paint.on ? 'turn off' : 'turn on'}</span></div>`);
      }
    }
  }
  lines.push(`<div class="ob-hub-place"><b>${esc(name)}</b></div>`);

  if (opts.notice) lines.push(`<div class="ob-hub-notice" style="opacity:0.75;font-size:0.9em">${esc(opts.notice)}</div>`);

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
      const label = displayName(V, e, places.get(e).name || e);
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

// The Maps screen, for a generated world. The chassis's screen showed each
// map's picture under the ORIGINAL map's name ("Campus", "Town") and nothing
// else - in a world with no campus. This shows each map with the places in
// it, under the names they have in this world, and where the player is. The
// picture starts as the shipped map; the painter swaps in one painted for this
// world, matching on data-ob-map.
export function mapsHtml(setup, V = {}, opts = {}) {
  const maps = (setup && setup.ob_maps) || {};
  const blocks = Object.entries(maps)
    .filter(([, m]) => m && m.nodes && typeof m.nodes === 'object' && Object.keys(m.nodes).length);
  if (!blocks.length) return '<div class="ob-maps-empty">This world has no map yet.</div>';
  const here = V && V.location;
  const out = [];
  for (const [key, map] of blocks) {
    const title = typeof opts.mapName === 'function' ? opts.mapName(key, map) : (map.name || key);
    out.push('<div class="ob-map" style="margin:0 0 1.4em">');
    out.push(`<div class="ob-map-title" style="margin:0 0 0.4em"><b>${esc(title)}</b></div>`);
    const file = map.bigimg || map.img;
    if (opts.pictureBase && file) {
      out.push(`<img data-ob-map="${esc(key)}" src="${esc(`${opts.pictureBase}${file}.png`)}" alt=""`
        + ' style="width:100%;height:auto;image-rendering:pixelated">');
    }
    out.push('<div class="ob-map-places" style="columns:12em;column-gap:1.5em;margin-top:0.5em">');
    for (const [k, node] of Object.entries(map.nodes)) {
      if (!node || typeof node !== 'object') continue;
      const name = esc(displayName(V, k, node.name || k));
      out.push(k === here ? `<div><b>${name}</b> - you are here</div>` : `<div>${name}</div>`);
    }
    out.push('</div></div>');
  }
  return out.join('');
}

// Random events in the main loop. The original's location passages each asked
// the event picker for their own events; the hub asked for nothing, so nothing
// the living world wrote could ever happen. It now asks for the authored tag
// whenever game time has moved since it last asked - travel, waiting, the
// sidebar's Wait, a night's sleep all count, a redraw of the same moment does
// not - and rolls the chassis's own base chance first.
export function minuteOf(V) {
  const d = Number(V && V.gameday) || 0;
  const h = Number(V && V.hour) || 0;
  const m = Number(V && V.minute) || 0;
  return d * 1440 + h * 60 + m;
}

export function rollHubEvent(setup, V, rnd = Math.random, tags = ['obscura']) {
  if (!V || !setup || !setup.ob_events || typeof setup.ob_events.pick !== 'function') return null;
  const now = minuteOf(V);
  if (V.obscuraLastRoll === undefined) { V.obscuraLastRoll = now; return null; }
  if (now <= V.obscuraLastRoll) return null;
  V.obscuraLastRoll = now;
  let chance = 1 / 6;
  try { if (typeof setup.ob_events.base_event_chance === 'function') chance = setup.ob_events.base_event_chance(); } catch { /* the default */ }
  if (!(rnd() < chance)) return null;
  let pick = null;
  try { pick = setup.ob_events.pick(tags); } catch { return null; }
  if (!pick || !pick.passage) return null;
  try { if (typeof setup.ob_events.register_event === 'function') setup.ob_events.register_event(pick.passage); } catch { /* recency only */ }
  return pick.passage;
}

// The engine-facing half. Installed onto `setup` so a passage can call it by
// name, which is the only thing passage markup can do.
export function installHub(deps = {}) {
  const setup = deps.setup
    || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.setup);
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  if (!setup || !SC) return false;

  const V = () => (deps.state || SC.State).variables;

  // Pictures come from the same place the build pointed every res/img/ path.
  const pictureBase = () => deps.pictureBase
    || (typeof window !== 'undefined' && window.OBSCURA_ASSET_BASE ? `${window.OBSCURA_ASSET_BASE}img/` : '');
  setup.ob_obscura_hub = () => hubHtml(setup, V(), {
    pictureBase: pictureBase(),
    notice: typeof deps.notice === 'function' ? deps.notice() : null,
    paint: typeof deps.paint === 'function' ? deps.paint() : null,
  });
  setup.ob_obscura_paint_toggle = () => {
    if (typeof deps.togglePaint === 'function') deps.togglePaint();
    try { SC.Engine.show(); } catch { /* nothing on screen */ }
  };
  setup.ob_obscura_maps = () => mapsHtml(setup, V(), { pictureBase: pictureBase(), mapName: deps.mapName });
  setup.ob_obscura_event = () => rollHubEvent(setup, V(),
    () => (SC.State && typeof SC.State.random === 'function' ? SC.State.random() : Math.random()));

  // $locationblock is the MAP a location belongs to. The chassis reads it 27
  // times - for the location picture, who is here, fast travel - and normally
  // derives it from a passage's `locblock<Name>` tag, which the hub cannot
  // have because its places are generated. Unset, the location-picture branch
  // in StoryCaption never ran, so every place in the game had an empty frame.
  const setBlock = (key) => {
    const place = placesIn(setup).get(key);
    if (place) V().locationblock = place.map;
  };

  // `minutes` overrides the usual step: the sidebar's class shortcut has
  // already advanced the clock by the real path length before it calls this.
  setup.ob_obscura_go = (to, minutes) => {
    const places = placesIn(setup);
    if (!places.has(to)) return false;
    V().location = to;
    setBlock(to);
    const step = Number.isFinite(minutes) ? minutes : (deps.travelMinutes ?? 15);
    try {
      if (step > 0 && setup.ob_time && typeof setup.ob_time.advance_time === 'function') {
        setup.ob_time.advance_time(step);
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
    if (v.location) setBlock(v.location);
    return v.location || null;
  };

  return true;
}
