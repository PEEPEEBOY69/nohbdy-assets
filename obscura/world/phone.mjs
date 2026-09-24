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
import { calendarRead } from './timetable.mjs';

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

// A week from today, read from the engine's own day content: classes,
// festivals, breaks, plans. The engine takes a day of the MONTH and reads its
// month from $displaymonth and _month, the way its own calendar screen set
// them; handed the absolute day and no month it showed classes and nothing
// else (measured, 2026-09-24). Both are put back after the read. Its labels
// carry their own time ("9am General Psychology"). What the world's rulings
// switch off - rush week, game days - is left out (world/timetable.mjs).
export function phoneCalendar(setup, V, days = 7, T = null) {
  const time = (setup && setup.ob_time) || {};
  const months = Array.isArray(time.months) ? time.months : [];
  const length = Number(time.month_length) || 28;
  let month = Number.isInteger(V && V.month) ? V.month : 0;
  let day = Number(V && V.day) || 1;
  const temp = T || {};
  const kept = { display: V ? V.displaymonth : undefined, month: temp.month };
  const out = [];
  try {
    for (let i = 0; i < days; i++) {
      let label = `Day ${day}`;
      try { label = `${time.weekday(day)}${i === 0 ? ' (today)' : ''}`; } catch { /* keep Day N */ }
      if (V) V.displaymonth = month;
      temp.month = months[month];
      let items = [];
      try { items = calendarRead(setup, V, () => setup.ob_phone.get_day_content(day)) || []; } catch { items = []; }
      const lines = items.map(([html]) => `<div class="ob-phone-sub">${html}</div>`);
      out.push(`<div class="ob-phone-row"><b>${esc(label)}</b>${lines.length ? lines.join('') : '<div class="ob-phone-sub">Nothing planned</div>'}</div>`);
      day += 1;
      if (day > length) { day = 1; month = months.length ? (month + 1) % months.length : month + 1; }
    }
  } finally {
    if (V) { if (kept.display === undefined) delete V.displaymonth; else V.displaymonth = kept.display; }
    if (kept.month === undefined) delete temp.month; else temp.month = kept.month;
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
    if (view === 'calendar') return phoneCalendar(setup, V(), 7, SC.State.temporary);
    return phoneHome(setup, V());
  };
  return true;
}
