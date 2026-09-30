// world/work.mjs — work at the world's places.
//
// The engine's jobs are its own town's (a bar, a burger counter, a dining
// hall) and their scenes do not ship. A world's places hire by their kind, on
// the engine's own ladder (setup.ob_riverRat.jobs): five ranks, a wage and a
// tipped wage an hour, promotion after days worked since the last one and a
// performance to reach, and a shift's pay counted the engine's way - the larger
// of the wage for the hours worked, or the tipped wage and the tips taken. A
// shift is worked an hour at a time; what happens in an hour beyond the work
// itself is world/moments.mjs.

export const WORK_KEY = 'obscuraWork';
export const SHIFT_KEY = 'obscuraShift';
export const SHIFT_PASSAGE = 'ObscuraShift';
export const MAX_JOBS = 2;

// Each kind of place that hires has one line of work: the skill it uses and
// raises, the tips an hour it can bring before skill (a range, none for a
// shop), its shift's hours (an end past 24 runs past midnight), and what it
// takes out of the body an hour beyond the clock.
export const LINES = {
  serving: { kinds: ['food'], skill: 'Charisma', tips: [2, 6], start: 17, end: 23, tire: 0 },
  shopwork: { kinds: ['shop'], skill: 'Charisma', tips: null, start: 9, end: 15, tire: 0 },
  service: { kinds: ['lodging', 'bath', 'healer'], skill: 'Physical', tips: [0, 2], start: 7, end: 12, tire: 40 },
  performing: { kinds: ['entertainment'], skill: 'Dancing', tips: [3, 9], start: 20, end: 25, tire: 60 },
};

// The engine's ladder, rank by rank: the wage and the tipped wage an hour, and
// the days worked since the last promotion and the performance it takes.
export const LADDER = [
  { standard: 7, tipped: 2, days: 0, perf: 0 },
  { standard: 9, tipped: 3, days: 7, perf: 100 },
  { standard: 11, tipped: 4, days: 14, perf: 250 },
  { standard: 15, tipped: 7, days: 14, perf: 500 },
  { standard: 18, tipped: 9, days: 14, perf: 750 },
];
// Until the world names a place's ranks (world/momentbank.mjs).
export const PLAIN_TITLES = ['new hand', 'hand', 'senior hand', 'head', 'keeper'];

const LINE_OF = {};
for (const [id, line] of Object.entries(LINES)) for (const kind of line.kinds) LINE_OF[kind] = id;
export const lineFor = (place) => (place && LINE_OF[place.kind]) || null;

const stateOf = (V) => {
  const s = V[WORK_KEY] || (V[WORK_KEY] = {});
  s.jobs = s.jobs || {};
  s.refused = s.refused || {};
  return s;
};
export const jobsOf = (V) => (V && V[WORK_KEY] && V[WORK_KEY].jobs) || {};

export function titleOf(job, ranks) {
  const rank = (job && job.rank) || 0;
  return (Array.isArray(ranks) && ranks.length === LADDER.length && ranks[rank]) || PLAIN_TITLES[rank] || PLAIN_TITLES[0];
}

const pcOf = (setup, V) => (setup && typeof setup.pc === 'function' ? setup.pc() : V && V.pc) || null;
const levelOf = (pc, skill) => (pc && typeof pc.skill_level === 'function' ? Number(pc.skill_level(skill)) || 0 : 0);

// Asked where a place hires: an easy check on the line's skill. Turned away,
// the player may ask there again the next day; a player holds two jobs at most.
export function askForWork(setup, V, place) {
  const line = lineFor(place);
  if (!line) return { hired: false, line: 'Nobody here is hiring.' };
  const state = stateOf(V);
  if (state.jobs[place.key]) return { hired: false, line: 'You already work here.' };
  if (Object.keys(state.jobs).length >= MAX_JOBS) {
    return { hired: false, line: 'You already hold two jobs, and have no hours left for a third.' };
  }
  if (state.refused[place.key] === V.gameday) return { hired: false, line: 'They turned you away today. Try again tomorrow.' };
  const pc = pcOf(setup, V);
  const passed = pc && typeof pc.skillcheck === 'function' ? pc.skillcheck(LINES[line].skill, 1) : true;
  if (!passed) {
    state.refused[place.key] = V.gameday;
    return { hired: false, line: 'They have nothing for you today. Try again tomorrow.' };
  }
  delete state.refused[place.key];
  state.jobs[place.key] = { line, rank: 0, perf: 0, days: 0, since: V.gameday, lastDay: null, shifts: 0, hours: 0, pay: 0, tips: 0 };
  return { hired: true, line: `You are taken on at ${place.name}.` };
}

