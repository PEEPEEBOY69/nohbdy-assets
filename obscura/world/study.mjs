// world/study.mjs — study, homework and training.
//
// The engine keeps a player's understanding of each course (studied minutes
// against what classes have covered) and their homework, and raises skills
// with use; its study scenes do not ship. An hour of study here goes through
// its own functions (School.do_study, do_homework) at a rate the Studying skill
// sets, and raises the skills the engine says study raises. In a world with no
// timetable, or before any course, an hour at a learning place teaches what its
// name suggests.
import { systemsOf } from './timetable.mjs';

const pcOf = (setup, V) => (setup && typeof setup.pc === 'function' ? setup.pc() : V && V.pc) || null;
const call = (obj, fn, ...args) => {
  try { return obj && typeof obj[fn] === 'function' ? obj[fn](...args) : undefined; } catch { return undefined; }
};
const levelOf = (setup, V, skill) => Number(call(pcOf(setup, V), 'skill_level', skill)) || 0;
const raise = (setup, V, skill, levelCheck = -1) => call(pcOf(setup, V), 'raise_skill', skill, levelCheck);

// Minutes of study an hour: half an hour at first, six more a level of the
// Studying skill; a lamp at home makes it go faster; exhausted, half as much.
export function studyMinutes(setup, V, { atHome = false } = {}) {
  let minutes = 30 + 6 * levelOf(setup, V, 'Studying');
  const light = V && V.obscuraHome && V.obscuraHome.light;
  if (atHome && light && Number(light.study) > 1) minutes *= Number(light.study);
  if (((V && V.pcneeds && V.pcneeds.Rest) ?? 1000) < 300) minutes *= 0.5;
  return Math.round(minutes);
}

// What a learning place teaches, by its name.
const SUBJECTS = [
  [/darkroom|photo|camera|lens/i, 'Photography'],
  [/atelier|studio|gallery|paint|sculpt|\bart\b|artist|potter|kiln|loom|weav/i, 'Artistic'],
  [/scriptori|scribe|press|print|writ|poet|letter/i, 'Writing'],
  [/garden|greenhouse|herb|orchard|nursery|grove|seed/i, 'Gardening'],
  [/danc|ballet|stage|revel/i, 'Dancing'],
  [/kitchen|cook|bak|brew/i, 'Cooking'],
];
export function subjectOf(name) {
  const hit = SUBJECTS.find(([re]) => re.test(String(name || '')));
  return hit ? hit[1] : 'Intellectual';
}

const coursesOf = (V) => (systemsOf(V).timetable ? ((V && V.pccourses) || []).filter(Boolean) : []);

// An hour of study: the course the player understands least, where the world
// keeps a timetable and they have courses; else the place's own subject.
export function study(setup, V, place) {
  const School = setup && setup.School;
  const atHome = !!place && place.kind === 'home';
  const courses = coursesOf(V);
  let line;
  if (courses.length && School && typeof School.do_study === 'function') {
    const understood = (c) => Number(call(School, 'unit_understanding', c) ?? 1);
    const course = courses.reduce((a, b) => (understood(b) < understood(a) ? b : a));
    call(School, 'do_study', course, studyMinutes(setup, V, { atHome }));
    raise(setup, V, 'Studying', Number(call(School, 'study_difficulty', course)) || 0);
    if (place && place.kind === 'learning') raise(setup, V, 'Intellectual');
    line = `You study ${course} for an hour.`;
  } else {
    raise(setup, V, 'Studying');
    if (!atHome) raise(setup, V, subjectOf(place && place.name));
    line = 'You study for an hour.';
  }
  call(setup.ob_needs, 'stress', 20);
  setup.ob_time.advance_time(60);
  return { line };
}

// An hour of homework: the first course with some unfinished. With none set,
// nothing is done and no time passes.
export function homework(setup, V, place) {
  const School = setup && setup.School;
  const open = (call(School, 'unfinished_homework_classes') || []).filter(Boolean);
  if (!open.length) return { refused: true, line: 'You have no homework.' };
  const course = open[0];
  call(School, 'do_homework', course, studyMinutes(setup, V, { atHome: !!place && place.kind === 'home' }));
  raise(setup, V, 'Studying');
  call(setup.ob_needs, 'stress', 30);
  setup.ob_time.advance_time(60);
  return { line: `You work through your ${course} homework for an hour.` };
}

// An hour of training: the body, and what it takes out of it.
export function train(setup, V) {
  raise(setup, V, 'Physical');
  call(setup.ob_needs, 'tire', 150);
  call(setup.ob_needs, 'dirty', 200);
  call(setup.ob_needs, 'increase_need', 'Relaxation', 50);
  setup.ob_time.advance_time(60);
  return { line: 'You train hard for an hour, and feel it.' };
}

export function dance(setup, V) {
  raise(setup, V, 'Dancing');
  call(setup.ob_needs, 'tire', 100);
  call(setup.ob_needs, 'dirty', 100);
  setup.ob_time.advance_time(60);
  return { line: 'You dance for an hour until you are breathless.' };
}
