// world/inclinationslist.mjs — every inclination there is.
//
// The engine's Inclinations tab ends on a link to the complete list, a dialog
// of a passage that never shipped (InclinationsList); the long walk found the
// error it raised. This is that list: each inclination's name, whether it is
// the player's, set aside or not found yet, and what the world's writer wrote
// of it - what it is, and once found, what it does. Its hints on how each is
// found are not shown: some are still the original's, carrying markup the
// writer never reached (seen by tools/screens.mjs, v42). The words around the
// world's are Obscura's. The engine's own classes style it.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// What the writer has written; a field it has not reached, or one still
// holding the engine's markup, is nothing.
const written = (s) => (typeof s === 'string' && s.trim() && !/unwritten #\d+/.test(s) && !/<<|>>/.test(s) ? s.trim() : '');

// The table's entries; its methods (get, unlock_with_req...) are not inclinations.
export function inclinationNames(table) {
  if (!table || typeof table !== 'object') return [];
  return Object.keys(table).filter((k) => table[k] && typeof table[k] === 'object' && !Array.isArray(table[k]));
}

export function listHtml(table, { unlocked = {}, has = () => false } = {}) {
  const names = inclinationNames(table);
  if (!names.length) return '<p>No inclinations in this world yet.</p>';
  const items = names.map((name) => {
    const info = table[name];
    const found = !!(unlocked && unlocked[name] && unlocked[name].dreamed);
    let yours = false;
    try { yours = found && !!has(name); } catch { yours = false; }
    const status = yours ? '<span class="notice">Yours</span>' : found ? '<span class="ungood">Set aside</span>' : '<span class="ungood">Not found yet</span>';
    const description = written(info.description);
    const more = found && written(info.effects) ? `<span class="inclination-effects"><b>What it does:</b> ${esc(written(info.effects))}</span>` : '';
    return `<div class="inclination-item ${yours ? 'inclination-item-unlocked' : 'inclination-item-disabled'}">`
      + `<div class="inclination-header"><span class="inclination-title">${esc(name)}</span> <span class="inclination-status">${status}</span></div>`
      + (description ? `<span class="inclination-description">${esc(description)}</span><br>` : '')
      + more
      + '</div>';
  });
  return '<p>Every inclination this world holds. The ones you have found say what they do.</p>'
    + `<div class="inclination-container">${items.join('')}</div>`;
}

// setup.ob_inclinations_list_html, read by Obscura's InclinationsList; the
// player read at the moment the list opens, never held.
export function installInclinationsList({ SugarCube } = {}) {
  const setup = SugarCube && SugarCube.setup;
  if (!setup) return false;
  setup.ob_inclinations_list_html = () => {
    const V = (SugarCube.State && SugarCube.State.variables) || {};
    const pc = V.pc;
    return listHtml(setup.inclinations, {
      unlocked: V.inclinationsunlocked || {},
      has: (n) => !!(pc && typeof pc.has_inclination === 'function' && pc.has_inclination(n)),
    });
  };
  return true;
}
