// world/workscreen.mjs — the shift, its moments and the Work screen.
//
// A shift is worked on its own screen (ObscuraShift), an hour at a time
// (world/work.mjs): each hour may bring a moment (world/moments.mjs) in the
// world's words where they are written (world/momentbank.mjs), answered before
// the next hour; the end shows the pay. The Work screen replaces the engine's
// own (its Employment tab includes the passage `Work`), which listed only its
// own town's jobs. The hub asks for work and starts a shift through here.
import {
  LINES, LADDER, SHIFT_KEY, SHIFT_PASSAGE, jobsOf, lineFor, titleOf, askForWork, shiftOn, hoursLeft, startShift,
  workHour, endShift, quit,
} from './work.mjs';
import { eligibleMoments, pickMoment, applyChoice, momentById } from './moments.mjs';
import { MOMENTS_TABLE, emptyMomentsLog, generateMoments, readMomentsLog, momentWords } from './momentbank.mjs';
import { geoOf as defaultGeoOf } from './geography.mjs';

export const SUMMARY_KEY = 'obscuraShiftSummary';
// How often an hour of work brings a moment.
export const MOMENT_CHANCE = 0.6;
const RECENT = 3;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const link = (label, run) => `<<link "${label}">><<run ${run}>><</link>>`;
export const clockAt = (hour) => `${((hour % 24) + 24) % 24}:00`;

// The moments' words for this world, kept per world in the store.
const bank = { worldId: null, log: emptyMomentsLog(), writing: new Set() };
export const momentLog = () => bank;
export function useMomentLog(worldId, log) {
  bank.worldId = worldId || null;
  bank.log = log || emptyMomentsLog();
}
const ranksFor = (line) => (bank.log.lines[line] && bank.log.lines[line].ranks) || null;

// A line of work's moments, written for the world when the player first takes
// that work; saved as soon as they land. Asked at most once at a time a line.
export async function writeLineMoments({ model, persona, store, worldId = bank.worldId, line, placeName, who = '', faultsIn }) {
  if (!model || bank.writing.has(line)) return 0;
  bank.writing.add(line);
  try {
    const got = await generateMoments({ model, persona, line, placeName, who, ...(faultsIn ? { faultsIn } : {}) });
    const written = Object.keys(got.texts).length;
    if (!written) return 0;
    const had = bank.log.lines[line] || { texts: {} };
    bank.log.lines[line] = { place: placeName, ranks: got.ranks || had.ranks || null, texts: { ...had.texts, ...got.texts } };
    if (store && worldId) {
      try { await store.saveTable(worldId, MOMENTS_TABLE, bank.log); } catch { /* kept for the session */ }
    }
    return written;
  } finally {
    bank.writing.delete(line);
  }
}

// At boot: the world's moments from the store, and the lines of work the
// player holds that have none yet written.
export async function restoreMoments({ store, worldId, model, persona, jobs = [], who = '', faultsIn }) {
  if (!worldId) return null;
  let raw = null;
  try { raw = store ? await store.loadTable(worldId, MOMENTS_TABLE) : null; } catch { raw = null; }
  useMomentLog(worldId, readMomentsLog(raw));
  for (const { line, placeName } of jobs) {
    if (!bank.log.lines[line] || !Object.keys(bank.log.lines[line].texts || {}).length) {
      await writeLineMoments({ model, persona, store, worldId, line, placeName, who, faultsIn });
    }
  }
  return bank.log;
}

