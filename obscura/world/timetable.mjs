// world/timetable.mjs — the school's systems, kept or switched off by the world.
//
// The first call rules on whether this world has a timetable, grades, sports
// and exclusive houses ($obscuraWorld.systems, world/lexicon.mjs). The engine
// has none of those switches, so this puts them on the handful of functions
// the PLAYER meets - never the ones the NPC simulation uses (it sends people
// to class by their own courses and a calendar check). Every wrapper reads the
// rulings from the live state, so loading another world's save behaves as
// that world.
const ALL_ON = { timetable: true, grades: true, sports: true, divisions: true };

export function systemsOf(V) {
  const s = V && V.obscuraWorld && V.obscuraWorld.systems;
  return s && typeof s === 'object' ? { ...ALL_ON, ...s } : { ...ALL_ON };
}

export const unenrolled = (V) => !((V && V.pccourses) || []).some(Boolean) && !((V && V.pcsports) || []).length;

const WRAPPED = '__obscuraTimetable';
// `name` may be a list: the shipped chassis renames part of `setup`
// (chassis/rename-map.json - class_time_status is ob_class_time_status), so
// the first name that exists is the one wrapped.
const wrap = (owner, names, make) => {
  const name = [].concat(names).find((n) => owner && typeof owner[n] === 'function');
  const original = name && owner[name];
  if (typeof original !== 'function' || original[WRAPPED]) return false;
  const next = make(original);
  next[WRAPPED] = true;
  owner[name] = next;
  return true;
};

// Houses and sports cannot be joined in Obscura - their rush and signup
// scenes do not ship - so what is left of them is what the phone's calendar
// shows: "Rush week!" and every game day. The phone reads its week through
// this: with sports off the game days are not there, with houses off rush week
// is not - for the length of the read, and the engine's data put back after.
export function calendarRead(setup, V, read) {
  const s = systemsOf(V);
  const School = setup && setup.School;
  const houses = setup && setup.ob_houses;
  const games = School ? School.gamedays : undefined;
  const rush = houses ? houses.is_rush_week : undefined;
  try {
    if (!s.sports && School) School.gamedays = [];
    if (!s.divisions && houses && typeof rush === 'function') houses.is_rush_week = () => false;
    return read();
  } finally {
    if (School) School.gamedays = games;
    if (houses && typeof rush === 'function') houses.is_rush_week = rush;
  }
}

export function installTimetable(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const setup = SC && SC.setup;
  const School = setup && setup.School;
  if (!School) return false;
  const V = () => SC.State.variables;
  const noGameOfTheirs = () => { try { return !School.current_game(true); } catch { return true; } };

  // next_class has no base case for an empty roster: it asks about tomorrow
  // forever, until the stack overflows. With nothing to find, there is no
  // next class.
  wrap(School, 'next_class', (original) => function (...args) {
    if (unenrolled(V())) return null;
    return original.apply(this, args);
  });
  // the sidebar's class line reads .month, .day and .course off next_class
  wrap(setup, ['ob_class_time_status', 'class_time_status'], (original) => function (...args) {
    if (unenrolled(V()) && noGameOfTheirs()) return { message: '' };
    return original.apply(this, args);
  });
  wrap(setup, ['ob_class_time_status_mini', 'class_time_status_mini'], (original) => function (...args) {
    if (unenrolled(V()) && noGameOfTheirs()) return '';
    return original.apply(this, args);
  });

  // Grades off (and so whenever the timetable is off): term end reports no
  // grade, and the average is the engine's "no grade".
  wrap(School, 'end_term_for_course', (original) => function (...args) {
    if (!systemsOf(V()).grades) return undefined;
    return original.apply(this, args);
  });
  for (const name of ['current_average_score', 'last_average_score']) {
    wrap(School, name, (original) => function (...args) {
      if (!systemsOf(V()).grades) return -1;
      return original.apply(this, args);
    });
  }

  // Houses off: a closed door, closed even if house content ever ships.
  wrap(setup.ob_houses, ['can_join'], (original) => function (...args) {
    if (!systemsOf(V()).divisions) return false;
    return original.apply(this, args);
  });

  // Timetable on: a class of the player's, on now, at its building or at the
  // building's door (where the sidebar's shortcut takes them). Attending puts
  // them inside and hands over to the engine's own attend_class; ObscuraClass
  // is tagged `class`, so the time run to the class's end there counts as
  // attended by the engine's own rule - not the missed class every class was.
  const doorOf = (loc) => (setup.ob_maps && setup.ob_maps[loc] && setup.ob_maps[loc].outside) || null;
  const classNow = () => {
    try { return School.classes_today() ? School.current_class() : null; } catch { return null; }
  };
  const minutesLeft = (c, v) => Math.max(0, (c.hour + c.length) * 60 - ((v.hour || 0) * 60 + (v.minute || 0)));
  setup.ob_attendable = () => {
    const v = V();
    if (!systemsOf(v).timetable || v.inclass) return null;
    const c = classNow();
    if (!c || c.type !== 'class') return null;
    const loc = School.class_location(c.course);
    if (v.location !== loc && v.location !== doorOf(loc)) return null;
    return { course: c.course, minutes: minutesLeft(c, v) || c.length * 60 };
  };
  setup.ob_attend = () => {
    const c = setup.ob_attendable();
    if (!c) return false;
    V().location = School.class_location(c.course);
    School.attend_class();
    SC.Engine.play('ObscuraClass');
    return true;
  };
  setup.ob_class_end = () => {
    const v = V();
    const c = classNow();
    const minutes = c ? minutesLeft(c, v) : 0;
    try { if (minutes > 0) setup.ob_time.advance_time(minutes); } catch { /* the clock is not the class's to fail */ }
    delete v.inclass;
    SC.Engine.play('ObscuraHub');
    return minutes;
  };

  // Timetable off: the quickstart enrols the player in character creation;
  // at every place they are unenrolled again, and whatever the timetable left
  // (homework, exams) goes with it. With no courses nothing is ever missed,
  // no homework is assigned, and term end grades nothing.
  const $ = deps.jQuery !== undefined ? deps.jQuery : (typeof window !== 'undefined' ? window.jQuery : null);
  const doc = deps.document !== undefined ? deps.document : (typeof document !== 'undefined' ? document : null);
  if ($ && doc && !installTimetable.hooked) {
    $(doc).on(':passagedisplay', (ev) => {
      const tags = (ev && ev.passage && ev.passage.tags) || [];
      if (!tags.includes('location')) return;
      const v = V();
      if (systemsOf(v).timetable || unenrolled(v)) return;
      v.pccourses = [];
      v.homework = {};
      v.exams = {};
    });
    installTimetable.hooked = true;
  }
  return true;
}
