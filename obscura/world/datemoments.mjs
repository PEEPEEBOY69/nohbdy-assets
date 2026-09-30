// world/datemoments.mjs — what can happen on a date, and on a night.
//
// A date runs the way an evening does: it starts somewhere (food, a walk, a
// show, a night in), it gets closer, there is a kiss or there is not, one of
// you asks the other back or says goodnight, and if it goes on there is the
// night and the morning after it. A night someone was asked over for starts at
// the door. Each stage is a moment with choices, like work's
// (world/moments.mjs): code owns what every choice does - their feelings
// through the engine's alter_attitude, the player's needs and skills, a kiss
// and every act in bed through the engine's own record_sex_memory, so its
// milestones (a first kiss, "made them come") and its has_had_sex read it -
// and the words are written for the person (world/datebank.mjs), with the
// plain ones below until theirs land.
//
// Everything sexual is the player's to choose. Every stage past the first
// touch has a way to stop that is never a check. What happens in bed is what
// the two bodies can do (the engine's own has_part), and anything anal needs
// the engine's anal switch on. The dubcon switch brings one pressure moment -
// someone who will not take goodnight - with the same three answers as work's.
import { outcomeKeys, switchesOn } from './moments.mjs';

export const DATE_FLOW = {
  date: ['start', 'middle', 'kiss', 'back', 'night', 'after'],
  hookup: ['arrive', 'undress', 'night', 'after'],
};

const choice = (id, label, what, effects, extra = {}) => ({ id, label, what, effects, ...extra });
const checked = (id, label, what, check, pass, fail, extra = {}) => ({ id, label, what, check, pass, fail, ...extra });
const type = (id, kinds, stage, what, choices, extra = {}) => ({ id, kinds, stage, what, choices, ...extra });
const SK = { skill: 'Sexual Knowledge', diff: 2 };

