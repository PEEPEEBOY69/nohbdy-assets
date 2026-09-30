// world/goods.mjs — what the world's kitchens serve and its shops sell.
//
// v36 gave every world its own taverns, stalls and shops. The engine's own
// stores are the original's (a vending machine of chocolate bars, a campus
// dining hall) and their passages do not ship. A world's goods are its own
// names over BACKERS: things the engine can really sell, feed, pour, dress and
// furnish with - a fish stew that is the engine's chili, a tarred coat that is
// its rustic jacket, a feather bed that is its memory-foam mattress. The model
// names things; code picks every backer from a short numbered list of what
// each thing is FOR, so everything sold is real to the engine. Lines, not
// JSON, a few places a call: a reply the platform cuts off at about 2,900
// characters keeps what it finished (world/layout.mjs).
import { faultsIn as defaultFaults } from './persona.mjs';

export const GOODS_KEY = 'obscuraGoods';
export const MAX_ITEMS = 8;
export const PLACES_PER_CALL = 8;

const role = (id, what, type, item) => ({ id, what, type, item });

// What a menu can serve: eaten or drunk where it is bought.
export const MENU_ROLES = [
  role(1, 'a filling hot meal', 'food', "shepherd's pie"),
  role(2, 'a hearty stew or soup', 'food', 'spicy chili'),
  role(3, 'roast or fried meat', 'food', 'pork chop'),
  role(4, 'a fish dish', 'food', 'fish taco'),
  role(5, 'bread with something on or in it', 'food', 'sandwich'),
  role(6, 'a light meal', 'food', 'salad'),
  role(7, 'a big breakfast', 'food', 'full breakfast'),
  role(8, 'a vegetable dish', 'food', 'ratatouille'),
  role(9, 'a fine, costly dish', 'food', 'steak'),
  role(10, 'a sweet treat', 'food', 'slice of apple pie'),
  role(11, 'a cheap snack', 'food', 'pretzels'),
  role(12, 'water', 'food', 'cup of water'),
  role(13, 'a hot drink that wakes you up', 'food', 'cup of coffee'),
  role(14, 'a soothing hot drink', 'food', 'hot chocolate'),
  role(15, 'a sweet cold drink', 'food', 'cup of fruit punch'),
  role(16, 'a mild alcoholic drink', 'alcohol', 'beer'),
  role(17, 'wine', 'alcohol', 'wine'),
  role(18, 'a strong spirit', 'alcohol', 'rum'),
];

// What a shop can sell: food to keep at home (only what the engine lets a
// player keep without a fridge or a cooking skill), clothes, and goods for the
// home that do something there. The home's goods are Obscura's own, not the
// engine's room things: a world's build regenerates that table, keys and all
// (only the 36 its code names survive), so a bed of the original's is not
// there to stand on. A bed sets how fast sleep restores rest (the engine's
// beds run 110 to 150 an hour); what hangs on the wall calms a point an hour
// slept, and a seat while resting too; a lamp makes study at home go faster.
export const SHOP_ROLES = {
  food: [
    role(19, 'a travel snack', 'food', 'granola bar'),
    role(20, 'a filling ration', 'food', 'ham paste and crackers'),
    role(21, 'nuts or seeds', 'food', 'bag of mixed nuts'),
    role(22, 'fresh fruit', 'food', 'fruit'),
    role(23, 'biscuits or cookies', 'food', 'bag of cookies'),
    role(24, 'something sweet', 'food', 'candy bar'),
    role(25, 'a pastry', 'food', 'chocolate croissant'),
    role(26, 'a sweet bun', 'food', 'melonpan'),
    role(27, 'crackers', 'food', 'bag of rice crackers'),
    role(28, 'bottled water', 'food', 'bottle of water'),
    role(29, 'a drink that keeps you awake', 'food', 'can of energy drink'),
  ],
  clothes: [
    role(30, 'a shirt', 'clothes', 'T-shirt'),
    role(31, 'trousers', 'clothes', 'Plain Pants'),
    role(32, 'sturdy work trousers', 'clothes', 'Cargo Pants'),
    role(33, 'a dress', 'clothes', 'Sundress'),
    role(34, 'a coat or jacket', 'clothes', 'Rustic Jacket'),
    role(35, 'a warm hooded top', 'clothes', 'Warm Hoodie'),
    role(36, 'plain shoes', 'clothes', 'Flats'),
    role(37, 'sturdy boots', 'clothes', 'Work Boots'),
    role(38, 'sandals', 'clothes', 'Sandals'),
    role(39, 'a hat', 'clothes', 'Flat Cap'),
    role(40, 'a bag', 'clothes', 'Messenger Bag'),
  ],
  goods: [
    { ...role(41, 'a better bed', 'home', 'bed'), slot: 'bed', rest: 120, price: 600 },
    { ...role(42, 'a fine bed', 'home', 'bed'), slot: 'bed', rest: 130, price: 1200 },
    { ...role(43, 'the best bed there is', 'home', 'bed'), slot: 'bed', rest: 150, price: 3000 },
    { ...role(44, 'a painting for the wall', 'home', 'wall'), slot: 'wall', relax: 1, price: 120 },
    { ...role(45, 'a portrait for the wall', 'home', 'wall'), slot: 'wall', relax: 1, price: 80 },
    { ...role(46, 'a lamp or a light', 'home', 'light'), slot: 'light', study: 1.25, price: 40 },
    { ...role(47, 'a fine lamp', 'home', 'light'), slot: 'light', study: 1.4, price: 150 },
    { ...role(48, 'a chair, a stool or a bench', 'home', 'seat'), slot: 'seat', relax: 1, price: 60 },
    { ...role(49, 'a fine seat', 'home', 'seat'), slot: 'seat', relax: 2, price: 250 },
  ],
};

