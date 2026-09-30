// world/moments.mjs — what can happen in an hour of work.
//
// The engine's work is its richest content: one job alone is 380 scenes of
// orders, complainers, hands, flashes for money, laps, service under the
// table, underwear sold off the body, rushes. Its words cannot ship - they are
// its author's, written for its own town - but its shapes can. A moment is a
// type with choices: code owns what every choice does (tips, money,
// performance, the engine's needs and skills, a garment gone), and the world's
// writer owns every word (world/momentbank.mjs); the words below are plain
// ones that stand until the world's are written.
//
// Every moment carries the engine's own content switch where it has one
// ($kinkcontent) and comes only when the player has that switch on. The
// dubcon switch brings pressure: someone who will not take the first no, and
// the player gives in, bargains or walks - walking costs the tip, never the
// job. Past a touch the groping switch allows, a moment never makes the sexual
// choice for the player.
import { SHIFT_KEY } from './work.mjs';

// The engine's content switches (setup.kink_content), as the player sees them
// in Options.
export const SWITCHES = ['groping', 'dubcon', 'watersports', 'breeding', 'pregnancy', 'rough play', 'anal', 'feet',
  'hypno', 'slutshaming', 'bullying', 'cheating'];

const choice = (id, label, what, effects) => ({ id, label, what, effects });
const checked = (id, label, what, skill, diff, pass, fail) => ({ id, label, what, check: { skill, diff, pass, fail } });
const moment = (id, line, what, choices, extra = {}) => ({ id, line, what, choices, ...extra });

// Pressure, one a line of work: the same three answers, the price of walking
// paid in what the line pays in.
const pressure = (id, line, what, paid) => moment(id, line, what, [
  choice('give', 'Give in', 'you stop saying no and let them have what they wanted',
    { [paid]: [15, 30], arousal: 120, humiliation: 60, release: 300, raise: ['Submission', 'Disinhibition'] }),
  checked('bargain', 'Name your price', 'you name a price for it', 'Charisma', 4,
    { money: [30, 60], arousal: 90, release: 300, raise: ['Disinhibition'] },
    { humiliation: 40, composure: -30 }),
  choice('walk', 'Walk away', 'you pull free and walk away', { tipLoss: 8, perf: -2, composure: 10 }),
], { kink: 'dubcon' });