export function shiftScreenHtml({ place, title = '', shift = null, left = 0, endsAt = '', words = null, summary = null }) {
  const name = esc(place && place.name);
  const out = ['<div class="ob-shift">'];
  if (summary) {
    out.push(`<div class="ob-shift-head">Your shift at ${name} is over.</div>`);
    out.push(`<p>You worked ${plural(summary.hours, 'hour', 'hours')}: $${summary.wages} in wages and $${summary.tips} in tips, $${summary.pay} in all.</p>`);
    if (summary.promoted) out.push(`<p class="ob-shift-promoted">You have been made ${esc(summary.promoted)}.</p>`);
    out.push(`<div class="ob-hub-actions">${link('Back', 'setup.ob_work_leave()')}</div></div>`);
    return out.join('');
  }
  const m = shift && shift.moment;
  const type = m && momentById(m.id);
  out.push(`<div class="ob-shift-head">You are working at ${name} as a ${esc(title)}. `
    + `${plural(shift ? shift.hours : 0, 'hour', 'hours')} worked, $${shift ? shift.tips : 0} in tips so far.`
    + `${endsAt ? ` The shift ends at ${esc(endsAt)}.` : ''}</div>`);
  if (type && words && m.stage === 'setup') {
    out.push(`<div class="ob-moment"><p>${esc(words.setup)}</p><div class="ob-moment-choices">`);
    for (const c of type.choices) out.push(link(c.label, `setup.ob_work_choose("${c.id}")`));
    out.push('</div></div></div>');
    return out.join('');
  }
  if (type && words && m.stage === 'outcome') {
    const paid = [m.tip ? `+$${m.tip} in tips` : '', m.money ? `+$${m.money}` : ''].filter(Boolean).join(', ');
    out.push(`<div class="ob-moment"><p>${esc(words.outcomes[m.key] || '')}</p>`
      + `${paid ? `<p class="ob-moment-paid">${paid}</p>` : ''}`
      + `<div class="ob-hub-actions">${link('Carry on', 'setup.ob_work_continue()')}</div></div></div>`);
    return out.join('');
  }
  out.push('<div class="ob-hub-actions">');
  if (left > 0) out.push(link('Work an hour', 'setup.ob_work_hour()'));
  out.push(link('Finish the shift', 'setup.ob_work_finish()'));
  out.push('</div></div>');
  return out.join('');
}

export function workScreenHtml({ jobs = [], rent = null }) {
  const out = ['<div class="ob-work">'];
  if (!jobs.length) out.push('<p>You have no work yet. Places that hire say so.</p>');
  for (const { key, placeName, title, job } of jobs) {
    const line = LINES[job.line];
    const rung = LADDER[job.rank] || LADDER[0];
    const next = LADDER[job.rank + 1];
    const wage = line && line.tips ? `$${rung.standard} an hour ($${rung.tipped} with tips)` : `$${rung.standard} an hour`;
    out.push(`<div class="ob-work-job"><div class="ob-work-where"><b>${esc(placeName)}</b> - ${esc(title)}</div>`
      + `<div>${wage}. Shift: ${clockAt(line ? line.start : 0)} to ${clockAt(line ? line.end : 0)}.</div>`
      + `<div>${plural(job.shifts || 0, 'shift', 'shifts')}, ${plural(job.hours || 0, 'hour', 'hours')}; $${job.pay || 0} paid, $${job.tips || 0} of it in tips.</div>`
      + `<div>${next ? `Next rank: performance ${job.perf || 0} of ${next.perf} and ${job.days || 0} of ${next.days} days.` : 'The top of the ladder.'}</div>`
      + `<div class="ob-hub-actions">${link('Quit', `setup.ob_work_quit("${key}")`)}</div></div>`);
  }
  if (rent && rent.weekly) {
    out.push(`<p class="ob-work-rent">Rent on your room: $${rent.weekly} every Monday evening.${rent.owed ? ` $${rent.owed} is still owed.` : ''}</p>`);
  }
  out.push('</div>');
  return out.join('');
}

// What the hub offers at a place that hires.
export function workLinks(V, place) {
  if (!lineFor(place)) return [];
  const job = jobsOf(V)[place.key];
  if (!job) return [{ label: 'Ask for work', run: `setup.ob_work_ask("${place.key}")` }];
  const line = LINES[job.line];
  if (shiftOn(V, job.line)) return [{ label: `Work a shift (until ${clockAt(line.end)})`, run: 'setup.ob_work_start()' }];
  return [{ text: `Your shift here starts at ${clockAt(line.start)}.` }];
}

