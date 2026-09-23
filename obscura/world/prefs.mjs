// world/prefs.mjs — text size and motion, kept by the device.
//
// The original's Accessibility tab never shipped, and the Options screen said
// so in red. These two belong to the person holding the device, not to a
// playthrough, so they live in localStorage (where a private window may refuse
// them - they still apply for the session) and on <html> as data attributes
// the theme reads.
export const TEXT_SIZES = ['small', 'normal', 'large', 'larger'];
const KEY_TEXT = 'obscura.text';
const KEY_MOTION = 'obscura.motion';

const store = (deps) => deps.storage !== undefined ? deps.storage
  : (() => { try { return globalThis.localStorage; } catch { return null; } })();
const rootEl = (deps) => deps.root || (typeof document !== 'undefined' ? document.documentElement : null);

export function readPrefs(storage) {
  const out = { text: 'normal', motion: 'full' };
  try {
    const t = storage && storage.getItem(KEY_TEXT);
    const m = storage && storage.getItem(KEY_MOTION);
    if (TEXT_SIZES.includes(t)) out.text = t;
    if (m === 'reduce') out.motion = 'reduce';
  } catch { /* refused: defaults */ }
  return out;
}

export function applyPrefs(el, prefs) {
  if (!el || !el.dataset) return;
  el.dataset.obText = prefs.text;
  el.dataset.obMotion = prefs.motion;
}

export function setTextSize(size, deps = {}) {
  if (!TEXT_SIZES.includes(size)) return false;
  try { const s = store(deps); if (s) s.setItem(KEY_TEXT, size); } catch { /* refused: still applied */ }
  const el = rootEl(deps);
  if (el && el.dataset) el.dataset.obText = size;
  return true;
}

export function setReduceMotion(on, deps = {}) {
  const motion = on ? 'reduce' : 'full';
  try { const s = store(deps); if (s) s.setItem(KEY_MOTION, motion); } catch { /* refused: still applied */ }
  const el = rootEl(deps);
  if (el && el.dataset) el.dataset.obMotion = motion;
  // the bars' own animation is the engine's option
  const vars = deps.vars || (typeof window !== 'undefined' && window.SugarCube ? window.SugarCube.State.variables : null);
  if (vars) vars.optuianims = !on;
  return true;
}

// At boot: apply what the device keeps, and give the Options passages
// setup.ob_text_size(size), setup.ob_reduce_motion(on) and setup.ob_prefs().
export function installPrefs(deps = {}) {
  const el = rootEl(deps);
  applyPrefs(el, readPrefs(store(deps)));
  const setup = deps.setup || (typeof window !== 'undefined' && window.SugarCube ? window.SugarCube.setup : null);
  if (setup) {
    setup.ob_text_size = (size) => setTextSize(size, deps);
    setup.ob_reduce_motion = (on) => setReduceMotion(!!on, deps);
    setup.ob_prefs = () => readPrefs(store(deps));
  }
  return true;
}