export const DATE_TYPES = [
  // where it starts, by where the date is
  type('dinner', ['date'], 'start', 'you share food and drink with them and the talk begins', [
    choice('listen', 'Ask about them, and listen', 'you ask about their life and really listen', { them: [['friendship', 15], ['romance', 10]] }),
    choice('open', 'Tell them something true', 'you tell them something true about yourself', { them: [['romance', 15], ['trust', 10]] }),
    checked('flirt', 'Flirt across the table', 'you flirt with them across the table', { skill: 'Charisma', diff: 3 },
      { them: [['lust', 20], ['romance', 10]], arousal: 20 }, { them: [['friendship', -5]], humiliation: 15 }),
  ], { places: ['food', 'gathering'] }),
  type('walk', ['date'], 'start', 'you walk together with nowhere in particular to be', [
    checked('hand', 'Take their hand', 'you take their hand as you walk', { willing: 'touch' },
      { them: [['romance', 20]], arousal: 10 }, { them: [['romance', -5]], humiliation: 15 }),
    choice('talk', 'Talk as you walk', 'you talk as you walk', { them: [['friendship', 15]], relax: 20 }),
    choice('show', 'Show them a place you like', 'you show them a spot you like', { them: [['romance', 10], ['friendship', 10]] }),
  ], { places: ['outdoors'] }),
  type('show', ['date'], 'start', 'there is music, a crowd and heat, and the two of you in the middle of it', [
    checked('dance', 'Pull them up to dance', 'you pull them up to dance', { skill: 'Dancing', diff: 2 },
      { them: [['romance', 20], ['lust', 10]], arousal: 20 }, { them: [['friendship', 5]], humiliation: 20 }),
    choice('close', 'Sit close and watch', 'you sit close together and watch', { them: [['romance', 10], ['lust', 10]], arousal: 10 }),
    choice('laugh', 'Make them laugh', 'you make them laugh', { them: [['friendship', 15]] }),
  ], { places: ['entertainment'] }),
  type('nightin', ['date'], 'start', 'an evening in, just the two of you, the door shut on everything else', [
    choice('feed', 'Cook for them', 'you cook for them', { them: [['friendship', 10], ['romance', 10]] }),
    choice('drink', 'Share a drink', 'you share a drink, then another', { them: [['romance', 10]], relax: 30 }),
    checked('couch', 'Pull them onto the couch with you', 'you pull them down onto the couch with you', { willing: 'touch' },
      { them: [['lust', 20]], arousal: 20 }, { them: [['romance', -5]], humiliation: 15 }),
  ], { places: ['home'] }),

  // closer
  type('confide', ['date'], 'middle', 'they tell you something few people have heard', [
    choice('hold', 'Reach for them', 'you reach for them', { them: [['romance', 15], ['trust', 15]] }),
    choice('share', 'Tell them one of yours', 'you tell them a secret of your own', { them: [['trust', 20], ['friendship', 10]] }),
    checked('light', 'Make light of it', 'you make light of it', { skill: 'Charisma', diff: 3 },
      { them: [['friendship', 15]] }, { them: [['trust', -10]] }),
  ]),
  type('touch', ['date'], 'middle', 'their knee rests against yours and their hand finds your arm, and stays', [
    choice('lean', 'Lean into it', 'you lean into their touch', { them: [['lust', 15]], arousal: 25 }),
    choice('tease', 'Tease them about it', 'you tease them about it', { them: [['lust', 10], ['friendship', 5]], arousal: 10 }),
    choice('still', 'Keep it easy', 'you keep it easy', { them: [['friendship', 5]] }),
  ]),
  type('praise', ['date'], 'middle', 'they look at you a while, then tell you plainly what it is about you', [
    choice('take', 'Take it, and smile', 'you take the compliment and smile', { them: [['romance', 10]], composure: 10 }),
    choice('return', 'Tell them what you like about them', 'you tell them what you like about them', { them: [['romance', 15]] }),
    choice('blush', 'Wave it off', 'you wave it off', { them: [['friendship', 5]] }),
  ]),

  // a kiss
  type('firstkiss', ['date'], 'kiss', 'there is a pause, close together, when a first kiss could happen', [
    checked('kiss', 'Kiss them', 'you kiss them', { willing: 'kiss' },
      { them: [['romance', 25], ['lust', 15]], arousal: 30, kiss: true }, { them: [['romance', -5]], humiliation: 25 }),
    checked('wait', 'Let them come to you', 'you wait for them to kiss you', { willing: 'kiss' },
      { them: [['romance', 20]], arousal: 20, kiss: true }, { them: [['friendship', 5]] }),
    choice('not', 'Not tonight', 'you let the moment pass', { them: [['romance', 5]] }, { ends: true }),
  ], { firstKiss: true }),
  type('kiss', ['date'], 'kiss', 'the kiss happens the way it does now, easy and certain, and it lingers', [
    choice('deep', 'Kiss them deeply', 'you kiss them deeply', { them: [['lust', 20]], arousal: 40, kiss: true }),
    choice('soft', 'Keep it soft', 'you keep the kiss soft and slow', { them: [['romance', 15]], arousal: 15, kiss: true }),
    choice('pull', 'Pull back, smiling', 'you pull back from the kiss, smiling', { them: [['romance', 5], ['lust', 5]] }),
  ], { firstKiss: false }),

  // back, or goodnight
  type('back', ['date'], 'back', 'the evening is ending and neither of you wants it to', [
    checked('mine', 'Ask them back to your place', 'you ask them back to your place', { willing: 'sex' },
      { them: [['lust', 15]], arousal: 20 }, { them: [['romance', 5]] }, { ends: 'fail' }),
    checked('theirs', 'Ask to go back to theirs', 'you ask to go back to their place', { willing: 'sex' },
      { them: [['lust', 15]], arousal: 20 }, { them: [['romance', 5]] }, { ends: 'fail' }),
    choice('goodnight', 'Say goodnight', 'you say goodnight', { them: [['romance', 10]] }, { ends: true }),
  ]),
  type('insist', ['date'], 'back', 'you say goodnight and they will not take it: their mouth is on your neck, their hands pulling you toward the door', [
    choice('give', 'Give in', 'you stop saying goodnight and let them take you inside',
      { them: [['lust', 20]], arousal: 60, humiliation: 30, raise: ['Submission'] }),
    choice('wait', 'Make them wait', 'you push them back and tell them to wait', { them: [['lust', 20]], composure: 20 }, { ends: true }),
    choice('walk', 'Pull free and go', 'you pull free and walk away', { them: [['friendship', -20], ['romance', -10]], composure: 10 }, { ends: true }),
  ], { kink: 'dubcon' }),

  // a night: at the door, clothes
  type('door', ['hookup'], 'arrive', 'they arrive at your door, and neither of you pretends it is for anything but sex', [
    choice('pull', 'Pull them inside and kiss them', 'you pull them inside and kiss them against the door', { them: [['lust', 15]], arousal: 30, kiss: true }),
    choice('drink', 'Pour a drink first', 'you pour two drinks first', { them: [['romance', 5]], relax: 20 }),
    choice('tease', 'Make them wait for it', 'you make them wait for it, slow and teasing', { them: [['lust', 20]], arousal: 20 }),
    choice('send', 'Send them home after all', 'you tell them you have changed your mind', { them: [['lust', -15], ['friendship', -5]] }, { ends: true }),
  ]),
  type('undress', ['hookup'], 'undress', 'the clothes come off, one piece at a time or all at once', [
    choice('strip', 'Undress for them', 'you undress for them while they watch', { them: [['lust', 20]], arousal: 30, raise: ['Exhibitionism'] }),
    choice('them', 'Undress them', 'you undress them yourself', { them: [['lust', 10]], arousal: 30 }),
    choice('tear', 'Tear each other\'s clothes off', 'you tear each other\'s clothes off', { them: [['lust', 20]], arousal: 40 }),
    choice('stop', 'Stop here', 'you stop there and tell them that is all for tonight', { them: [['lust', -10]] }, { ends: true }),
  ]),

  // the night, and after
  type('bed', ['date', 'hookup'], 'night', 'you are alone together at last, and there is nothing between you', [
    checked('fuck', 'Fuck them', 'you fuck them', SK,
      { them: [['lust', 25], ['romance', 10]], youCome: true, theyCome: true }, { them: [['lust', 10]], youCome: true }, { act: 'fuck' }),
    checked('ride', 'Have them fuck you', 'they fuck you', SK,
      { them: [['lust', 25], ['romance', 10]], youCome: true, theyCome: true }, { them: [['lust', 15]], theyCome: true }, { act: 'ride' }),
    choice('mouth', 'Go down on them', 'you go down on them', { them: [['lust', 20], ['romance', 5]], arousal: 30, theyCome: true, raise: ['Sexual Knowledge'] }, { act: 'mouth' }),
    choice('receive', 'Have them go down on you', 'they go down on you', { them: [['lust', 15]], youCome: true }, { act: 'receive' }),
    checked('hands', 'Use your hands on each other', 'you use your hands on each other, yours on them and theirs on you', { skill: 'Sexual Knowledge', diff: 1 },
      { them: [['lust', 15]], youCome: true, theyCome: true }, { them: [['lust', 10]], youCome: true }, { act: 'hands' }),
    choice('hold', 'Just hold each other', 'you just hold each other, skin to skin', { them: [['romance', 20]], relax: 30 }, { ends: true }),
  ]),
  type('after', ['date', 'hookup'], 'after', 'afterwards, tangled together, breathing slowing', [
    choice('stay', 'Ask them to stay the night', 'you ask them to stay the night', { them: [['romance', 15]], relax: 20 }, { ends: true }),
    choice('talk', 'Lie there and talk', 'you lie there and talk', { them: [['friendship', 10], ['trust', 10]] }, { ends: true }),
    choice('go', 'Say goodnight', 'you say goodnight and part', { them: [['friendship', 5]] }, { ends: true }),
  ]),
];