export function installWork(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  if (!SC || !SC.State || !SC.setup) return false;
  const setup = SC.setup;
  const V = () => SC.State.variables;
  const rng = deps.rng || Math.random;
  const geoOf = deps.geoOf || ((v) => defaultGeoOf(v, setup));
  const placeOf = (key) => {
    const p = geoOf(V()).places[key];
    return p ? { key, ...p } : null;
  };
  const show = () => { try { SC.Engine.show(); } catch { /* nothing on screen */ } };
  const words = (id) => momentWords(bank.log, id);
  const finish = () => {
    const v = V();
    const s = v[SHIFT_KEY];
    if (!s) return null;
    const done = endShift(setup, v, { ranks: ranksFor(s.line) });
    v[SUMMARY_KEY] = { ...done, place: s.place };
    return done;
  };

  setup.ob_work_ask = (key) => {
    const v = V();
    const place = placeOf(key);
    const got = askForWork(setup, v, place);
    v.obscuraDid = got.line;
    if (got.hired && typeof deps.onHired === 'function') {
      try { deps.onHired({ line: lineFor(place), placeName: place.name }); } catch { /* the words come later */ }
    }
    SC.Engine.play('ObscuraHub');
  };
  setup.ob_work_start = () => {
    const v = V();
    const place = placeOf(v.location);
    const job = place && jobsOf(v)[place.key];
    if (!job || !shiftOn(v, job.line)) return false;
    startShift(v, place);
    SC.Engine.play(SHIFT_PASSAGE);
    return true;
  };
  setup.ob_work_hour = () => {
    const v = V();
    const s = v[SHIFT_KEY];
    if (!s || s.moment || hoursLeft(v, s.line) <= 0) return false;
    workHour(setup, v, rng);
    if (rng() < MOMENT_CHANCE) {
      const type = pickMoment(eligibleMoments(setup, v, s.line), rng, s.recent || []);
      if (type) {
        s.moment = { id: type.id, stage: 'setup' };
        s.recent = [...(s.recent || []), type.id].slice(-RECENT);
      }
    }
    if (!s.moment && hoursLeft(v, s.line) <= 0) finish();
    show();
    return true;
  };
  setup.ob_work_choose = (choiceId) => {
    const v = V();
    const s = v[SHIFT_KEY];
    const type = s && s.moment && s.moment.stage === 'setup' ? momentById(s.moment.id) : null;
    const got = type ? applyChoice(setup, v, type, choiceId, rng) : null;
    if (!got) return false;
    s.moment = { id: type.id, stage: 'outcome', key: got.key, tip: got.tip, money: got.money };
    show();
    return true;
  };
  setup.ob_work_continue = () => {
    const v = V();
    const s = v[SHIFT_KEY];
    if (!s) return false;
    s.moment = null;
    if (hoursLeft(v, s.line) <= 0) finish();
    show();
    return true;
  };
  setup.ob_work_finish = () => {
    finish();
    show();
  };
  setup.ob_work_leave = () => {
    delete V()[SUMMARY_KEY];
    SC.Engine.play('ObscuraHub');
  };
  setup.ob_shift_screen = () => {
    const v = V();
    const summary = v[SUMMARY_KEY];
    if (summary) return shiftScreenHtml({ place: placeOf(summary.place), summary });
    const s = v[SHIFT_KEY];
    if (!s) return shiftScreenHtml({ place: placeOf(v.location), summary: { hours: 0, pay: 0, wages: 0, tips: 0 } });
    const job = jobsOf(v)[s.place];
    return shiftScreenHtml({
      place: placeOf(s.place), title: titleOf(job, ranksFor(s.line)), shift: s, left: hoursLeft(v, s.line),
      endsAt: clockAt(LINES[s.line].end), words: s.moment ? words(s.moment.id) : null,
    });
  };
  setup.ob_work_screen = () => {
    const v = V();
    const jobs = Object.entries(jobsOf(v)).map(([key, job]) => ({
      key, job, placeName: (placeOf(key) || { name: key }).name, title: titleOf(job, ranksFor(job.line)),
    }));
    return workScreenHtml({ jobs, rent: { weekly: Number(v.weeklydebt) || 0, owed: Number(v.backdebt) || 0 } });
  };
  setup.ob_work_quit = (key) => {
    quit(V(), key);
    if (typeof setup.ob_open_dialog === 'function') {
      try { setup.ob_open_dialog('Character', 'Character', 'Character'); return; } catch { /* shown below */ }
    }
    show();
  };
  return true;
}
