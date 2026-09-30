// world/rent.mjs — the week's rent on the player's room.
//
// The engine has a weekly debt: its navigation override sends a player to
// WeeklyDebtPayment on Monday evenings (day eight on, seven days since the last
// payment), and its phone calendar shows what is owed. The passage never
// shipped and the debt was never set, so neither happened. A world's home has a
// rent now, set when the world is made: paid when the player has it, and what
// they cannot pay is owed and comes due with the next.
export const RENT = 60;
export const RENT_PASSAGE = 'WeeklyDebtPayment';
const SEEN_KEY = 'obscuraRentSeen';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n) => `$${Math.round(n)}`;

export function ensureRent(V) {
  if (!V) return;
  if (!(Number(V.weeklydebt) > 0)) V.weeklydebt = RENT;
  if (V.backdebt == null) V.backdebt = 0;
}

// The rent, times the engine's own multiplier, and what is still owed.
export function rentDue(V) {
  const mult = Number(V && V.optdebtpaymentmultiplier) || 1;
  return Math.round((Number(V && V.weeklydebt) || RENT) * mult) + (Number(V && V.backdebt) || 0);
}

// Paid from what the player has; the rest owed. The day is marked settled
// either way, so the engine asks again next Monday, not on every move.
export function payRent(V) {
  const due = rentDue(V);
  const have = Math.max(0, Number(V.pcmoney) || 0);
  const paid = Math.min(have, due);
  V.pcmoney = (Number(V.pcmoney) || 0) - paid;
  V.backdebt = due - paid;
  V.lastpaymentday = V.gameday;
  return { due, paid, owed: V.backdebt };
}

export function rentScreenHtml({ due, paid, owed }) {
  let told;
  if (!owed) told = `You pay the ${money(due)}.`;
  else if (paid) told = `You pay ${money(paid)} of it. ${money(owed)} is still owed, and comes due with the next.`;
  else told = `You have nothing to pay it with. ${money(owed)} is owed, and comes due with the next.`;
  return `<div class="ob-rent"><p>${esc(`It is Monday evening, and the rent on your room is due: ${money(due)}.`)}</p>`
    + `<p>${esc(told)}</p>`
    + '<div class="ob-hub-actions"><<link "Carry on">><<run setup.ob_rent_carry_on()>><</link>></div></div>';
}

export function installRent(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  if (!SC || !SC.State || !SC.setup) return false;
  const V = () => SC.State.variables;
  // paid once a visit to the passage, however often it is drawn
  SC.setup.ob_rent_screen = () => {
    const v = V();
    const turn = SC.State.turns;
    if (!v[SEEN_KEY] || v[SEEN_KEY].turn !== turn) v[SEEN_KEY] = { turn, html: rentScreenHtml(payRent(v)) };
    return v[SEEN_KEY].html;
  };
  SC.setup.ob_rent_carry_on = () => {
    const v = V();
    delete v[SEEN_KEY];
    const dest = v.attemptednavigation;
    const has = (n) => { try { return !!(SC.Story && SC.Story.has(n)); } catch { return false; } };
    SC.Engine.play(dest && dest !== RENT_PASSAGE && has(dest) ? dest : 'ObscuraHub');
  };
  return true;
}