const BY_ID = new Map(DATE_TYPES.map((t) => [t.id, t]));
export const dateTypeById = (id) => BY_ID.get(id) || null;

// The moments a stage can be, for a date or a night: the start by where it
// is (anywhere else, food and talk), a first kiss only before the first, a
// moment with a content switch only with it on.
export function eligibleDateMoments(kind, stage, ctx = {}) {
  const switches = ctx.switches || [];
  const out = DATE_TYPES.filter((t) => t.stage === stage && t.kinds.includes(kind)
    && (!t.places || t.places.includes(ctx.placeKind))
    && (t.firstKiss === undefined || t.firstKiss === !ctx.kissed)
    && (!t.kink || switches.includes(t.kink)));
  if (!out.length && stage === 'start' && kind === 'date') return [BY_ID.get('dinner')];
  return out;
}

export function pickDateMoment(list, rng = Math.random, recent = []) {
  if (!list || !list.length) return null;
  const fresh = list.filter((t) => !recent.includes(t.id));
  const from = fresh.length ? fresh : list;
  return from[Math.min(from.length - 1, Math.floor(rng() * from.length))];
}

// What the two bodies did, in the engine's own words for its sex memory; null
// where they cannot, or where it needs a switch that is off.
export function actsFor(act, ctx = {}) {
  const pc = ctx.pc || new Set();
  const them = ctx.them || new Set();
  const anal = (ctx.switches || []).includes('anal');
  switch (act) {
    case 'fuck':
      if (!pc.has('penis')) return null;
      if (them.has('vagina')) return ['pussy-fucking given'];
      return anal ? ['ass-fucking given'] : null;
    case 'ride':
      if (!them.has('penis')) return null;
      if (pc.has('vagina')) return ['pussy-fucking received'];
      return anal ? ['ass-fucking received'] : null;
    case 'mouth':
      if (them.has('penis')) return ['blowjob given'];
      return them.has('vagina') ? ['cunnilingus given'] : null;
    case 'receive':
      if (pc.has('penis')) return ['blowjob received'];
      return pc.has('vagina') ? ['cunnilingus received'] : null;
    case 'hands': {
      const out = [];
      if (them.has('penis')) out.push('handjob given'); else if (them.has('vagina')) out.push('fingerbang given');
      if (pc.has('penis')) out.push('handjob received'); else if (pc.has('vagina')) out.push('fingerbang received');
      return out.length ? out : null;
    }
    default: return [];
  }
}

