// world/geography.mjs — a world's places: where they are, and how they join.
//
// The engine's map (setup.ob_maps) is the original's: a campus, a town and a
// plaza that share no path, and 109 places, most of them joined only by
// authored passages that never shipped - 14 of the 109 could be walked to. A
// world's geography is its own: areas, places, the kind of each, and the paths
// between them, built so that every place can be reached. Each place stands on
// an original key of its kind, its backer: $location is that key, so the
// engine's people, events and schedules find it as they always did, and the
// geography decides what the player sees and where they can walk.
import { STATE_KEY as PLACES_KEY } from './places.mjs';

export const GEO_KEY = 'obscuraGeo';
// 'pending' from the hand-over until the world's own layout lands; asked for
// again on the next page load while it is.
export const LAYOUT_KEY = 'obscuraLayout';
// One walk from a place to the next.
export const STEP_MINUTES = 5;
// The original's event-only block: a raid's rooms, not a place anyone goes.
const EXCLUDED_BLOCKS = new Set(['GreekUnderwearRaid']);

// Kinds, and the original keys that can stand under each - those the engine
// fills with people first. Its simulation knows places by their original
// block: the campus buildings, the town, the residence hall room by room, the
// Greek houses, the motel, the bus.
export const KINDS = {
  home: ['YourDorm'],
  lodging: ['MainHall', 'ResidentsLounge', 'HelleborineHall', 'RiversideMotel', 'RiversideMotelRoom', 'BFFDorm',
    'HouseAXAMainRoom', 'HouseDDRMainRoom', 'HouseSOTMainRoom', 'HouseZKXMainRoom'],
  privy: ['ResidenceRestroom', 'RiversidePlazaRestroom', 'RiversidePlazaRestroomWomens', 'RiversidePlazaRestroomMens',
    'HouseAXABathroom', 'HouseDDRBathroom', 'HouseSOTBathroom'],
  bath: ['ResidenceShowers', 'BlodgettGymUnisexLocker', 'BlodgettGymWomensLocker', 'BlodgettGymMensLocker',
    'ChamberlainHallChangingRoom', 'ResidenceLaundry'],
  food: ['RiverRat', 'ChamberlainHallInterior', 'QuickieBurger', 'BangCoffee', 'HouseAXAKitchen', 'HouseDDRKitchen',
    'HouseSOTKitchen', 'HouseZKXKitchen'],
  shop: ['SummitMarketInterior', 'RiversideCommunityThrift', 'MrGables', 'SportsDrip', 'JTUlt', 'HowlingJigoku',
    'DrCuttlefish', 'Bootlicker', 'NobblyBarns', 'BoldCuts', 'FamilyJewels', 'TattooShop', 'CostumeShop', 'StickySteve'],
  learning: ['ThoreauBuilding', 'HallowellBuilding', 'EmersonBuilding', 'SmithLibrary', 'LibraryMezzanine',
    'LibraryBasement', 'ComputerLab', 'MediaProductionLab', 'PhotoStudio', 'Greenhouse', 'Observatory'],
  training: ['BlodgettGymInterior', 'GymPool'],
  healer: ['CampusClinic', 'RecoveryRoom'],
  entertainment: ['Arcade', 'Cinema', 'Licketysplits'],
  gathering: ['CommunityCenter', 'MunicipalCenter', 'MailCenter', 'QuadTabletop'],
  outdoors: ['HannaRdN', 'HannaRdS', 'ThoreauRd', 'UniMall', 'EmersonRd', 'HallowellRd', 'Library', 'ChamberlainHall',
    'SummitMarket', 'BlodgettGym', 'StudentParking', 'LongfellowRd', 'PrescottRd', 'BancroftLn',
    'HelleborineTrilliumQuad', 'RiversidePlaza', 'NutmegSt', 'YohimbeSt', 'FadogiaSt', 'GinsengSt', 'SaffronSt',
    'DatePalmSt', 'PembletonWay', 'RiverPeninsula', 'Bus'],
};
// The most of each kind a world can have: one home, and as many of the rest as
// there are keys to stand on.
export const KIND_MAX = Object.fromEntries(Object.keys(KINDS).map((k) => [k, k === 'home' ? 1 : KINDS[k].length]));
// Where classes meet (setup.School.majors[*].location): the first backers of
// their kinds, so a world's first learning and training places are its venues.
export const CLASS_VENUES = ['ThoreauBuilding', 'HallowellBuilding', 'EmersonBuilding', 'BlodgettGymInterior'];

const KIND_OF = {};
for (const [kind, keys] of Object.entries(KINDS)) for (const k of keys) KIND_OF[k] = kind;
export const kindOf = (key, outdoor = false) => KIND_OF[key] || (outdoor ? 'outdoors' : 'lodging');

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