export const MOMENT_TYPES = [
  // serving: food and drink, the tables and the bar
  moment('serving.order', 'serving', 'a table waves you over to take their order', [
    checked('pro', 'Keep it professional', 'you take the order cleanly and politely', 'Charisma', 2, { perf: 6, tip: [1, 3] }, { perf: 2 }),
    checked('friendly', 'Be friendly', 'you joke and chat while you take the order', 'Charisma', 3,
      { perf: 5, tip: [2, 5], attention: 20 }, { perf: 1 }),
    checked('flirt', 'Flirt with them', 'you flirt openly while you take the order', 'Charisma', 4,
      { tip: [4, 9], arousal: 20, attention: 40 }, { tip: [0, 1], humiliation: 20 }),
  ]),
  moment('serving.complainer', 'serving', 'a customer complains loudly about their food in front of the room', [
    checked('apologise', 'Apologise', 'you apologise and try to calm them', 'Charisma', 3, { perf: 5, composure: -10 }, { perf: -4, composure: -30 }),
    choice('comp', 'Take it off the bill', 'you take the dish off their bill', { perf: -2, tip: [2, 4] }),
    checked('flirt', 'Flirt them out of it', 'you charm and touch them until they forget the food', 'Charisma', 4,
      { perf: 3, tip: [3, 6], attention: 30 }, { perf: -5, humiliation: 30 }),
    checked('firm', 'Stand firm', 'you tell them flatly the food is fine', 'Dominance', 3, { perf: 4, composure: 30 }, { perf: -6, composure: -40 }),
  ]),
  moment('serving.grope', 'serving', 'as you set their plates down, a customer puts a hand on your backside and leaves it there', [
    choice('allow', 'Let the hand stay', 'you let the hand stay and wander',
      { tip: [4, 10], arousal: 60, attention: 40, humiliation: 10, raise: ['Disinhibition'] }),
    choice('ignore', 'Ignore it', 'you pretend not to notice until the hand goes', { tip: [1, 3], composure: -40, humiliation: 30 }),
    checked('scold', 'Tell them off', 'you tell them loudly to keep their hands to themselves', 'Dominance', 3,
      { perf: 4, composure: 30 }, { composure: -30, humiliation: 20 }),
    choice('slap', 'Slap the hand away', 'you slap the hand away', { perf: -6, composure: 20, raise: ['Dominance'] }),
  ], { kink: 'groping' }),
  moment('serving.flash', 'serving', 'a table of regulars slides money to the edge of the table if you will flash them', [
    choice('eager', 'Flash them, grinning', 'you flash them eagerly and give them a long look',
      { tip: [12, 25], arousal: 60, attention: 80, raise: ['Exhibitionism', 'Disinhibition'] }),
    choice('reluctant', 'Flash them, quickly', 'you check nobody else is looking and flash them for a second',
      { tip: [8, 15], arousal: 20, humiliation: 60, raise: ['Exhibitionism'] }),
    choice('refuse', 'Keep your clothes on', 'you tell them to keep their money', { composure: 10 }),
  ], { wear: 'shirt' }),
  moment('serving.lap', 'serving', 'a regular pats their lap and asks you to sit with them a while', [
    choice('grind', 'Sit and let them grind', 'you sit in their lap and let them grind against you',
      { tip: [8, 16], arousal: 120, attention: 60, perf: -2, raise: ['Disinhibition', 'Submission'] }),
    checked('tease', 'Tease, then slip away', 'you perch on their knee just long enough, then slip away', 'Charisma', 4,
      { tip: [5, 10], arousal: 30 }, { tip: [0, 2], humiliation: 20 }),
    choice('refuse', 'Tell them you are working', 'you tell them you are working', {}),
  ]),
  moment('serving.under', 'serving', 'a customer presses money into your hand and nods at the space under the table', [
    choice('go', 'Go under the table', 'you slip under the table and pleasure them with your mouth while the room eats around you',
      { tip: [30, 60], arousal: 150, humiliation: 40, attention: 80, raise: ['Oral', 'Sexual Knowledge', 'Disinhibition'] }),
    choice('refuse', 'Hand the money back', 'you hand the money back', { composure: 10 }),
  ]),
  moment('serving.underwear', 'serving', 'a customer asks quietly how much for the underwear you have on right now', [
    choice('sell', 'Slip them off and sell them', 'you slip your underwear off in the back and sell it to them warm',
      { money: [20, 40], arousal: 40, humiliation: 40, raise: ['Exhibitionism'], sell: 'underwear' }),
    choice('refuse', 'Say they are not for sale', 'you tell them they are not for sale', {}),
  ], { wear: 'underwear' }),
  moment('serving.spill', 'serving', 'a tray tips and soaks your front through', [
    choice('dry', 'Dry off in the back', 'you dry off in the back while the rush goes on', { perf: -2, composure: -10 }),
    choice('carry', 'Carry on soaked', 'you carry on with the wet cloth clinging to you',
      { tip: [4, 10], attention: 60, humiliation: 30, raise: ['Exhibitionism'] }),
  ], { wear: 'shirt' }),
  moment('serving.bump', 'serving', 'in the narrow back a coworker squeezes past, presses up against you and does not move away', [
    choice('press', 'Press back', 'you press back against them and neither of you moves', { arousal: 90, relax: 40, raise: ['Disinhibition'] }),
    choice('more', 'Pull them into the store room', 'you pull them into the store room and have each other quickly against the shelves',
      { arousal: -200, release: 400, relax: 100, perf: -4, raise: ['Sexual Knowledge'] }),
    choice('move', 'Slide past', 'you slide past them and get back to work', {}),
  ]),
  moment('serving.drunk', 'serving', 'a drunk bangs the table and demands another round', [
    choice('serve', 'Serve them', 'you bring them another', { tip: [2, 6], perf: -3 }),
    checked('cut', 'Cut them off', 'you cut them off', 'Dominance', 3, { perf: 4 }, { composure: -30 }),
  ]),
  pressure('serving.pushy', 'serving', 'a regular will not take your first no, keeps a hand on your wrist and wants more than a drink', 'tip'),
  moment('serving.rush', 'serving', 'every table wants something at once', [
    checked('hustle', 'Keep up with all of it', 'you run the whole floor at once', 'Physical', 2, { perf: 8, rest: -30 }, { perf: 2, composure: -20 }),
    choice('steady', 'Take it one table at a time', 'you take it one table at a time', { perf: 3 }),
  ]),

  // shopwork: the counter and the floor
  moment('shop.browser', 'shopwork', 'a customer lingers, turning things over, unsure', [
    checked('help', 'Help them choose', 'you help them choose', 'Charisma', 2, { perf: 6 }, { perf: 2 }),
    checked('upsell', 'Talk them into more', 'you talk them into buying more than they came for', 'Charisma', 4, { perf: 10 }, { perf: -2 }),
  ]),
  moment('shop.haggle', 'shopwork', 'a customer haggles hard over every coin', [
    checked('hold', 'Hold the price', 'you hold the price', 'Dominance', 3, { perf: 6 }, { perf: -3 }),
    choice('give', 'Give way', 'you give way on the price', { perf: -2, relax: 10 }),
  ]),
  moment('shop.fitting', 'shopwork', 'a customer, half-dressed in the fitting corner, calls you over for your opinion', [
    choice('look', 'Look them over', 'you take a long look at them before you answer', { arousal: 50, raise: ['Voyeurism'] }),
    choice('help', 'Help them dress', 'you help them dress, your hands everywhere they need to be', { arousal: 80, perf: 3, raise: ['Disinhibition'] }),
    choice('leave', 'Step out', 'you tell them it looks fine and step out', {}),
  ]),
  moment('shop.offer', 'shopwork', 'at closing the last customer lingers and offers you money for sex', [
    choice('accept', 'Lock the door', 'you lock the door and have sex with them over the counter for the money',
      { money: [30, 60], arousal: 120, release: 300, raise: ['Sexual Knowledge', 'Disinhibition'] }),
    choice('refuse', 'Show them out', 'you turn the sign and show them out', {}),
  ]),
  pressure('shop.pushy', 'shopwork', 'a customer will not take your no and keeps pushing, closer each time', 'money'),
  moment('shop.quiet', 'shopwork', 'a quiet hour with nobody in', [
    choice('tidy', 'Tidy the shelves', 'you tidy the shelves', { perf: 4 }),
    choice('idle', 'Lean on the counter', 'you lean on the counter and let the hour pass', { relax: 20 }),
  ]),

  // service: rooms, baths and the sick
  moment('service.walkin', 'service', 'you open a guest\'s door with fresh linen and find two of them in bed, busy with each other', [
    choice('watch', 'Watch a while', 'you stand in the doorway and watch longer than you should', { arousal: 80, raise: ['Voyeurism'] }),
    choice('leave', 'Back out', 'you back out quietly', { humiliation: 10 }),
  ]),
  moment('service.guest', 'service', 'a guest watches you make the bed, then offers money for more than the sheets', [
    choice('accept', 'Take the money', 'you take the money and climb into the bed you just made with them',
      { money: [30, 60], arousal: 120, release: 300, raise: ['Sexual Knowledge'] }),
    choice('refuse', 'Finish the bed and go', 'you finish the bed and leave', {}),
  ]),
  moment('service.bather', 'service', 'a bather asks you to wash their back, and then lower', [
    choice('wash', 'Wash them all over', 'you wash every part of them, slowly', { tip: [6, 14], arousal: 90, raise: ['Disinhibition'] }),
    choice('back', 'Keep to the back', 'you scrub their back and nothing else', { tip: [1, 3] }),
    choice('leave', 'Leave them to it', 'you hand them the cloth and go', {}),
  ]),
  pressure('service.pushy', 'service', 'a guest blocks the door and keeps pushing, sure they will get their way', 'money'),
  moment('service.quiet', 'service', 'an ordinary hour of rooms and linen', [
    choice('hard', 'Work hard', 'you work hard', { perf: 6, rest: -30 }),
    choice('easy', 'Take it easy', 'you take it easy', { perf: 2 }),
  ]),

  // performing: the stage, the floor and the patrons
  moment('perform.tuck', 'performing', 'a patron reaches up and tucks money into what you are wearing, fingers lingering', [
    choice('let', 'Lean into it', 'you lean into their hand and let their fingers wander', { tip: [6, 14], arousal: 40, attention: 60, raise: ['Exhibitionism'] }),
    choice('refuse', 'Step back', 'you step back out of reach', {}),
  ]),
  moment('perform.private', 'performing', 'a patron wants a private dance somewhere quieter', [
    choice('dance', 'Dance for them alone', 'you dance for them alone, close enough to touch and closer',
      { tip: [15, 30], arousal: 90, raise: ['Dancing', 'Disinhibition'] }),
    choice('refuse', 'Say no', 'you tell them no private dances tonight', {}),
  ]),
  pressure('perform.egged', 'performing', 'a table eggs you on to take off more and go further, louder each time', 'tip'),
  moment('perform.heckler', 'performing', 'someone at the back heckles every move you make', [
    checked('win', 'Win them over', 'you play to the heckler', 'Charisma', 4, { tip: [4, 8], perf: 5 }, { humiliation: 40, perf: -3 }),
    choice('ignore', 'Ignore them', 'you ignore them and finish the set', { composure: -10 }),
  ]),
  moment('perform.set', 'performing', 'an ordinary set in a half-full room', [
    checked('all', 'Give it everything', 'you give the set everything you have', 'Dancing', 3, { tip: [5, 10], perf: 8 }, { perf: 2, rest: -40 }),
    choice('coast', 'Coast through', 'you coast through the set', { perf: 2 }),
  ]),
];