export const choicesFor = (t, ctx = {}) => (t ? t.choices.filter((c) => !c.act || actsFor(c.act, ctx)) : []);

// Whether they want what is asked: to be touched, kissed, taken to bed. For
// bed, the engine's own willing_sex where it answers (talk.mjs's standing
// carries it); for a kiss, anyone already kissed or who would go to bed with
// the player; otherwise their feelings.
export function willingFor(what, s = {}, ctx = {}) {
  const romance = s.romance || 0;
  const lust = s.lust || 0;
  if (what === 'touch') return !!s.attracted || romance >= 50 || s.relationshipType === 'romantic' || !!ctx.kissed;
  if (what === 'kiss') {
    return !!ctx.kissed || s.willingSex === true || s.relationshipType === 'romantic' || (!!s.attracted && (romance >= 100 || lust >= 150));
  }
  if (typeof s.willingSex === 'boolean') return s.willingSex;
  return !!s.attracted && (lust >= 300 || s.relationship === 'fuckbuddy' || s.relationshipType === 'romantic');
}

const PARTS = ['penis', 'vagina', 'breasts'];
// The two bodies, from the engine: the player's has_part and theirs.
export function partsOf(setup, name) {
  const pc = (() => { try { return setup && typeof setup.pc === 'function' ? setup.pc() : null; } catch { return null; } })();
  const mine = (p) => { try { return !!(pc && pc.has_part(p)); } catch { return false; } };
  const theirs = (p) => { try { return !!setup.people.has_part(name, p); } catch { return false; } };
  return { pc: new Set(PARTS.filter(mine)), them: new Set(PARTS.filter(theirs)) };
}

export const RELEASE = 300;

// The engine's own sex memory; an engine without its recorder gets the same
// memory in its shape.
function remember(setup, V, name, act) {
  if (setup && typeof setup.record_sex_memory === 'function') {
    try { setup.record_sex_memory(name, act); return; } catch (err) { console.warn('Obscura: a memory could not be kept', err); }
  }
  const mem = V.sexmemory || (V.sexmemory = {});
  const m = mem[name] || (mem[name] = {});
  m[act] = (m[act] || 0) + 1;
}