export const ROLES = [...MENU_ROLES, ...SHOP_ROLES.food, ...SHOP_ROLES.clothes, ...SHOP_ROLES.goods];
const ROLE = new Map(ROLES.map((r) => [r.id, r]));
export const SELLS = ['food', 'clothes', 'goods'];

const range = (list) => `${list[0].id}-${list[list.length - 1].id}`;

export function buildGoodsPrompt(persona, places) {
  return [
    persona,
    '',
    'TASK',
    'Name what this world\'s kitchens serve and its shops sell, as the people here call each thing.',
    '',
    'RULES',
    '- Reply with ONLY one line for every place below, in one of these two forms:',
    '  MENU <place n>. <place name> | <dish or drink> = <thing n> | <dish or drink> = <thing n> | ...',
    '  SHOP <place n>. <place name> | <food, clothes or goods> | <ware> = <thing n> | <ware> = <thing n> | ...',
    `- A place that serves food and drink gets a MENU line from things ${range(MENU_ROLES)}.`,
    `- A shop sells one of three, whichever fits its name: food to keep (things ${range(SHOP_ROLES.food)}),`
      + ` clothes (things ${range(SHOP_ROLES.clothes)}) or goods for a home (things ${range(SHOP_ROLES.goods)}).`,
    '- Four to eight things a place, each named for this world: a short name, as it would be written on a board or a label, under 30 characters, no prices.',
    '- Only what exists in this world: a world with no strong drink serves none.',
    '',
    'THINGS',
    ...ROLES.map((r) => `${r.id}. ${r.what}`),
    '',
    'PLACES',
    ...places.map((p, i) => `${i + 1}. ${p.name} (${p.kind === 'food' ? 'serves food and drink' : 'a shop'})`),
  ].join('\n');
}

const MENU_LINE = /^\s*MENU\s+(\d+)\s*[.):-]?\s*(.*)$/i;
const SHOP_LINE = /^\s*SHOP\s+(\d+)\s*[.):-]?\s*(.*)$/i;
const NOT_A_NAME = /[[\]{}<>%\\|$=]/;

export function cleanGoodName(raw, faultsIn = defaultFaults) {
  const s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (!s || s.length > 40 || NOT_A_NAME.test(s) || faultsIn(s, 'name').length) return null;
  return s;
}

const MENU_IDS = new Set(MENU_ROLES.map((r) => r.id));
const SHOP_IDS = new Set(SELLS.flatMap((s) => SHOP_ROLES[s].map((r) => r.id)));
const TRADE_OF = new Map(SELLS.flatMap((s) => SHOP_ROLES[s].map((r) => [r.id, s])));

// The word a shop's line wrote for its trade, when it is one of the three.
const tradeWord = (part) => {
  const w = String(part || '').trim().toLowerCase();
  return SELLS.find((s) => w.startsWith(s)) || null;
};

// A thing's own words (its gloss, "roast or fried meat"), as the model echoes
// them in place of its number: every word of what it wrote is a word of the
// gloss, or the start of one ("hood" of "hooded", "alcohol" of "alcoholic").
const STOP = new Set(['a', 'an', 'the', 'or', 'and', 'of', 'on', 'in', 'it', 'with', 'for', 'that', 'you', 'up', 'there',
  'is', 'something', 'to', 'keep', 'home']);