// Doors the original's data leaves out: a building's block, to the outdoor
// place it opens onto. Read from the streets' own notes ("Longfellow Road:
// Clinic", "Yohimbe Street: The River Rat").
export const DOORS = {
  ResidenceHall: 'HannaRdN', SummitMarket: 'SummitMarket', CampusClinic: 'LongfellowRd',
  GreekHouseAXA: 'PrescottRd', GreekHouseDDR: 'PrescottRd', GreekHouseSOT: 'PrescottRd', GreekHouseZKX: 'PrescottRd',
  CommunityCenter: 'CommunityCenter', FamilyJewels: 'GinsengSt', QuickieBurger: 'NutmegSt', RiverRat: 'YohimbeSt',
  Arcade: 'RiversidePlaza', Licketysplits: 'FadogiaSt', Cinema: 'RiversidePlaza',
};
// Paths the original walked in its passages: the quad and the town's lone
// buildings to their streets, the bus from the student parking into town, the
// plaza's walk and the shops along it.
export const LINKS = [
  ['HelleborineTrilliumQuad', 'HannaRdS'], ['HelleborineHall', 'HelleborineTrilliumQuad'],
  ['QuadTabletop', 'HelleborineTrilliumQuad'],
  ['StickySteve', 'FadogiaSt'], ['TattooShop', 'NutmegSt'], ['CostumeShop', 'GinsengSt'],
  ['MunicipalCenter', 'CommunityCenter'], ['RiversideMotel', 'SaffronSt'], ['RiversideMotelRoom', 'RiversideMotel'],
  ['StudentParking', 'Bus'], ['Bus', 'RiversidePlaza'],
  ['RiversidePlaza', 'PembletonWay'], ['PembletonWay', 'RiverPeninsula'],
  ['MrGables', 'PembletonWay'], ['HowlingJigoku', 'PembletonWay'], ['SportsDrip', 'PembletonWay'],
  ['BoldCuts', 'PembletonWay'], ['JTUlt', 'PembletonWay'], ['DrCuttlefish', 'PembletonWay'],
  ['Bootlicker', 'PembletonWay'], ['NobblyBarns', 'PembletonWay'], ['RiversidePlazaRestroom', 'PembletonWay'],
  ['RiversidePlazaRestroomMens', 'RiversidePlazaRestroom'], ['RiversidePlazaRestroomWomens', 'RiversidePlazaRestroom'],
];

function link(geo, a, b) {
  const pa = geo.places[a];
  const pb = geo.places[b];
  if (!pa || !pb || a === b) return false;
  if (!pa.exits.includes(b)) pa.exits.push(b);
  if (!pb.exits.includes(a)) pb.exits.push(a);
  return true;
}

export function reachableFrom(geo, start) {
  const seen = new Set();
  if (!geo || !geo.places || !geo.places[start]) return seen;
  const queue = [start];
  seen.add(start);
  while (queue.length) {
    const k = queue.shift();
    for (const e of geo.places[k].exits) if (geo.places[e] && !seen.has(e)) { seen.add(e); queue.push(e); }
  }
  return seen;
}

// Nothing out of reach: a place still cut off joins the reached place its
// `anchor` names, else the start.
function joinUnreached(geo, anchor) {
  for (let guard = Object.keys(geo.places).length; guard > 0; guard--) {
    const seen = reachableFrom(geo, geo.start);
    const lost = Object.keys(geo.places).find((k) => !seen.has(k));
    if (!lost) return;
    const to = anchor(lost, seen);
    link(geo, lost, to && seen.has(to) ? to : geo.start);
  }
}

