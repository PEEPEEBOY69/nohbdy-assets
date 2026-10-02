// world/hub.mjs — the main loop, built from the generated world.
//
// The chassis extraction keeps STRUCTURAL passages and deliberately drops
// the original's authored scenes. That is the whole point of the project - their
// content is not ours to ship - but it left a consequence nobody had written
// down: the machinery that survived still points at those scenes. The audit
// puts numbers on it: 59 literal link targets that do not exist, 1,630 events
// whose passage is missing, and both YourDorm and PrologueFinal absent, so the
// prologue and the quickstart each end on a dead link.
//
// The game therefore had a worldgen pipeline and a shell, and nowhere to go.
//
// This is the somewhere. It is not a port of the original's location screens; it is a
// small loop driven entirely by the world that was just generated - where you
// are, what time it is, who is here, where you can go. A generated world
// already contains all of that.
//
// WHY NOT ONE PASSAGE PER LOCATION. The chassis identifies a location from a
// `loc<Name>` tag on the passage, which is static. Locations are generated, so
// there cannot be a passage per location - a single hub sets V.location itself
// and reads everything else from the world.

import { arrivalLine, currentWriter, currentStage } from './writer.mjs';
import { recallHere } from './recall.mjs';
import { substituteWith } from './lexicon.mjs';
import {
  placesIn, startingPlace, geoOf, resolvePlace, shortestPath, travelMinutes, STEP_MINUTES,
} from './geography.mjs';
import { mapsScreenHtml } from './mapdraw.mjs';
import { ACTIONS, actionsFor, doAction, priceText, SCREEN_KEY, SCREEN_PASSAGE } from './actions.mjs';
import { workLinks } from './workscreen.mjs';
import { dateLinks } from './datescreen.mjs';

// Read by the modules that always imported them from here.
export { placesIn, startingPlace };

