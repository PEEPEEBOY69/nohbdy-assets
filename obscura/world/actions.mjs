// world/actions.mjs — what each place is for.
//
// v36 gave every world its own inns, privies, baths, kitchens and shops, and
// none of them offered anything to do. Each kind of place now offers what a
// place of that kind is for. Every action takes the world's time and moves
// the engine's needs and money through its own functions (setup.ob_needs,
// setup.ob_time, $pcmoney); a menu, a shop's wares and the home's stores open
// their own screen (world/shop.mjs). Study, homework, training and dancing go
// through world/study.mjs.
import { study, homework, train, dance } from './study.mjs';

export const ACTIONS_BY_KIND = {
  home: ['sleep', 'nap', 'basin', 'stores', 'study', 'homework'],
  lodging: ['rentbed', 'rest'],
  privy: ['privy'],
  bath: ['wash'],
  food: ['menu'],
  shop: ['wares'],
  learning: ['study', 'homework'],
  training: ['train'],
  healer: ['healer'],
  entertainment: ['fun', 'dance'],
  gathering: ['company'],
  outdoors: ['sit'],
};

export const ACTIONS = {
  sleep: { label: 'Sleep' },
  nap: { label: 'Nap for an hour', minutes: 60 },
  basin: { label: 'Wash at the basin', minutes: 10 },
  stores: { label: 'Eat from your stores', screen: 'stores' },
  rentbed: { label: 'Rent a bed for the night', price: 30 },
  rest: { label: 'Rest a while', minutes: 60 },
  privy: { label: 'Relieve yourself', minutes: 5 },
  wash: { label: 'Wash', minutes: 20, price: 5 },
  menu: { label: 'See what they serve', screen: 'menu' },
  wares: { label: 'See what they sell', screen: 'wares' },
  healer: { label: 'Be seen to', minutes: 30, price: 25 },
  fun: { label: 'Spend an hour here', minutes: 60, price: 12 },
  company: { label: 'Spend time among people', minutes: 60 },
  sit: { label: 'Sit a while', minutes: 30 },
  study: { label: 'Study for an hour' },
  // only with homework set (the engine's own check)
  homework: { label: 'Do homework for an hour',
    when: (V, setup) => { try { return !!(setup && setup.School && setup.School.has_homework()); } catch { return false; } } },
  train: { label: 'Train for an hour' },
  dance: { label: 'Dance for an hour' },
};

export const actionsFor = (place, V = {}, setup = null) => ((place && ACTIONS_BY_KIND[place.kind]) || [])
  .filter((id) => !ACTIONS[id].when || ACTIONS[id].when(V, setup));

// Which screen is open (world/shop.mjs): the place, and its menu, wares or the
// home's stores.
export const SCREEN_KEY = 'obscuraShop';
export const SCREEN_PASSAGE = 'ObscuraShop';

// A night's sleep runs to seven the next morning: at least an hour, at most
// ten.
export function minutesToMorning(V) {
  const now = ((Number(V && V.hour) || 0) * 60) + (Number(V && V.minute) || 0);
  let to = 7 * 60 - now;
  if (to <= 0) to += 24 * 60;
  return Math.max(60, Math.min(600, to));
}

// The home's bed sets how fast sleep restores Rest: a bed bought for the home
// (world/shop.mjs, $obscuraHome), else the plainest of the engine's beds.
export const BASE_REST_RATE = 110;
export function restRate(V) {
  const bed = V && V.obscuraHome && V.obscuraHome.bed;
  const rate = bed ? Number(bed.rest) : 0;
  return rate > 0 ? rate : BASE_REST_RATE;
}

// What hangs on the home's wall, and a seat to rest in, calm: their points an
// hour slept or rested.
function homeCalm(setup, V, minutes) {
  const home = (V && V.obscuraHome) || {};
  const relax = (Number(home.wall && home.wall.relax) || 0) + (Number(home.seat && home.seat.relax) || 0);
  if (relax > 0) setup.ob_needs.increase_need('Relaxation', Math.round(relax * (minutes / 60)));
}

export const moneyOf = (V) => Number(V && V.pcmoney) || 0;
export const priceText = (n) => `$${n}`;

// What an action does, through the engine: a line for the hub, a screen to
// open, or a refusal (what cannot be paid for costs nothing and takes no
// time).
export function doAction(setup, V, id, place = null) {
  const a = ACTIONS[id];
  if (!a) return { line: '' };
  if (a.screen) return { screen: a.screen };
  if (a.price && moneyOf(V) < a.price) return { line: `You cannot afford that (${priceText(a.price)}).`, refused: true };
  if (a.price) V.pcmoney = moneyOf(V) - a.price;
  const N = setup.ob_needs;
  const T = setup.ob_time;
  const clock = () => { try { return T.clock(); } catch { return 'last'; } };
  const woke = () => {
    const w = V.wakemsg;
    if (w !== undefined) delete V.wakemsg;
    return w ? ` ${w}` : '';
  };
  const paid = a.price ? `You pay ${priceText(a.price)}. ` : '';
  switch (id) {
    case 'sleep': {
      const minutes = minutesToMorning(V);
      N.sleep(minutes, restRate(V));
      homeCalm(setup, V, minutes);
      return { line: `You sleep, and wake at ${clock()}.${woke()}` };
    }
    case 'rentbed':
      N.sleep(minutesToMorning(V), 120);
      return { line: `${paid}You sleep in a rented bed, and wake at ${clock()}.${woke()}` };
    case 'nap':
      N.sleep(60, restRate(V));
      homeCalm(setup, V, 60);
      return { line: `You nap for an hour.${woke()}` };
    case 'rest':
      N.sleep(60, 90);
      return { line: `You rest for an hour.${woke()}` };
    case 'basin':
      N.increase_need('Hygiene', 400);
      T.advance_time(a.minutes);
      return { line: 'You wash at the basin.' };
    case 'privy':
      N.increase_need('Bladder', 1000);
      T.advance_time(a.minutes);
      return { line: 'That is better.' };
    case 'wash':
      N.increase_need('Hygiene', 1000);
      T.advance_time(a.minutes);
      return { line: `${paid}You wash properly, and feel clean again.` };
    case 'healer':
      N.decrease_need('Pain', 1000);
      N.increase_need('Composure', 200);
      T.advance_time(a.minutes);
      return { line: `${paid}Someone sees to what ails you.` };
    case 'fun':
      N.increase_need('Relaxation', 300);
      T.advance_time(a.minutes);
      return { line: `${paid}You lose an hour to it, happily.` };
    case 'company':
      N.increase_need('Attention', 250);
      N.increase_need('Relaxation', 50);
      T.advance_time(a.minutes);
      return { line: 'You spend an hour among people, and feel less alone for it.' };
    case 'sit':
      N.increase_need('Relaxation', 100);
      T.advance_time(a.minutes);
      return { line: 'You sit a while and watch the world go by.' };
    case 'study':
      return study(setup, V, place);
    case 'homework':
      return homework(setup, V, place);
    case 'train':
      return train(setup, V);
    case 'dance':
      return dance(setup, V);
    default:
      return { line: '' };
  }
}