const BY_ID = new Map(MOMENT_TYPES.map((t) => [t.id, t]));
export const momentById = (id) => BY_ID.get(id) || null;

// A choice with a check has two outcomes, its pass and its fail.
export const outcomeKeys = (type) => (type ? type.choices.flatMap((c) => (c.check ? [`${c.id}|pass`, `${c.id}|fail`] : [c.id])) : []);

const bargainWords = {
  'bargain|pass': 'You name your price. They pay it without blinking, and get exactly what they paid for.',
  'bargain|fail': 'You try to name a price. They laugh at it, and you feel very small.',
};

// Plain words, second person, for any world: they stand until the world's are
// written.
export const BUILT_IN_MOMENTS = {
  'serving.order': { setup: 'A table by the window waves you over, ready to order.', outcomes: {
    'pro|pass': 'You take the order cleanly and get every detail right. They notice.',
    'pro|fail': 'You mix up two of the orders. They let it go, barely.',
    'friendly|pass': 'You trade jokes with them while you write. They are still smiling when the food comes.',
    'friendly|fail': 'Your joke lands flat. They just want their food.',
    'flirt|pass': 'You lean in close while you take the order. By the end they are watching you more than the menu, and they tip like it.',
    'flirt|fail': 'You try a line on them. They look at you like you have spilled something on yourself.',
  } },
  'serving.complainer': { setup: 'A customer shoves their plate away and complains loud enough for the whole room to hear.', outcomes: {
    'apologise|pass': 'You apologise, and mean it enough that they calm down.',
    'apologise|fail': 'You apologise. It only makes them louder.',
    comp: 'You take it off the bill. They grumble, but leave a little on the table.',
    'flirt|pass': 'You smile, touch their arm and promise to make it up to them. By the end they have forgotten what was wrong.',
    'flirt|fail': 'You try to charm them out of it. They are not having it, and now everyone is looking.',
    'firm|pass': 'You tell them flatly the food is fine. They back down.',
    'firm|fail': 'You stand your ground. They go over your head, and you hear about it.',
  } },
  'serving.grope': { setup: 'As you set their plates down, a customer\'s hand settles on your backside and stays there.', outcomes: {
    allow: 'You let it stay. The hand squeezes, slow and unhurried, and wanders lower before they let you go. They tip well.',
    ignore: 'You pretend not to notice until they take the hand back. Your face burns for the rest of the hour.',
    'scold|pass': 'You tell them to keep their hands to themselves, loud enough to carry. They do.',
    'scold|fail': 'You tell them off. They laugh, and the table laughs with them.',
    slap: 'You slap the hand away. The table goes quiet, and the tip goes with it.',
  } },
  'serving.flash': { setup: 'A table of regulars slide money to the edge of the table and grin: all you have to do is give them a flash.', outcomes: {
    eager: 'You grin back, pull your top up and give them a good long look. They cheer, and the money is yours.',
    reluctant: 'You check nobody else is watching, flash them for a second and yank your top back down. They pay up, laughing.',
    refuse: 'You tell them to keep their money. They groan, but they drop it.',
  } },
  'serving.lap': { setup: 'A regular pats their lap and asks you to sit with them a while.', outcomes: {
    grind: 'You settle onto their lap. Their hands find your hips and they grind up against you, slow, until you are both breathing hard. They tip like they mean it.',
    'tease|pass': 'You perch on their knee just long enough to make them want more, then slip away with a wink. The tip follows you.',
    'tease|fail': 'You try to tease them and slip away. They just look annoyed.',
    refuse: 'You tell them you are working. They shrug.',
  } },
  'serving.under': { setup: 'A customer leans close, presses a fold of money into your hand and nods at the space under the table.', outcomes: {
    go: 'You check the room, slip under the tablecloth and take them in your mouth while they try to keep a straight face above. The money is generous.',
    refuse: 'You hand the money back. They shrug it off.',
  } },
  'serving.underwear': { setup: 'A customer asks, quietly, how much for the underwear you have on right now.', outcomes: {
    sell: 'You name a price, slip into the back and come out with them balled in your fist, still warm. You feel the draught for the rest of the shift.',
    refuse: 'You tell them they are not for sale.',
  } },
  'serving.spill': { setup: 'A tray tips and soaks your front through.', outcomes: {
    dry: 'You duck into the back and dry off as best you can. The rush goes on without you.',
    carry: 'You carry on soaked through, the wet cloth clinging to everything. Nobody is looking at the food.',
  } },
  'serving.bump': { setup: 'In the narrow back, a coworker squeezes past, presses up against you and does not move away.', outcomes: {
    press: 'You press back. For a long moment neither of you moves, and then the orders pile up.',
    more: 'You pull them into the store room and shut the door. It is quick and rough and good, and you both come out straightening your clothes.',
    move: 'You slide past them and get back to work.',
  } },
  'serving.drunk': { setup: 'A drunk bangs the table and demands another round.', outcomes: {
    serve: 'You bring it. They get louder, and so does the talk about you in the back.',
    'cut|pass': 'You cut them off, firm and final. They go quietly.',
    'cut|fail': 'You cut them off. They make a scene about it.',
  } },
  'serving.pushy': { setup: 'A regular will not take your first no. A hand on your wrist, voice low, they want more than a drink.', outcomes: {
    give: 'You stop saying no. They take you somewhere quieter and take their time with you, and pay well for it.',
    ...bargainWords,
    walk: 'You pull free and walk away. The tip goes with them.',
  } },
  'serving.rush': { setup: 'Every table wants something at once.', outcomes: {
    'hustle|pass': 'You keep up with all of it, and the floor runs smooth.',
    'hustle|fail': 'You try to do everything at once and drop half of it.',
    steady: 'You take it one table at a time. Nobody is thrilled, but nobody complains.',
  } },
  'shop.browser': { setup: 'A customer lingers, turning things over, unsure.', outcomes: {
    'help|pass': 'You help them find the right thing. They leave happy.',
    'help|fail': 'You try to help. They leave with nothing.',
    'upsell|pass': 'You talk them into twice what they came for.',
    'upsell|fail': 'You push too hard, and they walk out.',
  } },
  'shop.haggle': { setup: 'A customer haggles, hard, over every coin.', outcomes: {
    'hold|pass': 'You hold the price. They pay it.',
    'hold|fail': 'You hold the price. They walk, and the keeper notices.',
    give: 'You give way. They leave smug.',
  } },
  'shop.fitting': { setup: 'A customer, half-dressed in the fitting corner, calls you over for your opinion.', outcomes: {
    look: 'You take a good long look before you tell them. They take their time dressing again.',
    help: 'You help them into it, your hands everywhere they need to be and a few places they do not. Neither of you hurries.',
    leave: 'You tell them it looks fine and step out.',
  } },
  'shop.offer': { setup: 'At closing the last customer lingers, and offers you money to have you before you lock up.', outcomes: {
    accept: 'You lock the door. They bend you over the counter and get what they paid for, and you count the money after.',
    refuse: 'You turn the sign and show them out.',
  } },
  'shop.pushy': { setup: 'The customer will not take your no, and keeps pushing, closer each time.', outcomes: {
    give: 'You stop pushing back. They take what they came for there against the shelves, and leave money on the counter.',
    ...bargainWords,
    walk: 'You step away and call for the keeper. The sale is lost.',
  } },
  'shop.quiet': { setup: 'A quiet hour, nobody in.', outcomes: {
    tidy: 'You tidy the shelves until they are perfect.',
    idle: 'You lean on the counter and let the hour pass.',
  } },
  'service.walkin': { setup: 'You open a guest\'s door with fresh linen and find two of them in bed, very busy with each other.', outcomes: {
    watch: 'You stand in the doorway far longer than you should. Neither of them notices, or neither of them minds.',
    leave: 'You back out, red-faced, and come back later.',
  } },
  'service.guest': { setup: 'A guest watches you make the bed, then offers you money for more than the sheets.', outcomes: {
    accept: 'You take the money and climb into the bed you just made. They make the most of every coin.',
    refuse: 'You finish the bed and leave.',
  } },
  'service.bather': { setup: 'A bather asks you to wash their back, and then, lower.', outcomes: {
    wash: 'You wash them all over, slowly, and they tip like they enjoyed every minute.',
    back: 'You scrub their back and nothing else. They tip a little.',
    leave: 'You hand them the cloth and leave them to it.',
  } },
  'service.pushy': { setup: 'A guest blocks the door and keeps pushing, sure they will get their way.', outcomes: {
    give: 'You give in. They have you against the wall, and leave money on the pillow.',
    ...bargainWords,
    walk: 'You duck past them and out. There will be no tip from that room.',
  } },
  'service.quiet': { setup: 'An ordinary hour of rooms and linen.', outcomes: {
    hard: 'You work hard, and it shows.',
    easy: 'You take it easy.',
  } },
  'perform.tuck': { setup: 'A patron reaches up and tucks money into what you are wearing, fingers lingering.', outcomes: {
    let: 'You lean into their hand and let their fingers wander a while. More money follows.',
    refuse: 'You step back out of reach.',
  } },
  'perform.private': { setup: 'A patron wants a private dance, somewhere quieter.', outcomes: {
    dance: 'You dance for them alone, close enough to feel their breath, and then closer. They pay well.',
    refuse: 'You tell them there are no private dances tonight.',
  } },
  'perform.egged': { setup: 'A table eggs you on to take off more and go further, louder each time, hands out.', outcomes: {
    give: 'You give in and go further than you meant to. The table goes wild, and the money comes.',
    ...bargainWords,
    walk: 'You finish the set and walk off. The table boos, and keeps its money.',
  } },
  'perform.heckler': { setup: 'Someone at the back heckles every move you make.', outcomes: {
    'win|pass': 'You play to the heckler until the room is laughing with you.',
    'win|fail': 'You try to win them over. The room laughs, at you.',
    ignore: 'You ignore them and finish the set.',
  } },
  'perform.set': { setup: 'An ordinary set, the room half full.', outcomes: {
    'all|pass': 'You give it everything, and the room comes alive.',
    'all|fail': 'You push too hard and end up winded.',
    coast: 'You coast through it.',
  } },
};

