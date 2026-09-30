// world/needs.mjs — what an empty need does, and no move into nothing.
//
// The engine's navigation override (its nav_override.js) sends every move,
// once a need is empty, to BladderFailure, RestFailure, FoodFailure or
// IntoxFailure - the original's scenes, none of which ship - and can send a
// player to a dozen others that do not ship either (PendingBirths, Dream,
// KinkConfirm, EndSneak, WeeklyDebtPayment, the first-time scenes). Before
// every world's places could fill a need, a day of play ended in a missing
// passage. The override is wrapped: what it returns is used only when that
// passage exists. An empty need becomes Obscura's own scene, told in words
// that fit any world; any other redirect into nothing is dropped, and the
// move goes where it was going.

export const FAILURE_PASSAGE = 'ObscuraNeedFailure';
export const FAILURE_KEY = 'obscuraNeedFailure';
// The engine's empty-need scenes, and the need each one is about.
export const FAILURES = { BladderFailure: 'Bladder', RestFailure: 'Rest', FoodFailure: 'Food', IntoxFailure: 'Intox' };
const GUARDED = '__obscuraGuarded';

// What the wrapped override returns: the engine's redirect when it is a real
// passage, Obscura's own scene for an empty need, else nothing - the move
// goes on to where it was going.
export function guardRedirect(target, exists) {
  if (!target) return target;
  if (exists(target)) return target;
  if (FAILURES[target]) return FAILURE_PASSAGE;
  return false;
}

const TELL = {
  Rest: 'You cannot keep your eyes open any longer. You sleep where you are, and wake hours later, stiff and cold.',
  Bladder: 'You cannot hold it any longer. It is over before you can find anywhere to go, and anyone nearby knows it.',
  Food: 'Your head swims with hunger. You eat the first thing you can find, and it is a while before the world stops tilting.',
  Intox: 'The ground comes up to meet you. You wake hours later with a pounding head and no memory of lying down.',
};

// An empty need's effects, through the engine's own functions: six hours'
// sleep where you stand at half a bed's rate, an accident, whatever food is
// nearest, or passing out. Returns what to tell the player, with the
// engine's own word if it woke them early.
export function applyFailure(setup, V, need) {
  const N = setup.ob_needs;
  const T = setup.ob_time;
  if (need === 'Rest') {
    N.sleep(360, 62);
    N.decrease_need('Composure', 150);
  } else if (need === 'Bladder') {
    N.increase_need('Bladder', 1000);
    N.decrease_need('Hygiene', 600);
    N.decrease_need('Composure', 250);
  } else if (need === 'Food') {
    N.increase_need('Food', 250);
    N.decrease_need('Composure', 150);
    T.advance_time(30);
  } else if (need === 'Intox') {
    N.sleep(240, 40);
  }
  const woke = V && V.wakemsg ? ` ${V.wakemsg}` : '';
  if (V && V.wakemsg !== undefined) delete V.wakemsg;
  return `${TELL[need] || ''}${woke}`;
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function failureScreenHtml({ need = '', message = '' } = {}) {
  const kind = String(need).toLowerCase().replace(/[^a-z]/g, '');
  // no newlines: printed with <<=, each one would be a line break on screen
  return `<div class="ob-need-failure ob-need-failure-${kind}"><p>${esc(message)}</p>`
    + '<div class="ob-hub-actions"><<link "Carry on">><<run setup.ob_need_carry_on()>><</link>></div></div>';
}

// The engine-facing half, installed at boot after the engine's own scripts
// have set their override.
export function installNeeds(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  if (!SC || !SC.Config || !SC.Config.navigation || !SC.setup || !SC.State) return false;
  const setup = SC.setup;
  const V = () => SC.State.variables;
  const exists = (name) => { try { return !!SC.Story.has(name); } catch { return false; } };
  const nav = SC.Config.navigation;
  const original = nav.override;
  if (!(original && original[GUARDED])) {
    const dropped = new Set();
    const guarded = function guardedOverride(dest) {
      let target;
      try { target = typeof original === 'function' ? original.call(this, dest) : undefined; } catch { target = undefined; }
      const out = guardRedirect(target, exists);
      if (out === FAILURE_PASSAGE) {
        const need = FAILURES[target];
        let message = TELL[need] || '';
        // the effects happen here, once a navigation; the scene only shows them
        try { message = applyFailure(setup, V(), need); } catch { /* the scene still tells it */ }
        V()[FAILURE_KEY] = { need, message, dest: V().attemptednavigation || dest };
      } else if (target && out === false && !dropped.has(target)) {
        dropped.add(target);
        try { console.warn(`Obscura: the engine sent a move to ${target}, which does not ship; the move goes on.`); } catch { /* no console */ }
      }
      return out;
    };
    guarded[GUARDED] = true;
    nav.override = guarded;
  }
  setup.ob_need_failure_screen = () => failureScreenHtml(V()[FAILURE_KEY] || {});
  setup.ob_need_carry_on = () => {
    const f = V()[FAILURE_KEY] || {};
    delete V()[FAILURE_KEY];
    const to = f.dest && f.dest !== FAILURE_PASSAGE && exists(f.dest) ? f.dest : 'ObscuraHub';
    SC.Engine.play(to);
  };
  return true;
}
