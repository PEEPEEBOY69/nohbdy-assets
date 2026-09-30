// world/narration.mjs — every act and position of the engine's encounter, in
// plain words.
//
// The engine narrates its encounters in two scene passages that never
// shipped: one for the acts, one for the positions, some 7,600 words of its
// author's writing in a switch on each act's name. Obscura narrates them
// itself. These are the words that are always there: built for each of the
// engine's 167 acts and 34 positions from its own data - the act's label as a
// verb phrase, conjugated for the player or for someone else, and every body
// part in it given to whoever the act's own "subject parts" and "object parts"
// say it belongs to ("Rub Pussy Against Leg": you rub your pussy against her
// leg). The engine's own label for a trans man's body is used where it has
// one. The world's own words, when the model has written them, are laid over
// these (world/narrationbank.mjs).
import { fillWords } from './datemoments.mjs';

// A label's word, as the engine's parts it can name, the likeliest first (the
// engine keeps a face as a mouth, a fist as a wrist).
const PART_OF = {
  pussy: ['vagina'], 'front hole': ['vagina'], 'g-spot': ['vagina'], clit: ['clitoris'],
  cock: ['penis'], shaft: ['penis'], frenulum: ['penis'], balls: ['balls'],
  ass: ['anus', 'butt'], butthole: ['anus'], breasts: ['breasts'], breast: ['breasts'], tits: ['breasts'], tit: ['breasts'],
  nipple: ['nipples'], nipples: ['nipples'], leg: ['thigh'], thigh: ['thigh'], feet: ['foot'], foot: ['foot'],
  hand: ['hand', 'wrist'], finger: ['hand'], fingers: ['hand'], fist: ['hand', 'wrist'],
  face: ['face', 'mouth'], mouth: ['mouth'], lips: ['mouth'],
  neck: ['neck'], hair: ['hair'], back: ['back'], shoulder: ['shoulder'], bladder: ['crotch'],
};
// A part that only holds a toy (a hand, a crotch wearing a strap-on): the toy is that side's.
const HOLDS = new Set(['hand', 'crotch', 'wrist']);
const holds = (parts) => parts.length > 0 && parts.every((x) => HOLDS.has(x));
const ORIFICE = new Set(['anus', 'vagina', 'mouth']);
// The engine's part, as the word said for it when the label leaves it out.
const WORD_FOR = {
  vagina: 'pussy', clitoris: 'clit', penis: 'cock', balls: 'balls', anus: 'ass', butt: 'ass', breasts: 'breasts',
  nipples: 'nipples', thigh: 'thigh', foot: 'feet', hand: 'hand', face: 'face', mouth: 'mouth', neck: 'neck',
  hair: 'hair', back: 'back', shoulder: 'shoulder', crotch: 'crotch', wrist: 'wrist',
};
const TOYS = new Set(['toy', 'dildo', 'strap-on', 'beads', 'cocksleeve', 'sucker', 'vibrator']);
const ADJECTIVES = new Set(['clamped']);