const pcOf = (setup, V) => (setup && typeof setup.pc === 'function' ? setup.pc() : V && V.pc) || null;

// The switches the player has on: their own, or the engine's defaults for a
// player who never opened Options.
function switchesOn(setup, V) {
  if (Array.isArray(V && V.kinkcontent)) return V.kinkcontent;
  try { return setup && typeof setup.ob_default_kinkcontent === 'function' ? setup.ob_default_kinkcontent() : []; } catch { return []; }
}

const wears = (pc, what) => {
  if (!what) return true;
  const fn = what === 'shirt' ? 'wearing_shirt' : 'wearing_underwear';
  try { return !!(pc && typeof pc[fn] === 'function' && pc[fn]()); } catch { return false; }
};

export function eligibleMoments(setup, V, line) {
  const on = switchesOn(setup, V);
  const pc = pcOf(setup, V);
  return MOMENT_TYPES.filter((t) => t.line === line && (!t.kink || on.includes(t.kink)) && wears(pc, t.wear));
}

// One of them, not one of the last few; with nothing else left, any.
export function pickMoment(list, rng = Math.random, recent = []) {
  if (!list || !list.length) return null;
  const fresh = list.filter((t) => !recent.includes(t.id));
  const from = fresh.length ? fresh : list;
  return from[Math.min(from.length - 1, Math.floor(rng() * from.length))];
}