const wordsOf = (s) => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
const GLOSS_WORDS = ROLES.map((r) => [r.id, wordsOf(r.what)]);
const sameWord = (w, g) => w === g || (w.length >= 3 && g.length >= 3 && (g.startsWith(w) || w.startsWith(g)));
function glossRole(text, allowed) {
  const words = wordsOf(text);
  if (!words.length) return null;
  const hit = GLOSS_WORDS.find(([id, g]) => allowed.has(id) && words.every((w) => g.some((x) => sameWord(w, x))));
  return hit ? hit[0] : null;
}

// Labels the template taught the model, never a thing's name.
const LABEL = /^(?:ware|thing|item|dish|drink|dish or drink|name)$/i;

// One part of a line, "name = n" in any of the forms the real model writes:
// the number alone or after "thing" or "ware", or on the end of the name; with
// no number, the role read from the thing's own words; a part may carry only a
// name, or only a number, to be paired with its neighbour.
function readPart(part, allowed, faultsIn) {
  const sides = String(part).split('=').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let id = null;
  const texts = [];
  for (const side of sides) {
    const m = /^(?:(?:thing|ware|item)\s*)?#?(\d{1,2})$/i.exec(side);
    if (m && id == null) { id = Number(m[1]); continue; }
    texts.push(side);
  }
  if (id == null) {
    for (let i = 0; i < texts.length; i += 1) {
      const m = /^(.*?\S)(?:\s+|\s*[(#]\s*)(\d{1,2})\)?$/.exec(texts[i]);
      if (m && allowed.has(Number(m[2]))) { id = Number(m[2]); texts[i] = m[1].trim(); break; }
    }
  }
  const named = texts.filter((t) => !LABEL.test(t));
  const glosses = named.map((t) => glossRole(t, allowed));
  if (id == null) {
    const g = glosses.find((x) => x != null);
    if (g != null) id = g;
  }
  const plain = named.filter((t, i) => glosses[i] == null);
  const raw = plain.length ? plain[plain.length - 1] : named[named.length - 1];
  return { id, name: raw ? cleanGoodName(raw, faultsIn) : null };
}

// A reply, by the places it was asked about (numbered from 1): each place's
// line once, its things by role. A shop sells one line of trade: the one most
// of its wares' numbers belong to (the real model writes its own word for a
// trade, "Gear" or "food to keep", or none), its own word breaking a tie. A
// thing from another list, a repeated name or a name that is not one is
// dropped; a place's second line, a line for a place of the other kind, and a
// line cut off before its things are not read.
export function parseGoods(reply, places, faultsIn = defaultFaults) {
  const out = {};
  for (const raw of String(reply == null ? '' : reply).split(/\r?\n/)) {
    const line = raw.replace(/\*\*/g, '');
    let m = MENU_LINE.exec(line);
    const menu = !!m;
    if (!m) m = SHOP_LINE.exec(line);
    if (!m) continue;
    const place = places[Number(m[1]) - 1];
    if (!place || out[place.key] || menu !== (place.kind === 'food')) continue;
    const allowed = menu ? MENU_IDS : SHOP_IDS;
    const parts = m[2].split('|').map((x) => x.trim()).slice(1);
    const read = parts.map((p) => readPart(p, allowed, faultsIn));
    // a shop's first part is its trade when it is a word alone, not a name
    // waiting for the number in the part after it
    const trade = !menu && parts.length > 1 && !/[=\d]/.test(parts[0]) && !(read[1].id != null && !read[1].name);
    const said = trade ? tradeWord(parts[0]) : null;
    const names = new Set();
    const found = [];
    const add = (name, id) => {
      const list = menu ? (MENU_IDS.has(id) ? 'menu' : null) : TRADE_OF.get(id);
      if (!name || !list || names.has(name.toLowerCase())) return;
      names.add(name.toLowerCase());
      found.push({ name, role: id, list });
    };
    let pending = null;
    read.forEach((r, i) => {
      if (i === 0 && trade) return;
      if (r.id != null && r.name) { add(r.name, r.id); pending = null; return; }
      if (r.id != null) { if (pending) add(pending, r.id); pending = null; return; }
      pending = r.name;
    });
    let sells = 'menu';
    if (!menu) {
      const count = (x) => found.filter((f) => f.list === x).length;
      const most = Math.max(0, ...SELLS.map(count));
      const tied = SELLS.filter((x) => most > 0 && count(x) === most);
      sells = tied.includes(said) ? said : tied[0];
    }
    const items = found.filter((f) => f.list === sells).slice(0, MAX_ITEMS).map(({ name, role }) => ({ name, role }));
    if (items.length) out[place.key] = { sells, items };
  }
  return out;
}

// With nothing from the model: plain names that fit any world, and a shop's
// line of trade guessed from its name.
const FALLBACK_MENU = [['Hot meal', 1], ['Stew', 2], ['Bread and filling', 5], ['Something sweet', 10], ['Water', 12],
  ['Hot drink', 13], ['Strong drink', 18]];
const FALLBACK_SHOP = {
  food: [['Travel biscuits', 19], ['Nuts', 21], ['Fruit', 22], ['Something sweet', 24], ['Water', 28]],
  clothes: [['Shirt', 30], ['Trousers', 31], ['Coat', 34], ['Shoes', 36], ['Boots', 37], ['Hat', 39]],
  goods: [['A better bed', 41], ['A fine bed', 42], ['A painting', 44], ['A lamp', 46], ['A stool', 48]],
};
const CLOTHES_WORDS = /cloth|tailor|dress|wear|boot|shoe|cobbler|\bhat|rag|silk|weav|thread|garment|coat|stitch|linen|wool|leather|fashion|apparel|boutique|seam|needle|loom|\bfur|hide/i;
const FOOD_WORDS = /bak|bread|market|grocer|fish|meat|butcher|stall|pantry|food|fruit|cheese|provision|larder|deli|spice|mill|grain|sweet|candy|confection|salt|smok|cellar|granary|harvest|produce/i;

export function sellsByName(name) {
  if (CLOTHES_WORDS.test(name)) return 'clothes';
  if (FOOD_WORDS.test(name)) return 'food';
  return 'goods';
}

export function fallbackFor(place) {
  const listOf = (pairs) => pairs.map(([name, id]) => ({ name, role: id }));
  if (place && place.kind === 'food') return { sells: 'menu', items: listOf(FALLBACK_MENU) };
  const sells = sellsByName((place && place.name) || '');
  return { sells, items: listOf(FALLBACK_SHOP[sells]) };
}

// A place's stock: the world's own where it has one, else the plain one.
export function goodsFor(V, place) {
  const own = V && V[GOODS_KEY] && V[GOODS_KEY].places && place && V[GOODS_KEY].places[place.key];
  if (own && Array.isArray(own.items) && own.items.length) return own;
  return fallbackFor(place);
}

const DB = { food: 'ob_food', alcohol: 'ob_alcohol', clothes: 'clothes' };
export function priceOf(setup, type, item) {
  const table = setup && setup[DB[type]];
  const entry = table && table[item];
  const n = entry ? Number(entry.price) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Each thing with its backer and the backer's price; a home's goods with
// their own.
export function stockOf(entry, setup) {
  return ((entry && entry.items) || []).map((it) => {
    const r = ROLE.get(it.role);
    if (!r) return null;
    if (r.type === 'home') {
      return { name: it.name, type: 'home', item: r.item, price: r.price, role: r.id, slot: r.slot,
        ...(r.rest ? { rest: r.rest } : {}), ...(r.relax ? { relax: r.relax } : {}), ...(r.study ? { study: r.study } : {}) };
    }
    return { name: it.name, type: r.type, item: r.item, price: priceOf(setup, r.type, r.item), role: r.id };
  }).filter(Boolean);
}

const usable = (model) => !!model && typeof model.ask === 'function'
  && (typeof model.available !== 'function' || model.available());

// The world's goods: its kitchens and shops, a few a call, in the background;
// a batch that brought nothing for some of its places is asked once more for
// those.
export async function generateGoods({ model, persona, geo, faultsIn = defaultFaults }) {
  if (!usable(model)) return { goods: null, problems: ['no model'], calls: 0 };
  const places = Object.entries((geo && geo.places) || {})
    .filter(([, p]) => p && (p.kind === 'food' || p.kind === 'shop'))
    .map(([key, p]) => ({ key, name: p.name, kind: p.kind }));
  const out = {};
  const problems = [];
  let calls = 0;
  const text = () => (typeof persona === 'function' ? persona() : persona);
  for (let i = 0; i < places.length; i += PLACES_PER_CALL) {
    let batch = places.slice(i, i + PLACES_PER_CALL);
    for (let attempt = 0; attempt < 2 && batch.length; attempt += 1) {
      calls += 1;
      let reply = '';
      try {
        reply = await model.ask(buildGoodsPrompt(text(), batch), { maxTokens: 1200, temperature: 0.85, background: true });
      } catch (err) {
        problems.push(`goods: ${err && err.message ? err.message : String(err)}`);
        continue;
      }
      Object.assign(out, parseGoods(reply, batch, faultsIn));
      batch = batch.filter((p) => !out[p.key]);
    }
  }
  if (!Object.keys(out).length) return { goods: null, problems: [...problems, ...(places.length ? ['no goods'] : [])], calls };
  return { goods: { v: 1, source: 'model', places: out }, problems, calls };
}