export function conjugate(verb, third) {
  if (!third) return verb;
  if (/(s|sh|ch|x|z|o)$/.test(verb)) return `${verb}es`;
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ies`;
  return `${verb}s`;
}

const THEY = { po: 'them', pp: 'their', pq: 'theirs' };
const INDEPENDENT = { her: 'hers', his: 'his', their: 'theirs', your: 'yours' };

// The act's own words for whichever of the two it names a trans man, where it has them.
function labelOf(act, you, youGender, partnerGender) {
  const sub = act['act label substitution'];
  if (Array.isArray(sub) && sub.length >= 3) {
    const whoseGender = sub[0] === 'subject' ? (you === 'subject' ? youGender : partnerGender) : (you === 'object' ? youGender : partnerGender);
    if (whoseGender === sub[1]) return sub[2];
  }
  return act.name;
}

// The few that are not a plain verb and its parts. s: the subject's
// possessive, o: the object's, obj: the object as a pronoun, oq: the object's
// possessive standing alone ("hers"), v: the verb conjugated.
const OWN_WORDS = {
  Kiss: ({ v, obj }) => `${v('kiss')} ${obj}`,
  Frot: ({ v, s, oq }) => `${v('grind')} ${s} cock against ${oq}`,
  Trib: ({ v, s, oq }) => `${v('grind')} ${s} pussy against ${oq}`,
  Rabbitfuck: ({ v, obj }) => `${v('fuck')} ${obj} fast and hard`,
  'Rabbitfuck With Strap-on': ({ v, s, obj }) => `${v('fuck')} ${obj} fast and hard with ${s} strap-on`,
  'Deep Stroke': ({ v, obj }) => `${v('stroke')} deep into ${obj}`,
  'Deep Stroke With Strap-on': ({ v, s, obj }) => `${v('stroke')} deep into ${obj} with ${s} strap-on`,
  Hotdog: ({ v, s, o }) => `${v('slide')} ${s} cock between ${o} cheeks`,
  'Golden Shower': ({ v, obj }) => `${v('piss')} on ${obj}`,
  'Press Bladder': ({ v, o }) => `${v('press')} on ${o} bladder`,
  'Powerfuck Ass': ({ v, o }) => `${v('pound')} ${o} ass`,
  'Dickslap Ass': ({ v, s, o }) => `${v('slap')} ${o} ass with ${s} cock`,
  'Dickslap Breast': ({ v, s, o }) => `${v('slap')} ${o} breasts with ${s} cock`,
  'Dickslap Face': ({ v, s, o }) => `${v('slap')} ${o} face with ${s} cock`,
  'Cocktease With Pussy': ({ v, s, o }) => `${v('tease')} ${o} cock with ${s} pussy`,
  'Cocktease With Ass': ({ v, s, o }) => `${v('tease')} ${o} cock with ${s} ass`,
  'Vibe G-spot': ({ v, o }) => `${v('hold')} a vibrator to ${o} g-spot`,
};

// One act, done by the player (you: 'subject') or to them (you: 'object').
// partner: {name, pronouns (the engine's: po, pp, pq), gender}.
export function actWords(act, { you = 'subject', partner = {}, youGender = '' } = {}) {
  // a solo act ('self'): the player's own body, both sides of it
  if (you === 'self') partner = { name: 'You', pronouns: { po: 'yourself', pp: 'your', pq: 'yours' }, gender: youGender };
  const p = { ...THEY, ...(partner.pronouns || {}) };
  const subjectIsYou = you === 'subject' || you === 'self';
  const s = subjectIsYou ? 'your' : p.pp;
  const o = subjectIsYou ? p.pp : 'your';
  const obj = subjectIsYou ? p.po : 'you';
  const oq = subjectIsYou ? ((partner.pronouns && partner.pronouns.pq) || INDEPENDENT[p.pp] || p.pp) : 'yours';
  const who = subjectIsYou ? 'You' : (partner.name || 'They');
  const v = (verb) => conjugate(verb, !subjectIsYou);
  const own = OWN_WORDS[act.name];
  if (own) return `${who} ${own({ v, s, o, obj, oq })}.`;

  const subjectParts = act['subject parts'] || [];
  const objectParts = act['object parts'] || [];
  const subjObj = subjectIsYou ? 'you' : p.po;
  const label = labelOf(act, you, youGender, partner.gender).replace(/front hole/gi, 'front-hole');
  const [verb, ...rest] = label.split(/\s+/).map((w) => w.toLowerCase().replace('front-hole', 'front hole'));
  const out = [v(verb)];
  let objectNamed = false;
  let hasToy = false;
  let prev = verb;
  for (const w of rest) {
    const parts = PART_OF[w];
    if (parts) {
      const inObject = parts.find((x) => objectParts.includes(x));
      const inSubject = parts.find((x) => subjectParts.includes(x));
      const owner = inObject ? 'object' : inSubject ? 'subject' : null;
      if (owner === 'object') objectNamed = true;
      const poss = owner === 'object' ? o : owner === 'subject' ? s : null;
      if (poss && ADJECTIVES.has(out[out.length - 1])) out.splice(out.length - 1, 0, poss);
      else if (poss) out.push(poss);
      out.push(w);
    } else if (TOYS.has(w)) {
      hasToy = true;
      if (prev === 'with') out.push(w === 'beads' ? 'some' : 'a', w);
      else if (holds(objectParts)) { out.push(o, w); objectNamed = true; }
      // worn by the subject (a strap-on at the crotch) is theirs; held in a hand, it is just the toy
      else if (holds(subjectParts) && subjectParts.includes('crotch')) out.push(s, w);
      else out.push('the', w);
    } else {
      out.push(w);
    }
    prev = w;
  }
  const last = rest[rest.length - 1];
  const phrase = objectParts.length ? `${o} ${WORD_FOR[objectParts[0]] || objectParts[0]}` : obj;
  // a label that ends in the air, finished
  if (last === 'in') out[out.length - 1] = `inside ${subjObj}`;
  if (!objectNamed) {
    if (last === 'back') out.push(`against ${obj}`);
    else if (last === 'out' || last === 'free') out.push(`of ${phrase}`);
    else if (last === 'off') out.push(phrase);
    else if (last === 'in') { /* inside the subject: nothing more to name */ }
    else if (hasToy && ORIFICE.has(objectParts[0])) out.push(`in ${phrase}`);
    else if (rest.length && /ing$/.test(rest[0])) out.push(phrase);
    else if (!holds(objectParts) || !hasToy) out.splice(1, 0, phrase);
  }
  return `${who} ${out.join(' ')}.`;
}

// A position taken: who moved whom into it, and where the player is in it.
const PREPOSITIONS = /^(against|on|in|under|over|behind|between|across|at)\b/;
export function positionWords(pos, { mover = 'you', role = 'top', partner = {} } = {}) {
  const label = String(pos.label || pos.name || '').toLowerCase();
  const where = role === 'top' ? pos['label top'] : pos['label bottom'];
  if (/^wait/.test(label)) return mover === 'you' ? 'You wait.' : `${partner.name || 'They'} makes you wait.`;
  const into = PREPOSITIONS.test(label) ? label : `into ${label}`;
  // where the player is, unless the position's own name already says it
  const said = where && !label.includes(String(where).toLowerCase()) ? where : '';
  if (mover === 'you') return `You move ${into}${said ? `, ${said}` : ''}.`;
  return `${partner.name || 'They'} moves you ${into}${said ? `, you ${said}` : ''}.`;
}

const esc = (x) => String(x == null ? '' : x);
// Written words are shown as text, never read as markup (world/talk.mjs).
const said = (x) => `<nowiki>${esc(x).replace(/<\/?nowiki>/gi, '')}</nowiki>`;
const safe = (fn, fallback) => { try { const v = fn(); return v == null ? fallback : v; } catch { return fallback; } };

// Where it lands: the engine's cum locations (its positions' and its own
// inside ones).
const LANDS = {
  vagina: ['inside', 'pussy'], anus: ['inside', 'ass'], mouth: ['in', 'mouth'], face: ['on', 'face'],
  chest: ['on', 'chest'], breasts: ['on', 'tits'], stomach: ['on', 'stomach'], thigh: ['on', 'thighs'],
  butt: ['on', 'ass'], back: ['on', 'back'], crotch: ['on', 'crotch'], hand: ['in', 'hand'], foot: ['on', 'feet'], hair: ['in', 'hair'],
};

// Someone coming: the player ('you') or the partner, and where, on the other.
export function orgasmWords({ doer = 'you', partner = {}, location } = {}) {
  const p = { ...THEY, ...(partner.pronouns || {}) };
  const who = doer === 'you' ? 'You' : (partner.name || 'They');
  const verb = conjugate('come', doer !== 'you');
  if (!location) return `${who} ${verb}!`;
  const [prep, word] = LANDS[location] || ['on', location];
  return `${who} ${verb} ${prep} ${doer === 'you' ? p.pp : 'your'} ${word}!`;
}

// A garment changed: the engine's clothing act ({action, clothing}), by
// ('you'/'partner') and of whom.
export function clothingWords(change, { subject = 'you', object = 'you', partner = {} } = {}) {
  const p = { ...THEY, ...(partner.pronouns || {}) };
  const who = subject === 'you' ? 'You' : (partner.name || 'They');
  const v = (verb) => conjugate(verb, subject !== 'you');
  const whose = object === 'you' ? 'your' : p.pp;
  const clothing = esc(change && change.clothing).trim() || 'clothes';
  const action = String((change && change.action) || 'remove').trim();
  if (action === 'remove') return `${who} ${v('take')} off ${whose} ${clothing}.`;
  if (action === 'remove all') return subject === object ? `${who} ${v('strip')} bare.` : `${who} ${v('strip')} ${object === 'you' ? 'you' : p.po} bare.`;
  if (action === 'fix') return `${who} ${v('put')} ${whose} ${clothing} right.`;
  const [verb, ...rest] = action.split(/\s+/);
  return `${who} ${[v(verb.toLowerCase()), ...rest].join(' ')} ${whose} ${clothing}.`;
}

const BONDAGE = {
  'bind to': (d, t, tp, f) => `${d} ties ${t} to ${f ? `the ${f}` : 'the bed'}.`,
  'bind hands': (d, t, tp) => `${d} ties ${tp} hands.`,
  gag: (d, t) => `${d} gags ${t}.`,
  'release bind to': (d, t) => `${d} unties ${t}.`,
  'release bind hands': (d, t, tp) => `${d} frees ${tp} hands.`,
  'release gag': (d, t, tp) => `${d} takes out ${tp} gag.`,
};

// What the round did, as the engine recorded it, in order: garments, every
// act it marked to be told, what was done to bodies (bonds, holding back, a
// condom breaking), who pissed, and who came. words(actName, 'you'|'them'|
// 'self', partner) gives the world's own line for an act, or nothing.
export function narrateActs({ encounter, pc, acts = {}, words = null, youGender = '' } = {}) {
  const enc = encounter;
  if (!enc || typeof enc.pobj !== 'function') return '';
  const isPc = (x) => !!x && (x.is_pc || x.person === 'PC' || (!!pc && typeof pc.equals === 'function' && pc.equals(x)));
  const same = (a, b) => !!a && !!b && (a === b || (typeof a.equals === 'function' && a.equals(b)));
  const info = (x) => (x ? { name: safe(() => x.firstname(), x.name), pronouns: { po: x.po, pp: x.pp, pq: x.pq }, gender: x.gender || '' } : {});
  const out = [];
  const line = (kind, text) => { if (text) out.push(`<div class="ob-narrate ob-narrate-${kind}">${said(text)}</div>`); };
  const partners = safe(() => enc.partners(true), []) || [];
  for (const partner of partners) {
    const solo = isPc(partner);
    for (const ch of enc.clothing_changes || []) {
      const sub = safe(() => enc.pobj(ch.subject), null);
      const obj = safe(() => enc.pobj(ch.object), null);
      if (!sub || !obj) continue;
      if (solo ? !(isPc(sub) && isPc(obj)) : !(same(sub, partner) || same(obj, partner))) continue;
      line('clothes', clothingWords(ch, { subject: isPc(sub) ? 'you' : 'partner', object: isPc(obj) ? 'you' : 'partner', partner: info(solo ? null : partner) }));
    }
    for (const a of enc.acts || []) {
      if (!a || !a.narrate) continue;
      const sub = safe(() => enc.pobj(a.subject), null);
      const obj = safe(() => enc.pobj(a.object), null);
      const def = acts[a.name];
      if (!def || !sub || !obj) continue;
      let you = null;
      if (solo) { if (isPc(sub) && isPc(obj)) you = 'self'; } else if (isPc(sub) && same(obj, partner)) you = 'subject';
      else if (same(sub, partner) && isPc(obj)) you = 'object';
      if (!you) continue;
      const who = info(solo ? null : partner);
      const dir = you === 'subject' ? 'you' : you === 'object' ? 'them' : 'self';
      const own = typeof words === 'function' ? safe(() => words(a.name, dir, who), null) : null;
      line('act', own ? fillWords(own, { name: who.name || 'them', pronouns: who.pronouns }) : actWords({ name: a.name, ...def }, { you, partner: who, youGender }));
    }
  }
  // what happened to bodies, the engine's own flags
  for (const x of [pc, ...partners.filter((q) => !isPc(q))].filter(Boolean)) {
    const who = isPc(x) ? 'You' : info(x).name;
    const b = x.narrate_bondage;
    if (b && BONDAGE[b.act]) {
      const doer = safe(() => enc.pobj(b.doer), null);
      const d = doer && !isPc(doer) ? info(doer).name : 'You';
      line('bonds', BONDAGE[b.act](d, isPc(x) ? 'you' : info(x).pronouns.po, isPc(x) ? 'your' : info(x).pronouns.pp, b.furniture));
    }
    const r = x.narrate_resisted_orgasm;
    if (r) line('hold', r.success ? `${who} ${isPc(x) ? 'hold' : 'holds'} back from coming.` : `${who} ${isPc(x) ? 'try' : 'tries'} to hold back, and can't.`);
    if (x.condom_broke) line('condom', 'The condom breaks!');
  }
  for (const pe of enc.peed || []) {
    const doer = safe(() => enc.pobj(pe.subject), null);
    const target = pe.object ? safe(() => enc.pobj(pe.object), null) : null;
    if (!doer) continue;
    const who = isPc(doer) ? 'You' : info(doer).name;
    line('piss', target ? `${who} ${isPc(doer) ? 'piss' : 'pisses'} on ${isPc(target) ? 'you' : info(target).pronouns.po}.` : `${who} ${isPc(doer) ? 'piss' : 'pisses'}.`);
  }
  for (const o of enc.orgasms || []) {
    const doer = safe(() => enc.pobj(o.subject), null);
    const target = o.object ? safe(() => enc.pobj(o.object), null) : null;
    if (!doer) continue;
    line('cum', orgasmWords({ doer: isPc(doer) ? 'you' : 'partner', partner: info(isPc(doer) ? target : doer), location: target ? o.location : undefined }));
  }
  return out.join('');
}