function applyEffects(setup, V, name, fx, acts) {
  const n = (setup && setup.ob_needs) || {};
  const call = (obj, fn, ...args) => { try { if (obj && typeof obj[fn] === 'function') obj[fn](...args); } catch { /* skipped */ } };
  for (const [type, amount] of fx.them || []) {
    try { setup.people.alter_attitude(name, type, amount); } catch (err) { console.warn('Obscura: a feeling could not change', err); }
  }
  const signed = (amt, up, down) => { if (amt > 0) up(amt); else if (amt < 0) down(-amt); };
  if (fx.arousal) signed(fx.arousal, (a) => call(n, 'gain_arousal', a), (a) => call(n, 'lose_arousal', a));
  if (fx.humiliation) call(n, 'gain_humiliation', fx.humiliation);
  if (fx.composure) signed(fx.composure, (a) => call(n, 'gain_composure', a), (a) => call(n, 'lose_composure', a));
  if (fx.relax) call(n, 'increase_need', 'Relaxation', fx.relax);
  const pc = (() => { try { return setup && typeof setup.pc === 'function' ? setup.pc() : null; } catch { return null; } })();
  for (const skill of fx.raise || []) call(pc, 'raise_skill', skill, -1);
  if (fx.kiss) remember(setup, V, name, 'kissed');
  for (const act of acts) remember(setup, V, name, act);
  if (fx.youCome) { call(n, 'gain_release', RELEASE); remember(setup, V, name, 'orgasm received'); }
  if (fx.theyCome) remember(setup, V, name, 'orgasm given');
}

// The player's choice: its check (a skill of theirs, or the other's
// willingness), what it does, and whether the evening ends with it.
export function applyDateChoice(setup, V, d, t, choiceId, { standing = {}, ctx = {} } = {}) {
  const c = t && t.choices.find((x) => x.id === choiceId);
  if (!c || !d) return null;
  const acts = c.act ? actsFor(c.act, ctx) : [];
  if (!acts) return null;
  let key = c.id;
  let fx = c.effects || {};
  let passed = null;
  if (c.check) {
    if (c.check.willing) passed = willingFor(c.check.willing, standing, ctx);
    else {
      const pc = (() => { try { return setup.pc(); } catch { return null; } })();
      try { passed = !!(pc && typeof pc.skillcheck === 'function' && pc.skillcheck(c.check.skill, c.check.diff)); } catch { passed = false; }
      if (passed) { try { pc.raise_skill(c.check.skill, c.check.diff); } catch { /* skipped */ } }
    }
    key = `${c.id}|${passed ? 'pass' : 'fail'}`;
    fx = (passed ? c.pass : c.fail) || {};
  }
  applyEffects(setup, V, d.with, fx, acts);
  const ends = c.ends === true || (c.ends === 'fail' && passed === false) || (c.ends === 'pass' && passed === true);
  return { key, passed, ends, acts };
}

