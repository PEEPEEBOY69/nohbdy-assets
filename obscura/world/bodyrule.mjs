// world/bodyrule.mjs — a line written for a body nobody described.
//
// The people of a world have every kind of body, and a line written without
// knowing whose cannot name one. The writers are told (PEOPLE_BODIES), and a
// line that names one anyway is dropped (namesUnknownBody). The texts held
// their lines to it first (world/textbank.mjs); v42 holds the talk bank's
// world lines to it too (world/talkbank.mjs), so it lives here, for both.

export const PEOPLE_BODIES = '- The people here have every kind of body: they never name their own body parts or say they are wet or hard. What they want done is said plainly.';

// What the prompt asks and the real model does not always keep, kept here:
// the sender naming the other's parts ("slide your cock inside me"), and the
// people naming their own or saying they are wet or hard. The bank is answered
// by people of every body, so such a line would be wrong for most of them.
const PARTS = '(?:cock|dick|shaft|balls|pussy|cunt|clit|clitoris|slit|tits|breasts|nipples)';
const OTHERS_PARTS = new RegExp(`\\byour\\s+(?:[a-z-]+\\s+)?${PARTS}\\b`, 'i');
const OWN_PARTS = new RegExp(`\\bmy\\s+(?:[a-z-]+\\s+)?${PARTS}\\b|\\bi(?:'m|\\s+am)\\s+(?:so\\s+|already\\s+|getting\\s+|all\\s+)?(?:wet|hard|soaking|dripping)\\b`, 'i');
export const namesUnknownBody = (you, them) => OTHERS_PARTS.test(you || '') || OWN_PARTS.test(them || '');