// A position taken or refused this round.
export function narratePositions({ encounter, pc, positions = {} } = {}) {
  const enc = encounter;
  if (!enc || !pc) return '';
  const out = [];
  const info = (x) => (x ? { name: safe(() => x.firstname(), x.name), pronouns: { po: x.po, pp: x.pp, pq: x.pq } } : {});
  const labelOfPos = (name) => String((positions[name] && positions[name].label) || name || '').toLowerCase();
  const ap = pc.attempted_position;
  if (ap && !ap.seen && ap.resisted) {
    const name = info(ap.target).name || 'them';
    out.push(ap.cancelled ? `You try to move ${name} into ${labelOfPos(ap.position)}, and ${name} will not.`
      : `You try to move ${name} into ${labelOfPos(ap.position)}; ${name} resists, then gives way.`);
  }
  for (const partner of safe(() => enc.partners(), []) || []) {
    if (!partner || partner.is_pc || !partner.position_new) continue;
    const posName = safe(() => pc.position_with(partner), null);
    if (!posName) continue;
    out.push(positionWords({ name: posName, ...(positions[posName] || { label: posName }) },
      { mover: pc.position_initiator ? 'you' : 'partner', role: safe(() => pc.role_with(partner), 'top'), partner: info(partner) }));
  }
  return out.map((l) => `<div class="ob-narrate ob-narrate-position">${said(l)}</div>`).join('');
}

// The engine side, installed at boot: what Obscura's EncounterActs and
// EncounterPositions print before running the engine's own copies silently.
// deps.words(actName, direction, partner) -> the world's line, or nothing.
export function installNarration(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const setup = SC && SC.setup;
  if (!setup) return false;
  const V = () => (SC.State && SC.State.variables) || {};
  setup.ob_narrate_acts = () => safe(() => narrateActs({ encounter: V().encounter, pc: V().pc, acts: setup.ob_sexacts || {},
    words: typeof deps.words === 'function' ? deps.words : null, youGender: V().pcgender || '' }), '');
  setup.ob_narrate_positions = () => safe(() => narratePositions({ encounter: V().encounter, pc: V().pc, positions: setup.ob_sexpositions || {} }), '');
  return true;
}