// The original's places, joined: the geography of a world with no model,
// before the world's own layout lands, when one cannot be made, and of worlds
// made before there were layouts. Every place can be walked to.
export function fallbackGeo(setup, names = {}) {
  const maps = (setup && setup.ob_maps) || {};
  const nodes = placesIn(setup);
  const geo = { v: 1, source: 'fallback', start: null, areas: [], places: {} };
  const areaOf = (block) => {
    const m = maps[block] || {};
    if (m.outdoors) return block === 'Bus' && maps.Town ? 'Town' : block;
    return m.defaultmaptab && maps[m.defaultmaptab] ? m.defaultmaptab : block;
  };
  for (const [key, p] of nodes) {
    if (EXCLUDED_BLOCKS.has(p.map)) continue;
    const outdoor = !!(maps[p.map] && maps[p.map].outdoors);
    geo.places[key] = {
      name: String((names && names[key]) || p.name || key), kind: kindOf(key, outdoor),
      area: areaOf(p.map), indoor: !outdoor, exits: [],
    };
  }
  for (const [key, p] of nodes) for (const e of Array.isArray(p.exits) ? p.exits : []) link(geo, key, e);
  // a building's first room opens onto its door; its other rooms are off the first
  for (const [block, m] of Object.entries(maps)) {
    if (EXCLUDED_BLOCKS.has(block) || !m || m.outdoors || !m.nodes || typeof m.nodes !== 'object') continue;
    const rooms = Object.keys(m.nodes).filter((k) => geo.places[k] && nodes.get(k).map === block);
    if (!rooms.length) continue;
    const door = m.outside || DOORS[block];
    if (door) link(geo, rooms[0], door);
    for (const r of rooms.slice(1)) link(geo, r, rooms[0]);
  }
  for (const [a, b] of LINKS) link(geo, a, b);
  geo.start = geo.places.YourDorm ? 'YourDorm' : startingPlace(setup);
  if (!geo.places[geo.start]) geo.start = Object.keys(geo.places)[0] || null;
  if (geo.start) {
    joinUnreached(geo, (lost, seen) => Object.keys(geo.places)
      .find((k) => seen.has(k) && geo.places[k].area === geo.places[lost].area));
  }
  geo.areas = [...new Set(Object.values(geo.places).map((p) => p.area))]
    .map((id) => ({ id, name: String((maps[id] && maps[id].name) || id), look: '' }));
  return geo;
}

// The kinds a class can be held in when a world has one to spare, in order.
const HOST_KINDS = ['gathering', 'lodging', 'entertainment', 'shop', 'food'];

// The world's own layout (world/layout.mjs reads it), made into a geography:
// each place stands on a backer of its kind, paths are made so every place can
// be reached, and a world with a timetable keeps the places its classes meet.
export function buildGeography(layout, { timetable = false, setup = null } = {}) {
  const areas = (layout && Array.isArray(layout.areas) ? layout.areas : []).filter((a) => a && a.name);
  const areaId = new Map(areas.map((a) => [a.n, `a${a.n}`]));
  let homes = 0;
  const rows = (layout && Array.isArray(layout.places) ? layout.places : [])
    .filter((p) => p && KINDS[p.kind] && areaId.has(p.area))
    .map((p) => ({ ...p, kind: p.kind === 'home' && homes++ > 0 ? 'lodging' : p.kind }));
  if (!rows.some((p) => p.kind === 'home')) return null;

  const geo = { v: 1, source: 'model', start: null, places: {},
    areas: areas.map((a) => ({ id: `a${a.n}`, name: a.name, look: a.look || '' })) };
  const used = new Set();
  const keyOf = new Map();
  for (const p of rows) {
    const key = KINDS[p.kind].find((k) => !used.has(k));
    if (!key) continue; // the kind is full
    used.add(key);
    keyOf.set(p.n, key);
    geo.places[key] = { name: p.name, kind: p.kind, area: areaId.get(p.area), indoor: !p.outdoor, exits: [] };
  }
  // a room is in its building's area
  for (const p of rows) {
    const key = keyOf.get(p.n);
    const parent = p.inside != null ? keyOf.get(p.inside) : null;
    if (key && parent && parent !== key) geo.places[key].area = geo.places[parent].area;
  }
  const home = Object.keys(geo.places).find((k) => geo.places[k].kind === 'home');
  // A world with a timetable keeps the places its classes meet. The layout
  // asks for them (world/layout.mjs); one that came back short stands a class
  // on a place of its own it has more than one of - a second hall before a
  // second inn, never its only one of a kind - and only a world with nothing
  // to spare shows the original's name.
  if (timetable) {
    const nodes = placesIn(setup);
    const count = (kind) => Object.values(geo.places).filter((p) => p.kind === kind).length;
    for (const venue of CLASS_VENUES) {
      if (geo.places[venue]) continue;
      const kind = HOST_KINDS.find((k) => count(k) > 1);
      const host = kind ? Object.keys(geo.places).filter((k) => geo.places[k].kind === kind && !CLASS_VENUES.includes(k)).pop() : null;
      if (host) {
        geo.places[venue] = { ...geo.places[host], kind: kindOf(venue) };
        delete geo.places[host];
        used.delete(host);
        for (const [n, k] of keyOf) if (k === host) keyOf.set(n, venue);
      } else {
        const node = nodes.get(venue);
        geo.places[venue] = { name: String((node && node.name) || venue), kind: kindOf(venue), area: geo.places[home].area, indoor: true, exits: [] };
      }
    }
  }

  const ids = geo.areas.map((a) => a.id);
  const keysIn = (id) => Object.keys(geo.places).filter((k) => geo.places[k].area === id);
  const anchor = (id) => { const ks = keysIn(id); return ks.find((k) => !geo.places[k].indoor) || ks[0] || null; };
  // an area's outdoor places are a chain, closed into a loop at four or more
  for (const id of ids) {
    const outs = keysIn(id).filter((k) => !geo.places[k].indoor);
    for (let i = 1; i < outs.length; i++) link(geo, outs[i - 1], outs[i]);
    if (outs.length >= 4) link(geo, outs[outs.length - 1], outs[0]);
  }
  // a room goes into its building; a building opens onto the place it names
  // in its own area, else onto its area's first outdoor place
  for (const p of rows) {
    const key = keyOf.get(p.n);
    if (!key || !geo.places[key].indoor) continue;
    const parent = p.inside != null ? keyOf.get(p.inside) : null;
    const onto = p.opensOnto != null ? keyOf.get(p.opensOnto) : null;
    if (parent && parent !== key) link(geo, key, parent);
    else if (onto && onto !== key && geo.places[onto].area === geo.places[key].area) link(geo, key, onto);
    else link(geo, key, anchor(geo.places[key].area));
  }
  for (const venue of CLASS_VENUES) {
    if (geo.places[venue] && !geo.places[venue].exits.length) link(geo, venue, anchor(geo.places[venue].area));
  }
  // areas meet where the layout says they border
  for (const a of areas) {
    for (const b of Array.isArray(a.borders) ? a.borders : []) {
      if (!areaId.has(b)) continue;
      const x = anchor(`a${a.n}`);
      const y = anchor(areaId.get(b));
      if (x && y) link(geo, x, y);
    }
  }
  geo.start = home;
  // an area the borders left apart joins the nearest area before it that is
  // reached; with none, the streets of home - never the home itself
  const homeStreet = anchor(geo.places[home].area);
  for (let i = 0; i < ids.length; i++) {
    const a = anchor(ids[i]);
    const seen = reachableFrom(geo, geo.start);
    if (!a || seen.has(a)) continue;
    let joined = false;
    for (let j = i - 1; j >= 0 && !joined; j--) {
      const b = anchor(ids[j]);
      if (b && seen.has(b)) joined = link(geo, a, b);
    }
    if (!joined) link(geo, a, homeStreet && seen.has(homeStreet) ? homeStreet : geo.start);
  }
  // and nothing is out of reach
  joinUnreached(geo, (lost, seen) => keysIn(geo.places[lost].area).find((k) => seen.has(k)));
  geo.areas = geo.areas.filter((a) => keysIn(a.id).length);
  return geo;
}

