// world/guard.mjs — no placeholder is ever read on screen.
//
// The writer's plan blanks every unwritten field it knows of. This is the net
// under it: any placeholder that still reaches the page, by any code path - a
// string the engine built from pieces, a table the plan never saw, the moment
// between a restore and its replay - is removed from the text before it can be
// read, and the space it leaves is closed up. The published build showed
// "Your full name is [ob_names-20] [ob_names-32]" and a Content Options screen
// of "[description — unwritten #1652]"; neither can be shown again.
//
// Three shapes, all of them machine-made and none of them English:
//   [description — unwritten #1652]              the chassis's stripped prose
//   [ob_names-20]  [ob_styles.femme hair dye-3]   a stub list entry
//   [x.y · <the premise> · f4jf]                  a stub record field
const TOKEN = new RegExp([
  '\\[[a-z][a-z _-]{0,40} — unwritten #\\d+\\]',
  '\\[[a-z_][a-z0-9_. ]{0,60}-\\d+\\]',
  '\\[[^\\[\\]\\n]{1,600}? · [a-z0-9]{1,8}\\]',
].join('|'), 'g');

export function scrub(text) {
  if (typeof text !== 'string' || text.indexOf('[') === -1) return text;
  const out = text.replace(TOKEN, '');
  if (out === text) return text;
  return out.replace(/[ \t]{2,}/g, ' ').replace(/ ([.,;:!?])/g, '$1').replace(/^ +| +$/g, '');
}

// A player's own typing, and code, are never touched.
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT']);
const ATTRS = ['title', 'alt', 'aria-label', 'placeholder', 'data-tooltip'];

// `transform` runs after the scrub on every text node and on the attributes
// the player reads: the school's names renamed for this world
// (world/renames.mjs) reach the screen this way, because what the engine
// builds in JavaScript never passes the passage hook.
export function scrubTree(root, transform = null) {
  let changed = 0;
  const clean = (v) => {
    let s = v.indexOf('[') !== -1 ? scrub(v) : v;
    if (transform) { try { s = transform(s); } catch { /* the text stays as it was */ } }
    return s;
  };
  const visit = (node) => {
    if (!node) return;
    if (node.nodeType === 3) {
      const v = node.nodeValue;
      if (typeof v !== 'string') return;
      const s = clean(v);
      if (s !== v) { node.nodeValue = s; changed += 1; }
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    if (node.nodeType === 1) {
      if (SKIP.has(String(node.tagName).toUpperCase())) return;
      for (const a of ATTRS) {
        const v = typeof node.getAttribute === 'function' ? node.getAttribute(a) : null;
        if (typeof v !== 'string' || !v) continue;
        const s = clean(v);
        if (s !== v) { node.setAttribute(a, s); changed += 1; }
      }
    }
    const kids = node.childNodes || [];
    for (let i = 0; i < kids.length; i++) visit(kids[i]);
  };
  visit(root);
  return changed;
}

// Scrubs the page once, then every node added and every text changed.
// deps: document, MutationObserver, onScrub(count), transform(text).
export function installGuard(deps = {}) {
  const doc = deps.document !== undefined ? deps.document : (typeof document !== 'undefined' ? document : null);
  if (!doc || !doc.body) return null;
  const onScrub = deps.onScrub || (() => {});
  const fix = (node) => {
    const n = scrubTree(node, deps.transform || null);
    if (n) { try { onScrub(n); } catch { /* not the guard's failure */ } }
  };
  fix(doc.body);
  const Observer = deps.MutationObserver !== undefined ? deps.MutationObserver
    : (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
  if (!Observer) return { stop() {} };
  const observer = new Observer((records) => {
    for (const r of records) {
      if (r.type === 'characterData') fix(r.target);
      else for (const n of r.addedNodes || []) fix(n);
    }
  });
  observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
  return { stop() { observer.disconnect(); } };
}
