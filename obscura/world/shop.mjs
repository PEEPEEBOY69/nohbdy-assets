// world/shop.mjs — menus, wares and the home's stores, on screen.
//
// What a world's kitchens serve and its shops sell (world/goods.mjs), shown
// under the world's names and bought through the engine's own purchase
// (setup.ob_shops.maybe_purchase): the money taken, a dish eaten where it is
// served, a drink drunk, food kept in the home's stores, a garment into the
// wardrobe. The engine's purchase message names the backer ("a spicy chili"),
// so the line shown is Obscura's own. A home's goods (a bed, a painting) are
// Obscura's own, kept in $obscuraHome (world/goods.mjs says why).
import { SCREEN_KEY, moneyOf, priceText } from './actions.mjs';
import { goodsFor, stockOf, ROLES } from './goods.mjs';
import { geoOf } from './geography.mjs';

export const RESULT_KEY = 'obscuraShopResult';
const SNACK_KEY = 'obscuraSnack';
export const HOME_KEY = 'obscuraHome';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The engine's shape of a shop: its items under their labels; a menu is eaten
// where it is bought.
export function shopObject(place, entry, stock) {
  return {
    name: (place && place.name) || '',
    'eat immediately': !!entry && entry.sells === 'menu',
    items: (stock || []).map((s) => ({ label: s.name, type: s.type, item: s.item })),
  };
}

// A garment is bought with every choice the engine offers for it made (the
// first of each): with none made, its name keeps "%style %color".
export function subsFor(setup, item) {
  const entry = setup && setup.clothes && setup.clothes[item];
  const subs = {};
  if (!entry) return subs;
  for (const [key, values] of Object.entries(entry)) {
    if (key.startsWith('sub ') && Array.isArray(values) && values.length) subs[key.slice(4)] = values[0];
  }
  return subs;
}

// A home's good, taking the place of the one in its slot (a bed, the wall).
function placeAtHome(V, s) {
  const home = V[HOME_KEY] || (V[HOME_KEY] = {});
  if (home[s.slot] && home[s.slot].name === s.name) return { ok: false, line: `You already have the ${s.name} at home.` };
  if (moneyOf(V) < s.price) return { ok: false, line: `You cannot afford the ${s.name} (${priceText(s.price)}).` };
  home[s.slot] = s.slot === 'bed' ? { name: s.name, rest: s.rest } : { name: s.name, relax: s.relax };
  V.pcmoney = moneyOf(V) - s.price;
  return { ok: true, line: `You pay ${priceText(s.price)} for ${s.name}. It is in your room at home.` };
}

// One purchase: what the engine does with it, and the line for it.
export function buy(setup, V, place, entry, i) {
  const stock = stockOf(entry, setup);
  const s = stock[i];
  if (!s) return { ok: false, line: 'That is not sold here.' };
  if (s.type === 'home') return placeAtHome(V, s);
  if (moneyOf(V) < s.price) return { ok: false, line: `You cannot afford the ${s.name} (${priceText(s.price)}).` };
  const menu = entry.sells === 'menu';
  const subs = s.type === 'clothes' ? subsFor(setup, s.item) : {};
  const check = setup.ob_shops.maybe_purchase(shopObject(place, entry, stock), s.type, s.item, subs, menu);
  delete V.shopbuyresult;
  if (!check || !check.result) return { ok: false, line: (check && check.reason) || `You cannot buy the ${s.name}.` };
  const paid = `You pay ${priceText(s.price)}`;
  if (s.type === 'alcohol') return { ok: true, line: `${paid} and drink the ${s.name}.` };
  if (s.type === 'food' && menu) return { ok: true, line: `${paid} and have the ${s.name}.` };
  if (s.type === 'food') {
    const food = setup.ob_food && setup.ob_food[s.item];
    const many = food && food['purchase quantity'] > 1 ? ` (${food['purchase quantity']})` : '';
    return { ok: true, line: `${paid} for ${s.name}${many}, for your stores at home.` };
  }
  return { ok: true, line: `${paid} for ${s.name}. It is in your wardrobe.` };
}

export function shopScreenHtml({ place, entry, stock = [], money = 0, result = '' }) {
  const menu = !!entry && entry.sells === 'menu';
  const out = ['<div class="ob-shop">'];
  out.push(`<div class="ob-shop-head"><div class="ob-shop-name">${esc(place && place.name)}</div>`
    + `<div class="ob-shop-money">You have ${priceText(money)}</div></div>`);
  if (result) out.push(`<div class="ob-shop-result">${esc(result)}</div>`);
  out.push('<div class="ob-shop-items">');
  stock.forEach((s, i) => {
    const can = money >= s.price
      ? `<<link "${menu ? 'Have it' : 'Buy'}">><<run setup.ob_shop_buy(${i})>><</link>>`
      : '<span class="ob-shop-short">not enough money</span>';
    out.push(`<div class="ob-shop-item"><span class="ob-shop-item-name">${esc(s.name)}</span>`
      + `<span class="ob-shop-price">${priceText(s.price)}</span>${can}</div>`);
  });
  out.push('</div><div class="ob-hub-actions"><<link "Back">><<run setup.ob_shop_leave()>><</link>></div></div>');
  // no newlines: printed with <<=, each one would be a line break on screen
  return out.join('');
}