// The words built in: plain, for anyone, with the person's name and
// pronouns filled in (fillWords). The person's own come from the bank.
export const BUILT_IN_DATE_WORDS = {
  dinner: { setup: 'The food comes and so does the talk. {name} watches you over the rim of a cup, waiting to see what kind of evening this is.', outcomes: {
    listen: '{name} talks more than expected once you really listen, and looks pleased that you did.',
    open: 'You tell {po} something true, something you do not say often. {name} goes quiet, then reaches across and touches your hand.',
    'flirt|pass': 'You say something that makes {name} laugh and then look at you differently. Under the table, a foot finds yours and stays.',
    'flirt|fail': 'It comes out wrong. {name} smiles politely and changes the subject, and you eat for a while in silence.',
  } },
  walk: { setup: 'You walk with nowhere in particular to be. {name} walks close enough that your arms keep brushing.', outcomes: {
    'hand|pass': 'You take {pp} hand. {name} laces fingers through yours and does not let go.',
    'hand|fail': 'You reach for {pp} hand and {name} shifts away, not unkindly. Not yet.',
    talk: 'You talk the whole way, about everything and nothing, and the time goes without either of you noticing.',
    show: 'You show {po} a place you like. {name} stands there a long moment, then says it is perfect.',
  } },
  show: { setup: 'There is music and a crowd and heat, and the two of you in the middle of it.', outcomes: {
    'dance|pass': 'You pull {name} up and dance. {Pp} body moves against yours, and by the end neither of you is thinking about the music.',
    'dance|fail': 'You pull {name} up to dance and step on everything there is to step on. {name} laughs at you, but kindly.',
    close: 'You sit close and watch. At some point {pp} head ends up on your shoulder and stays there.',
    laugh: 'You say the right thing at the right moment and {name} laughs until the tears come.',
  } },
  nightin: { setup: 'An evening in, just the two of you, the door shut on everything else.', outcomes: {
    feed: 'You cook, and {name} eats every bite, then steals from your plate too.',
    drink: 'You share a drink, then another. The talk gets slower and warmer and closer.',
    'couch|pass': 'You pull {name} down onto the couch with you. {name} lands half on top of you and does not move off.',
    'couch|fail': 'You pull {name} toward the couch, and {name} sits, but at the other end of it.',
  } },
  confide: { setup: '{name} tells you something few people have heard, and watches your face the whole time.', outcomes: {
    hold: 'You reach for {po}. {name} leans into it and lets out a breath held a long time.',
    share: 'You tell {po} one of yours. Now you both know something, and it sits between you like a promise.',
    'light|pass': 'You find the joke in it, and {name} laughs, surprised, and looks lighter for it.',
    'light|fail': 'You make light of it. {name} closes up, and the moment is gone.',
  } },
  touch: { setup: '{Pp} knee rests against yours. A hand finds your arm, and stays.', outcomes: {
    lean: 'You lean into it. {Pp} fingers trace slow circles on your skin and your pulse picks up.',
    tease: 'You tease {po} about it. {name} grins, not the least bit sorry, and the hand slides higher.',
    still: 'You keep it easy. The hand stays where it is, warm and patient.',
  } },
  praise: { setup: '{name} looks at you a while, then tells you, plainly, what it is about you.', outcomes: {
    take: 'You take it and smile. {name} seems to like that you do not argue.',
    return: 'You tell {po} what you like about {po}, and {name} looks away, flushed and pleased.',
    blush: 'You wave it off. {name} says it anyway, twice.',
  } },
  firstkiss: { setup: 'There is a pause, close together, when a first kiss could happen.', outcomes: {
    'kiss|pass': 'You kiss {po}. {name} kisses you back, slow at first and then not slow at all.',
    'kiss|fail': 'You lean in and {name} turns so your lips land on {pp} cheek. The rest of the evening is quieter.',
    'wait|pass': 'You wait, and {name} closes the distance, kissing you softly and then again, harder.',
    'wait|fail': 'You wait. {name} smiles, squeezes your hand, and the moment passes.',
    not: 'You let the moment go. The look {name} gives you says there will be a next time.',
  } },
  kiss: { setup: 'The kiss happens the way it does now, easy and certain, and it lingers.', outcomes: {
    deep: 'You kiss {po} deeply, hands in {pp} hair, bodies pressed together until you are both breathing hard.',
    soft: 'You keep it soft and slow. {name} sighs into your mouth.',
    pull: 'You pull back, smiling. {name} chases your lips a moment before letting you go.',
  } },
  back: { setup: 'The evening is ending and neither of you wants it to.', outcomes: {
    'mine|pass': 'You ask {po} back to yours. {name} does not answer, just takes your hand and walks faster.',
    'mine|fail': 'You ask {po} back to yours. {name} kisses your cheek and says not tonight.',
    'theirs|pass': 'You ask to go back to {pp} place. {name} is already pulling you along.',
    'theirs|fail': 'You ask to go back to {pp} place. {name} hesitates, then says goodnight.',
    goodnight: 'You say goodnight. {name} holds on a moment longer than needed before letting go.',
  } },
  insist: { setup: 'You say goodnight and {name} will not take it. {Pp} mouth is on your neck, {pp} hands pulling you toward the door.', outcomes: {
    give: 'You stop saying goodnight. {name} gets you through the door with hands already under your clothes.',
    wait: 'You push {po} back, breathless, and say wait. {name} groans and lets you go, wanting you more than ever.',
    walk: 'You pull free and walk away. You can feel {name} watching you go, and it is not warm.',
  } },
  door: { setup: '{name} is at your door, and neither of you pretends it is for anything but this.', outcomes: {
    pull: 'You pull {po} inside and kiss {po} against the door, hard, before it has even shut.',
    drink: 'You pour two drinks. {name} takes one sip, puts it down, and looks at you instead.',
    tease: 'You make {po} wait, slow and teasing, until {name} is the one begging.',
    send: 'You tell {po} you have changed your mind. {name} stares a moment, then goes, not happily.',
  } },
  undress: { setup: 'The clothes come off, one piece at a time, or all at once.', outcomes: {
    strip: 'You undress for {po}, slowly, watching {name} watch you, until there is nothing left to take off.',
    them: 'You undress {po} yourself, piece by piece, kissing every bit of skin as it is bared.',
    tear: 'You tear at each other\'s clothes, buttons and all, laughing and breathless.',
    stop: 'You stop there, clothes half off, and say that is all for tonight. {name} is not pleased.',
  } },
  bed: { setup: 'You are alone together at last. Clothes come off in a hurry, and then there is nothing between you.', outcomes: {
    'fuck|pass': 'You push into {po} slowly, then harder, until {name} is gasping and coming apart under you, and you follow over the edge.',
    'fuck|fail': 'You fuck {po} hard and fast and come too soon, shuddering, while {name} holds you and laughs softly into your neck.',
    'ride|pass': '{name} fucks you slow and deep, hands on your hips, until you come shaking, and {name} follows a moment later, groaning.',
    'ride|fail': '{name} fucks you hard and comes quickly, collapsing on you, and you are left aching for more.',
    mouth: 'You go down on {po} and take your time. {name} grips the sheets, then your hair, then comes with a cry that leaves you grinning.',
    receive: '{name} goes down on you, slow and greedy, and does not stop until you come.',
    'hands|pass': 'Your hands are all over each other, stroking, teasing, until you both come, one right after the other.',
    'hands|fail': 'Your hands are all over each other. You come first, hard, and {name} is left breathless and wanting.',
    hold: 'You just hold each other. Skin against skin, and it turns out to be exactly enough.',
  } },
  after: { setup: 'Afterwards, tangled together, breathing slowing, {name} warm against you.', outcomes: {
    stay: 'You ask {po} to stay. {name} does, curled into you, and sleeps better than you expected.',
    talk: 'You lie there and talk, about nothing and everything, until the light changes.',
    go: 'You say goodnight. {name} dresses slowly, kisses you once more, and is gone.',
  } },
};