// What a choice does, through the engine's own functions; one the engine
// cannot apply is skipped and the rest still happen.
function applyEffects(setup, V, fx, rng) {
  const s = V[SHIFT_KEY];
  const n = (setup && setup.ob_needs) || {};
  const pc = pcOf(setup, V);
  const call = (obj, fn, ...args) => { try { if (obj && typeof obj[fn] === 'function') obj[fn](...args); } catch { /* skipped */ } };
  const roll = ([lo, hi]) => Math.round(lo + rng() * (hi - lo));
  let tip = 0;
  let money = 0;
  if (fx.tip) {
    tip = roll(fx.tip);
    if (s) s.tips += tip; else V.pcmoney = (Number(V.pcmoney) || 0) + tip;
  }
  if (fx.money) {
    money = roll(fx.money);
    V.pcmoney = (Number(V.pcmoney) || 0) + money;
  }
  if (fx.tipLoss && s) s.tips = Math.max(0, s.tips - fx.tipLoss);
  if (fx.perf && s) s.perf += fx.perf;
  const signed = (amt, up, down) => { if (amt > 0) up(amt); else if (amt < 0) down(-amt); };
  if (fx.arousal) signed(fx.arousal, (a) => call(n, 'gain_arousal', a), (a) => call(n, 'lose_arousal', a));
  if (fx.humiliation) signed(fx.humiliation, (a) => call(n, 'gain_humiliation', a), (a) => call(n, 'lose_humiliation', a));
  if (fx.composure) signed(fx.composure, (a) => call(n, 'gain_composure', a), (a) => call(n, 'lose_composure', a));
  if (fx.attention) call(n, 'sexual_attention', fx.attention);
  if (fx.relax) signed(fx.relax, (a) => call(n, 'increase_need', 'Relaxation', a), (a) => call(n, 'stress', a));
  if (fx.rest) signed(fx.rest, (a) => call(n, 'increase_need', 'Rest', a), (a) => call(n, 'tire', a));
  if (fx.release) call(n, 'gain_release', fx.release);
  for (const skill of fx.raise || []) call(pc, 'raise_skill', skill, -1);
  if (fx.sell === 'underwear' && pc && typeof pc.underwear_covering === 'function') {
    try {
      const item = pc.underwear_covering('crotch');
      if (item) call(pc, 'delete_clothing', item);
    } catch { /* kept */ }
  }
  return { tip, money };
}

// The player's choice: its check, if it has one (the skill raised on a pass,
// as the engine raises a skill a check passes on), and what it does.
export function applyChoice(setup, V, type, choiceId, rng = Math.random) {
  const c = type && type.choices.find((x) => x.id === choiceId);
  if (!c) return null;
  let key = c.id;
  let fx = c.effects || {};
  let passed = null;
  if (c.check) {
    const pc = pcOf(setup, V);
    try { passed = !!(pc && typeof pc.skillcheck === 'function' ? pc.skillcheck(c.check.skill, c.check.diff) : false); } catch { passed = false; }
    key = `${c.id}|${passed ? 'pass' : 'fail'}`;
    fx = passed ? c.check.pass : c.check.fail;
    if (passed && pc && typeof pc.raise_skill === 'function') { try { pc.raise_skill(c.check.skill, c.check.diff); } catch { /* skipped */ } }
  }
  const got = applyEffects(setup, V, fx, rng);
  return { key, passed, ...got };
}