// A key as the engine means it, to the place standing for it. The sidebar's
// class "Go there" hands over the class building's door on the original map;
// in a world's own layout another street may stand on that key, so a building,
// or its own door, is the building's first room that is a place. Any other key
// is the place on it. Moves between places never come through here: their
// keys are the geography's own.
export function resolvePlace(geo, setup, key) {
  if (!geo || !geo.places || typeof key !== 'string') return null;
  for (const [block, m] of Object.entries((setup && setup.ob_maps) || {})) {
    if (!m || m.outdoors || !m.nodes || typeof m.nodes !== 'object') continue;
    if (block !== key && m.outside !== key) continue;
    const room = Object.keys(m.nodes).find((k) => geo.places[k]);
    if (room) return room;
  }
  return geo.places[key] ? key : null;
}

export function shortestPath(geo, from, to) {
  if (!geo || !geo.places || !geo.places[from] || !geo.places[to]) return null;
  if (from === to) return [from];
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const k = queue.shift();
    for (const e of geo.places[k].exits) {
      if (!geo.places[e] || prev.has(e)) continue;
      prev.set(e, k);
      if (e === to) {
        const path = [to];
        for (let x = k; x !== null; x = prev.get(x)) path.unshift(x);
        return path;
      }
      queue.push(e);
    }
  }
  return null;
}

export const travelMinutes = (path) => Math.max(0, ((path && path.length) || 1) - 1) * STEP_MINUTES;

export const geoNames = (geo) => Object.fromEntries(Object.entries((geo && geo.places) || {}).map(([k, p]) => [k, p.name]));

// The geography in play: the world's own, else the fallback - made once per
// map and set of names, since the hub asks on every screen.
const fallbacks = new WeakMap();
export function geoOf(V, setup) {
  const own = V && V[GEO_KEY];
  if (own && own.places && typeof own.places === 'object' && Object.keys(own.places).length) return own;
  const maps = setup && setup.ob_maps;
  const names = (V && V[PLACES_KEY]) || {};
  const sig = JSON.stringify(names);
  const hit = maps && typeof maps === 'object' ? fallbacks.get(maps) : null;
  if (hit && hit.sig === sig) return hit.geo;
  const geo = fallbackGeo(setup, names);
  if (maps && typeof maps === 'object') fallbacks.set(maps, { sig, geo });
  return geo;
}