export const MAX_PEOPLE_SHOWN = 8;

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
  // where the player is, and where they can walk: the geography in play
  // (world/geography.mjs)
  const geo = opts.geo || geoOf(V, setup);
  const here = (geo && V && geo.places[V.location]) || null;
  // the original's node under the place: its picture until this world's is painted
  const node = placesIn(setup).get(V && V.location) || null;
  const lines = [];

  // the original's map stands in until the world's places land: its names in
  // the world's words ("Your Dorm" in a guild port, v43)
  const nameOf = (n) => (geo && geo.source !== 'model' && typeof opts.placeName === 'function' ? opts.placeName(n) : n);
  const name = here ? nameOf(here.name) : (opts.unknownName || 'somewhere you do not recognise');

  // The place's picture, big enough to see on a phone, where the sidebar that
  // normally shows it is hidden. It starts as the shipped room; the painter
  // (world/painter.mjs) swaps in the one painted for this world, matching on
  // data-ob-place.
  if (node && opts.pictureBase) {
    const file = placePictureName(node, V, setup);
    if (file) {
      lines.push(`<div class="ob-hub-picture" style="margin:0 0 0.8em">`
        + `<img data-ob-place="${esc(V.location)}" src="${esc(`${opts.pictureBase}${file}.png`)}" alt=""`
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

  // The world is still being written in the background (world/writer.mjs):
  // what is being written before the writer runs, its share after.
  const writing = arrivalLine(opts.stage !== undefined ? opts.stage : currentStage(),
    opts.writing !== undefined ? opts.writing : (currentWriter() ? currentWriter().progress() : null));
  if (writing) lines.push(`<div class="ob-writing" id="ob-writing">${esc(writing)}</div>`);

  if (opts.notice) lines.push(`<div class="ob-hub-notice" style="opacity:0.75;font-size:0.9em">${esc(opts.notice)}</div>`);

  const clock = clockOf(setup, V);
  if (clock) lines.push(`<div class="ob-hub-clock">${esc(clock)}</div>`);
  // what the player just did here (world/actions.mjs), until the next move
  if (V && V.obscuraDid) lines.push(`<div class="ob-hub-did">${esc(V.obscuraDid)}</div>`);

  const area = here && geo.areas.find((a) => a.id === here.area);
  if (area && area.name) lines.push(`<div class="ob-hub-area">${esc(opts.areaName ? opts.areaName(area) : area.name)}</div>`);
  // a fallback place keeps its street's own note ("Your Dorm"), in this
  // world's words: the hub is built here, so the passage hook never sees it
  if (geo && geo.source === 'fallback' && node && node.features) {
    lines.push(`<div class="ob-hub-feature">${esc(substituteWith(node.features, V && V.obscuraLexicon))}</div>`);
  }

  // Who is here: the engine's own $peopleatlocation, which its PassageReady
  // sets on every location passage - so every name shown is one its "Talk to"
  // accepts - else asked for directly. With talking installed each name opens
  // a conversation (world/talk.mjs), by its place in the engine's list; the
  // engine's keyboard links skip a nokeys element, so the exits keep [1], [2].
  const list = Array.isArray(V && V.peopleatlocation) ? V.peopleatlocation : null;
  const talkable = !!list && !!opts.talk;
  const people = (list || peopleAt(setup, V && V.location))
    .map((p, i) => ({ name: personName(p), i })).filter((x) => x.name).slice(0, MAX_PEOPLE_SHOWN);
  if (people.length) {
    const shown = people.map((x) => (talkable
      ? `<<link "${esc(x.name)}">><<run setup.ob_talk_open(${x.i})>><</link>>` : esc(x.name))).join(', ');
    lines.push(`<div class="ob-hub-people${talkable ? ' nokeys' : ''}">Here: ${shown}</div>`);
    // someone here who remembers something of you (world/recall.mjs)
    for (const line of recallHere(V, people.map((x) => x.name), (n) => String(n).split(' ')[0])) {
      lines.push(`<div class="ob-hub-recall">${esc(line)}</div>`);
    }
  }

  const exits = here ? here.exits.filter((e) => geo.places[e] && e !== V.location) : [];
  if (exits.length) {
    lines.push('<div class="ob-hub-exits">');
    // The target is always the hub; the destination travels in a variable,
    // because a place has no passage of its own.
    for (const e of exits) lines.push(`<<link "${esc(nameOf(geo.places[e].name))}">><<run setup.ob_obscura_go("${esc(e)}")>><</link>>`);
    lines.push('</div>');
  } else {
    lines.push('<div class="ob-hub-exits ob-hub-noexit">Nowhere to go from here yet.</div>');
  }

  // what this place is for (world/actions.mjs), a price where one is due;
  // work, where it hires (world/workscreen.mjs); a date due here, and
  // tonight's plans (world/datescreen.mjs)
  const doing = here ? actionsFor(here, V, setup) : [];
  const work = [...(here ? workLinks(V, { key: V.location, ...here }) : []), ...(here ? dateLinks(setup, V, { key: V.location, ...here }) : [])];
  if (doing.length || work.length) {
    lines.push('<div class="ob-hub-do">');
    for (const id of doing) {
      const a = ACTIONS[id];
      const label = a.price ? `${a.label} (${priceText(a.price)})` : a.label;
      lines.push(`<<link "${esc(label)}">><<run setup.ob_obscura_act("${id}")>><</link>>`);
    }
    for (const w of work) {
      lines.push(w.label ? `<<link "${esc(w.label)}">><<run ${w.run}>><</link>>` : `<span class="ob-hub-note">${esc(w.text)}</span>`);
    }
    lines.push('</div>');
  }

  lines.push('<div class="ob-hub-actions">');
  // a class of the player's that is on now, in a world that keeps its
  // timetable (world/timetable.mjs)
  let cls = null;
  try { cls = setup && typeof setup.ob_attendable === 'function' ? setup.ob_attendable() : null; } catch { cls = null; }
  if (cls && cls.course) lines.push(`<<link "Attend ${esc(cls.course)}">><<run setup.ob_attend()>><</link>>`);
  lines.push('<<link "Wait a while">><<run setup.ob_obscura_wait()>><</link>>');
  lines.push('</div>');

  // no newlines: printed with <<=, each one would be a line break on screen;
  // the stylesheet lays the hub out
  return lines.join('');
}

// The Maps screen (world/mapdraw.mjs), drawn from the geography in play. A
// fallback area is one of the original's maps and shows its shipped picture
// until the painter paints this world's; a world's own area has no shipped
// picture to stand in, and shows the painted one when there is one.
export function mapsHtml(setup, V = {}, opts = {}) {
  const maps = (setup && setup.ob_maps) || {};
  const picture = opts.picture || ((id) => { const m = maps[id]; return (m && (m.bigimg || m.img)) || null; });
  return mapsScreenHtml(opts.geo || geoOf(V, setup), V, { ...opts, picture });
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
  const geoNow = () => geoOf(V(), setup);

  // Pictures come from the same place the build pointed every res/img/ path.
  const pictureBase = () => deps.pictureBase
    || (typeof window !== 'undefined' && window.OBSCURA_ASSET_BASE ? `${window.OBSCURA_ASSET_BASE}img/` : '');
  setup.ob_obscura_hub = () => hubHtml(setup, V(), {
    pictureBase: pictureBase(),
    notice: typeof deps.notice === 'function' ? deps.notice() : null,
    paint: typeof deps.paint === 'function' ? deps.paint() : null,
    // the names are people to talk to once world/talk.mjs is installed
    talk: typeof setup.ob_talk_open === 'function',
    areaName: deps.areaName,
    placeName: deps.placeName,
  });
  setup.ob_obscura_paint_toggle = () => {
    if (typeof deps.togglePaint === 'function') deps.togglePaint();
    try { SC.Engine.show(); } catch { /* nothing on screen */ }
  };
  setup.ob_obscura_maps = () => mapsHtml(setup, V(), { pictureBase: pictureBase(), areaName: deps.areaName });
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

  // `to` is a place of the geography; a key that is no place is read as the
  // engine means it (a building's block is its first room). `minutes`
  // overrides the step: the sidebar's class shortcut has already moved the
  // clock before it calls this.
  setup.ob_obscura_go = (to, minutes) => {
    const geo = geoNow();
    const key = typeof to === 'string' && geo.places[to] ? to : resolvePlace(geo, setup, to);
    if (!key) return false;
    V().location = key;
    delete V().obscuraDid;
    // The engine's navigation override judges the needs only when a move goes
    // to another passage, or while $waiting is set; every move here is the hub
    // to the hub.
    V().waiting = true;
    setBlock(key);
    const step = Number.isFinite(minutes) ? minutes : (deps.travelMinutes ?? STEP_MINUTES);
    try {
      if (step > 0 && setup.ob_time && typeof setup.ob_time.advance_time === 'function') {
        setup.ob_time.advance_time(step);
      }
    } catch { /* time is decoration here, not a precondition for moving */ }
    SC.Engine.play('ObscuraHub');
    return true;
  };

  // The sidebar's class "Go there" (build.mjs rewrites it to this): the engine
  // names the class building's door on the original map, and in a world's own
  // layout another street may stand on that key, so the door is read as the
  // engine means it - the class's place.
  setup.ob_obscura_class_go = (door, minutes) => {
    const key = resolvePlace(geoNow(), setup, door);
    return key ? setup.ob_obscura_go(key, minutes) : false;
  };

  // The Maps screen's click: the shortest way there, at five minutes a step.
  setup.ob_obscura_travel = (to) => {
    const geo = geoNow();
    const key = typeof to === 'string' && geo.places[to] ? to : resolvePlace(geo, setup, to);
    if (!key) return false;
    const path = shortestPath(geo, V().location, key);
    try { if (SC.Dialog && typeof SC.Dialog.close === 'function') SC.Dialog.close(); } catch { /* no dialog open */ }
    return setup.ob_obscura_go(key, path ? travelMinutes(path) : STEP_MINUTES);
  };

  // What this place is for (world/actions.mjs): done through the engine, a
  // line for the hub; a menu, wares or the home's stores open their screen.
  setup.ob_obscura_act = (id) => {
    const v = V();
    const place = geoNow().places[v.location];
    if (!place || !actionsFor(place, v, setup).includes(id)) return false;
    const done = doAction(setup, v, id, { key: v.location, ...place });
    if (done.screen) {
      v[SCREEN_KEY] = { place: v.location, screen: done.screen };
      SC.Engine.play(SCREEN_PASSAGE);
      return true;
    }
    v.obscuraDid = done.line;
    v.waiting = true;
    SC.Engine.play('ObscuraHub');
    return true;
  };

  setup.ob_obscura_wait = () => {
    delete V().obscuraDid;
    V().waiting = true;
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
    const geo = geoNow();
    if (!v.location || !geo.places[v.location]) {
      if (geo.start) v.location = geo.start;
    }
    if (v.location) setBlock(v.location);
    return v.location || null;
  };

  return true;
}
