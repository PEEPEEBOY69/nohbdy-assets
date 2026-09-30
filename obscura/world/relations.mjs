// world/relations.mjs — what the two of you could be, offered and taken.
//
// The engine keeps a table of what someone can be to the player - partner,
// soulmate, spouse, an open or a poly partner, a fuckbuddy, their master or
// their submissive - and its own qualified() decides who can be offered
// which: how they feel, what they want of the player, the dates and nights
// had, cooldowns, breakups, who else they are with. Its set() makes it so, and
// its profile, its memories and its people's behaviour follow. None of it was
// reachable: its scenes for asking never shipped. At the end of a date or a
// night (world/datescreen.mjs) what the engine qualifies them for is offered
// here, in plain words. While the player is spoken for by someone else,
// nothing exclusive is offered to anyone but that someone.

export const OFFERS = ['partner', 'soulmate', 'spouse', 'open partner', 'poly partner', 'fuckbuddy', 'dominant', 'submissive'];

export const OFFER_WORDS = {
  partner: { ask: 'Ask {first} to be yours, and only yours', yes: '{first} says yes. From tonight it is the two of you.' },
  soulmate: { ask: 'Tell {first} there is nobody else and never will be', yes: '{first} says yes, and means it with everything.' },
  spouse: { ask: 'Ask {first} to marry you', yes: '{first} says yes, and cannot stop smiling.' },
  'open partner': { ask: 'Ask {first} to be yours, with room for others', yes: '{first} says yes: yours, and free.' },
  'poly partner': { ask: 'Ask {first} to be one of yours', yes: '{first} says yes, and does not ask to be the only one.' },
  fuckbuddy: { ask: 'Keep it casual with {first}', yes: '{first} says yes: no promises, just this.' },
  dominant: { ask: 'Give yourself to {first} to command', yes: '{first} says yes, and tells you exactly how it will be.' },
  submissive: { ask: 'Ask {first} to kneel for you', yes: '{first} says yes, eyes down, waiting for your word.' },
};

const YES_KEY = 'obscuraOfferYes';

const safe = (fn, fallback) => { try { const v = fn(); return v == null ? fallback : v; } catch { return fallback; } };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const firstOf = (setup, name) => safe(() => setup.people.firstname(name), String(name).split(' ')[0]);
const fill = (text, first) => String(text).replace(/\{first\}/g, first);

// What the engine qualifies them for, that they are not already.
export function offersFor(setup, V, name) {
  const R = setup && setup.ob_relationships;
  if (!R || typeof R.qualified !== 'function' || !R.db) return [];
  const current = safe(() => R.relationship_with(name), null);
  const theirs = safe(() => R.relationship_type_with(name), null) === 'romantic';
  const spokenFor = !theirs && !!safe(() => R.in_exclusive_relationship(), false);
  return OFFERS.filter((rel) => rel !== current && R.db[rel] && !(spokenFor && R.db[rel].exclusive)
    && !!safe(() => R.qualified(name, rel), false));
}

// Through the engine's own set(), and only what is on offer.
export function takeOffer(setup, V, name, rel) {
  if (!offersFor(setup, V, name).includes(rel)) return false;
  try { setup.ob_relationships.set(name, rel); } catch (err) { console.warn('Obscura: the relationship could not be set', err); return false; }
  return true;
}

// The offers as links, and the answer to one just taken. No newlines: printed
// with <<=, each one would be a line break on screen.
export function offersHtml(setup, V, name, { yes = null } = {}) {
  const offers = offersFor(setup, V, name);
  const first = firstOf(setup, name);
  const answer = yes && OFFER_WORDS[yes] ? `<p class="ob-offers-yes">${esc(fill(OFFER_WORDS[yes].yes, first))}</p>` : '';
  if (!offers.length && !answer) return '';
  const links = offers.map((rel) => `<<link "${esc(fill(OFFER_WORDS[rel].ask, first))}">><<run setup.ob_offer_take(${JSON.stringify(name)}, "${rel}")>><</link>>`);
  return `<div class="ob-offers">${answer}${links.length ? `<div class="ob-offers-title">What you could be to each other</div>${links.join('')}` : ''}</div>`;
}

// The engine side, installed at boot. deps: SugarCube.
export function installRelations(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const setup = SC && SC.setup;
  if (!setup) return false;
  const V = () => SC.State.variables;

  // the answer shows once, on the screen drawn right after it
  setup.ob_offers_html = (name) => {
    const v = V();
    const y = v[YES_KEY];
    if (y) delete v[YES_KEY];
    return offersHtml(setup, v, name, { yes: y && y.name === name ? y.rel : null });
  };

  setup.ob_offer_take = (name, rel) => {
    const v = V();
    if (!takeOffer(setup, v, name, rel)) return false;
    v[YES_KEY] = { name, rel };
    SC.Engine.play(SC.State.passage);
    return true;
  };
  return true;
}