const THEY = { ps: 'they', po: 'them', pp: 'their', pr: 'themself', pq: 'theirs' };
const upper = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// {name}, and the engine's pronoun keys ({ps} {po} {pp} {pr} {pq}, capitalised
// as {Ps} {Po} {Pp} {Pr} {Pq}); they, where the engine gives nothing.
export function fillWords(text, { name = 'them', pronouns = null } = {}) {
  const p = { ...THEY, ...(pronouns || {}) };
  return String(text == null ? '' : text).replace(/\{(name|[Pp][sopqr])\}/g, (m, key) => {
    if (key === 'name') return name;
    const lower = key.toLowerCase();
    const v = p[lower] == null ? THEY[lower] : String(p[lower]);
    return key[0] === 'P' ? upper(v) : v;
  });
}

// A moment's words for this person: their own where written, else the
// built-in ones.
export const dateWords = (own, typeId) => (own && own[typeId]) || BUILT_IN_DATE_WORDS[typeId] || null;

// The context a date's moments read: the switches, whether they have kissed,
// the two bodies, where it is.
export function dateContext(setup, V, d, placeKind = null) {
  let kissed = false;
  try { kissed = !!setup.ob_relationships.had_first_kiss(d.with); } catch { kissed = !!(V.sexmemory && V.sexmemory[d.with] && V.sexmemory[d.with].kissed); }
  return { kissed, placeKind, switches: switchesOn(setup, V), ...partsOf(setup, d.with) };
}

export { outcomeKeys };
