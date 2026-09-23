// world/phone.mjs — the phone, for a generated world.
//
// The Phone button opens a passage called PhoneMain in a dialog. The chassis
// extraction keeps structural passages only, and every phone screen - the home
// screen, contacts, calendar, reminders, each internet app - was the original's
// authored content, so none of them shipped. The button sat greyed out in the
// main loop until the hub became a location; then it opened a dialog saying
// the passage does not exist.
//
// This is Obscura's phone, built from what the engine does ship: the calendar
// from the engine's own day-content function, contacts from the people the
// player has actually met, and the map. Each screen is a small passage in
// game/passages.json that calls one of these.
import { ICONS } from './sidebar.mjs';
import { latestLine } from './recall.mjs';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CALENDAR = 'M4.5 6.5h15v14h-15z M4.5 10.5h15 M8.5 4v5 M15.5 4v5 M8 14h2 M12 14h2 M16 14h2 M8 17h2 M12 17h2';

const icon = (d) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" `
  + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

const open = (passage) => `<<run setup.ob_phone.open("${passage}")>>`;

function header(setup) {
  let clock = ''; let date = '';
  try { clock = setup.ob_time.clock(); } catch { /* no clock yet */ }
  try { date = setup.ob_time.date(); } catch { /* no date yet */ }
  return `<div class="ob-phone-head"><span class="ob-phone-clock">${esc(clock)}</span>`
    + `<span class="ob-phone-date">${esc(date)}</span></div>`;
}

export function phoneHome(setup) {
  const apps = [
    ['Contacts', ICONS.people, open('ObscuraPhoneContacts')],
    ['Calendar', CALENDAR, open('ObscuraPhoneCalendar')],
    ['Map', ICONS.map, '<<run Dialog.close()>><<run setTimeout(function () { Dialog.setup("Maps", "maps"); '
      + 'Dialog.wiki(Story.get("Maps").processText()); Dialog.open(); }, 50)>>'],
  ];
  return `<div class="ob-phone">${header(setup)}<div class="ob-phone-apps">`
    + apps.map(([label, d, run]) => `<div class="ob-phone-app"><<link "${label}">>${run}<</link>>`
      + `<span class="ob-phone-app-ico">${icon(d)}</span></div>`).join('')
    + '</div></div>';
}

const back = () => `<div class="ob-phone-back"><<link "Back">>${open('PhoneMain')}<</link>></div>`;

// The people the player has met: favourites first, then by name.
export function knownPeople(V, max = 80) {
  const people = (V && V.people) || {};
  const favs = new Set((V && V.favoritepeople) || []);
  return Object.entries(people)
    .filter(([, p]) => p && typeof p === 'object' && p.known)
    .map(([key, p]) => ({ key, name: p.name || key, relationship: p.relationship || null, fav: favs.has(key) }))
    .sort((a, b) => (b.fav - a.fav) || a.name.localeCompare(b.name))
    .slice(0, max);
}

export function phoneContacts(setup, V) {
  const list = knownPeople(V);
  // someone the player brought keeps their own description (world/cast.mjs)
  const brought = (V && V.obscuraCast) || {};
  const first = (s) => String(s || '').split(/(?<=[.!?])\s/)[0].slice(0, 140);
  const rows = list.length
    ? list.map(p => `<div class="ob-phone-row">${p.fav ? '<b>' : ''}${esc(p.name)}${p.fav ? '</b>' : ''}`
      + `${p.relationship ? `<span class="ob-phone-sub">${esc(p.relationship)}</span>` : ''}`
      + `${brought[p.key] && brought[p.key].profile ? `<span class="ob-phone-sub">${esc(first(brought[p.key].profile))}</span>` : ''}`
      + `${latestLine(V, p.key) ? `<span class="ob-phone-sub ob-phone-recall">${esc(latestLine(V, p.key))}</span>` : ''}</div>`).join('')
    : '<div class="ob-phone-empty">Nobody yet. The people you meet will be here.</div>';
  return `<div class="ob-phone">${header(setup)}<div class="ob-phone-title">Contacts</div>${rows}${back()}</div>`;
}

const hourText = (h) => {
  if (!Number.isFinite(h) || h < 0) return '';
  const hr = Math.floor(h); const min = Math.round((h - hr) * 60);
  const ampm = hr >= 12 ? 'pm' : 'am'; const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}:${String(min).padStart(2, '0')}${ampm}`;
};

// A week from today, read from the engine's own calendar content: classes,
// holidays, plans. Each day is read on its own, so one bad day is one line.
export function phoneCalendar(setup, V, days = 7) {
  const today = Number(V && V.gameday) || 1;
  const out = [];
  for (let d = today; d < today + days; d++) {
    let label = `Day ${d}`;
    try { label = `${setup.ob_time.weekday(d)}${d === today ? ' (today)' : ''}`; } catch { /* keep Day N */ }
    let items = [];
    try { items = setup.ob_phone.get_day_content(d) || []; } catch { items = []; }
    const lines = items.map(([html, hour]) => `<div class="ob-phone-sub">${hourText(hour) ? `${hourText(hour)} ` : ''}${html}</div>`);
    out.push(`<div class="ob-phone-row"><b>${esc(label)}</b>${lines.length ? lines.join('') : '<div class="ob-phone-sub">Nothing planned</div>'}</div>`);
  }
  return `<div class="ob-phone">${header(setup)}<div class="ob-phone-title">Calendar</div>${out.join('')}${back()}</div>`;
}

export function installPhone(deps = {}) {
  const setup = deps.setup || (typeof window !== 'undefined' && window.SugarCube && window.SugarCube.setup);
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  if (!setup || !SC) return false;
  const V = () => (deps.state || SC.State).variables;
  setup.ob_obscura_phone = (view) => {
    if (view === 'contacts') return phoneContacts(setup, V());
    if (view === 'calendar') return phoneCalendar(setup, V());
    return phoneHome(setup, V());
  };
  return true;
}
