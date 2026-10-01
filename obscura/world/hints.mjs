// world/hints.mjs — the hints, in Obscura's words (v41).
//
// The engine's HINTS button opens its StoryHints: the original's campus
// storylines and their walkthroughs, none of which an Obscura world has.
// Obscura's own StoryHints (game/passages.json) prints these instead: how its
// world works, a topic at a time, and first the need that most wants seeing to
// right now. It keeps the one thing the engine's did for the screen: it marks
// the hints seen, so the button stops glowing.

// Where each of the engine's needs is met, in an Obscura world.
export const NEED_HINTS = {
  Rest: 'sleep, at home',
  Food: 'eat, wherever food is served, or from what you have bought',
  Bladder: 'find a toilet',
  Hygiene: 'wash, at home or wherever your world bathes',
  Relaxation: 'rest somewhere easy, or do something you enjoy',
  Attention: 'spend time with people: talk, text, go out',
  Composure: 'look after the rest, and it follows',
  Release: 'come, with someone or by yourself',
};

export const TOPICS = [
  ['Staying alive', 'Your needs are the bars in the left panel. Let one run dry and it costs you: you pass out, wet yourself, go hungry. Each one is met somewhere in your world, and the map shows where.'],
  ['Money', 'Work pays by the shift at the places that are hiring, and your Work screen shows what is open to you and when. Rent on your room comes due every week. The shops sell food, goods and clothes of their own world.'],
  ['Getting better', 'Study where your world teaches and train where it trains. What you learn shows in what you can do, and in what you are paid.'],
  ['People', 'Talk to whoever you meet. Someone who likes you, or wants you, will give you their number, and after that you can text them: a message, a flirt, a picture, a date, a night.'],
  ['Dates and nights', 'A date is set for tonight or tomorrow, somewhere your world goes out; turn up around the hour. It goes a moment at a time, and any moment can be the end of it. At the bed, take your time, and the night is yours to play out, act by act.'],
  ['Getting around', 'The map shows every place your world has. Going somewhere takes time.'],
  ['What you see', 'The content options switch off whatever you would rather not meet. Whatever stays on stays explicit.'],
];

// The need nearest empty (the engine keeps them from 0, trouble, upward).
export function lowestNeed(needs) {
  let best = null;
  for (const [name, value] of Object.entries(needs || {})) {
    if (!(name in NEED_HINTS) || typeof value !== 'number') continue;
    if (!best || value < best.value) best = { name, value };
  }
  return best;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function hintsHtml(V = {}) {
  const low = lowestNeed(V && V.pcneeds);
  const now = low ? `<p class="ob-hint-now">Right now, your ${esc(low.name.toLowerCase())} wants seeing to most: ${esc(NEED_HINTS[low.name])}.</p>` : '';
  return `<div class="ob-hints">${now}${TOPICS.map(([t, body]) => `<h3>${esc(t)}</h3><p>${esc(body)}</p>`).join('')}</div>`;
}

// setup.ob_hints_html, read by Obscura's StoryHints; the variables read at the
// moment the hints open, never held.
export function installHints({ SugarCube } = {}) {
  const setup = SugarCube && SugarCube.setup;
  if (!setup) return false;
  setup.ob_hints_html = () => hintsHtml((SugarCube.State && SugarCube.State.variables) || {});
  return true;
}
