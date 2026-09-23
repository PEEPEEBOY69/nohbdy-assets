// world/plugins.mjs — the lists panel's plugins, where Perchance really puts them.
//
// Measured on the published page (2026-09-23), not assumed. A plugin imported
// in the lists panel (`ai = {import:ai-text-plugin}`) is NOT a window property
// and NOT a global binding: `typeof ai` is "undefined" in an injected classic
// script, in a module script, in indirect eval and in `new Function` - which
// covers every world module and every passage SugarCube evaluates. Only the
// panel's own inline scripts get the bare name. From anywhere else the one way
// in is `root`, Perchance's object of the panel's top-level names: `root.ai`.
//
// Every world before this was built with no model at all on perchance.org,
// while every local walk passed: the harness put its fakes on window.
//
// `root` is a Proxy. Reading a name it does not know, or enumerating it, can
// throw, so every read is guarded and a miss is null, never an exception.
export function findPlugin(name, scope) {
  const g = scope || (typeof globalThis !== 'undefined' ? globalThis : {});
  let root = null;
  try { root = g.root; } catch { root = null; }
  if (root) {
    try {
      const p = root[name];
      if (typeof p === 'function') return p;
    } catch { /* not a name this root knows */ }
  }
  // A page with no root: the local harness and the tests.
  try {
    if (typeof g[name] === 'function') return g[name];
  } catch { /* nothing there */ }
  return null;
}

// The same lookup for a plugin that is an object with methods rather than a
// function - the bug reporter is one.
export function findPluginObject(name, scope) {
  const g = scope || (typeof globalThis !== 'undefined' ? globalThis : {});
  const ok = (v) => !!v && (typeof v === 'object' || typeof v === 'function');
  try {
    const root = g.root;
    if (root) { const p = root[name]; if (ok(p)) return p; }
  } catch { /* not a name this root knows */ }
  try { if (ok(g[name])) return g[name]; } catch { /* nothing there */ }
  return null;
}