// A backer food's name in this world: the name any of its kitchens or shops
// sells it under, else what it is for.
export function worldNameFor(V, geo, item) {
  for (const [key, p] of Object.entries((geo && geo.places) || {})) {
    if (!p || (p.kind !== 'food' && p.kind !== 'shop')) continue;
    const entry = goodsFor(V, { key, ...p });
    for (const it of entry.items || []) {
      const r = ROLES.find((x) => x.id === it.role);
      if (r && r.item === item) return it.name;
    }
  }
  const r = ROLES.find((x) => x.item === item);
  const what = r ? r.what.replace(/^(a|an|the)\s+/i, '') : item;
  return what.charAt(0).toUpperCase() + what.slice(1);
}

// What is in the home's stores (the engine's dry stash and its fridge).
export function storedFoods(V, geo) {
  const out = [];
  for (const store of ['dormfoodstash', 'dormfridge']) {
    for (const [item, count] of Object.entries((V && V[store]) || {})) {
      if (count > 0) out.push({ item, name: worldNameFor(V, geo, item), count });
    }
  }
  return out;
}

export function eatStored(setup, V, s) {
  if (!s) return { ok: false, line: 'There is nothing like that in your stores.' };
  setup.ob_needs.eat(s.item);
  setup.ob_locationInventory.remove_food(s.item);
  setup.ob_time.advance_time(10);
  return { ok: true, line: `You eat the ${s.name}.` };
}

export function storesHtml({ stored = [], result = '' }) {
  const out = ['<div class="ob-shop ob-stores">', '<div class="ob-shop-head"><div class="ob-shop-name">Your stores</div></div>'];
  if (result) out.push(`<div class="ob-shop-result">${esc(result)}</div>`);
  if (!stored.length) out.push('<div class="ob-shop-empty">There is nothing in your stores. Shops sell food to keep.</div>');
  else {
    out.push('<div class="ob-shop-items">');
    stored.forEach((s, i) => {
      out.push(`<div class="ob-shop-item"><span class="ob-shop-item-name">${esc(s.name)}</span>`
        + `<span class="ob-shop-price">${s.count} left</span><<link "Eat one">><<run setup.ob_stores_eat(${i})>><</link>></div>`);
    });
    out.push('</div>');
  }
  out.push('<div class="ob-hub-actions"><<link "Back">><<run setup.ob_shop_leave()>><</link>></div></div>');
  return out.join('');
}

// The Inventory's "Eat a snack.": one from the bag, away from home.
export function eatSnack(setup, V) {
  const left = Number(V && V.storedsnacks) || 0;
  if (left <= 0) return { ok: false, line: 'You have no snacks left in your bag.' };
  V.storedsnacks = left - 1;
  setup.ob_needs.increase_need('Food', 150);
  setup.ob_time.advance_time(5);
  return { ok: true, line: 'You eat a snack from your bag.' };
}

export function installShop(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  if (!SC || !SC.State || !SC.setup) return false;
  const setup = SC.setup;
  const V = () => SC.State.variables;
  const current = () => {
    const v = V();
    const open = v[SCREEN_KEY] || {};
    const geo = geoOf(v, setup);
    const place = geo.places[open.place] ? { key: open.place, ...geo.places[open.place] } : null;
    return { v, open, geo, place };
  };
  setup.ob_shop_screen = () => {
    const { v, open, geo, place } = current();
    if (open.screen === 'stores') return storesHtml({ stored: storedFoods(v, geo), result: v[RESULT_KEY] });
    if (!place) return storesHtml({ stored: [], result: '' });
    const entry = goodsFor(v, place);
    return shopScreenHtml({ place, entry, stock: stockOf(entry, setup), money: moneyOf(v), result: v[RESULT_KEY] });
  };
  setup.ob_shop_buy = (i) => {
    const { v, place } = current();
    if (!place) return false;
    v[RESULT_KEY] = buy(setup, v, place, goodsFor(v, place), i).line;
    try { SC.Engine.show(); } catch { /* nothing on screen */ }
    return true;
  };
  setup.ob_stores_eat = (i) => {
    const { v, geo } = current();
    v[RESULT_KEY] = eatStored(setup, v, storedFoods(v, geo)[i]).line;
    try { SC.Engine.show(); } catch { /* nothing on screen */ }
    return true;
  };
  setup.ob_shop_leave = () => {
    const v = V();
    delete v[SCREEN_KEY];
    delete v[RESULT_KEY];
    SC.Engine.play('ObscuraHub');
  };
  // eaten once a visit to the passage, however often it is drawn
  setup.ob_snack_screen = () => {
    const v = V();
    const turn = SC.State.turns;
    if (!v[SNACK_KEY] || v[SNACK_KEY].turn !== turn) {
      const done = eatSnack(setup, v);
      v[SNACK_KEY] = { turn, html: `<div class="ob-snack"><p>${esc(done.line)}</p>`
        + '<div class="ob-hub-actions"><<link "Carry on">><<run setup.ob_snack_done()>><</link>></div></div>' };
    }
    return v[SNACK_KEY].html;
  };
  setup.ob_snack_done = () => {
    delete V()[SNACK_KEY];
    SC.Engine.play('ObscuraHub');
  };
  return true;
}