// The hour of the day, counted on past midnight for a shift that runs past it.
const shiftHour = (V, line) => {
  const h = Number(V && V.hour) || 0;
  return h < line.start && line.end > 24 ? h + 24 : h;
};
// A shift can be started from its first hour to an hour before its end.
export function shiftOn(V, lineId) {
  const line = LINES[lineId];
  if (!line) return false;
  const h = shiftHour(V, line);
  return h >= line.start && h <= line.end - 1;
}
export function hoursLeft(V, lineId) {
  const line = LINES[lineId];
  if (!line) return 0;
  const h = shiftHour(V, line);
  return h >= line.start && h < line.end ? line.end - h : 0;
}

export function startShift(V, place) {
  const job = jobsOf(V)[place && place.key];
  if (!job) return null;
  V[SHIFT_KEY] = { place: place.key, line: job.line, hours: 0, tips: 0, perf: 0, moment: null, recent: [] };
  return V[SHIFT_KEY];
}

// One hour of the shift: the clock, what the work takes out of the body,
// performance (four an hour and the line's skill level), the line's skill used,
// and tips where the line is tipped (more with the skill).
export function workHour(setup, V, rng = Math.random) {
  const s = V[SHIFT_KEY];
  const line = s && LINES[s.line];
  if (!line) return null;
  const job = jobsOf(V)[s.place];
  const pc = pcOf(setup, V);
  const level = levelOf(pc, line.skill);
  setup.ob_time.advance_time(60);
  if (line.tire && setup.ob_needs && typeof setup.ob_needs.tire === 'function') setup.ob_needs.tire(line.tire);
  s.hours += 1;
  s.perf += 4 + level;
  if (line.tips) {
    const [lo, hi] = line.tips;
    s.tips += Math.round((lo + rng() * (hi - lo)) * (1 + 0.1 * level));
  }
  if (pc && typeof pc.raise_skill === 'function') pc.raise_skill(line.skill, Math.min(10, ((job && job.rank) || 0) * 2));
  return s;
}

// The shift's end: pay the engine's way, the job's totals, a day worked (once a
// day), and a promotion when the next rank's days and performance are reached.
export function endShift(setup, V, { ranks } = {}) {
  const s = V[SHIFT_KEY];
  if (!s) return null;
  delete V[SHIFT_KEY];
  const job = jobsOf(V)[s.place];
  const hours = s.hours || 0;
  // tips a moment brought are paid even if the shift ends before a full hour
  if (!job || (!hours && !(s.tips > 0))) return { hours: 0, pay: 0, wages: 0, tips: 0, promoted: null, title: job ? titleOf(job, ranks) : '' };
  const rung = LADDER[job.rank] || LADDER[0];
  const adjust = (x) => (setup && typeof setup.ob_adjust_income === 'function' ? setup.ob_adjust_income(x, 'regular job') : x);
  const tips = s.tips || 0;
  const pay = Math.round(Math.max(hours * adjust(rung.standard), hours * adjust(rung.tipped) + tips));
  V.pcmoney = (Number(V.pcmoney) || 0) + pay;
  job.pay = (job.pay || 0) + pay;
  job.tips = (job.tips || 0) + tips;
  job.perf = (job.perf || 0) + (s.perf || 0);
  // only an hour worked makes a shift, and a day toward the next rank
  if (!hours) return { hours: 0, pay, wages: pay - tips, tips, promoted: null, title: titleOf(job, ranks) };
  job.shifts = (job.shifts || 0) + 1;
  job.hours = (job.hours || 0) + hours;
  if (job.lastDay !== V.gameday) {
    job.days = (job.days || 0) + 1;
    job.lastDay = V.gameday;
  }
  let promoted = null;
  const next = LADDER[job.rank + 1];
  if (next && job.days >= next.days && job.perf >= next.perf) {
    job.rank += 1;
    job.days = 0;
    promoted = titleOf(job, ranks);
  }
  return { hours, pay, wages: pay - tips, tips, promoted, title: titleOf(job, ranks) };
}

export function quit(V, key) {
  const jobs = jobsOf(V);
  if (!jobs[key]) return false;
  delete jobs[key];
  return true;
}
