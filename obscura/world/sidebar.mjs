// world/sidebar.mjs — which sidebar button is which.
//
// Side by side with the original, the sidebar was the same screen in different
// colours. It keeps the original's STYLE on purpose - its grey (a notch darker
// and cooler), its green loading bars, its table grid of uppercase buttons -
// and is made Obscura's by its LAYOUT: the theme's CSS reorders the sections
// and regroups the buttons. CSS can place a button but cannot tell which button
// it is, so this tags each one by what it says (data-ob-ico) after the caption
// renders. Nothing else is touched: every button is the chassis's own button
// with its own action.
//
// (An earlier pass also replaced the bars with rings and the buttons with an
// icon dock. That read as generated, not as the game, and was taken out; the
// icon set stays because the phone's home screen uses it.)

// Our own line icons, 24x24, drawn with the text colour.
export const ICONS = {
  bag: 'M6 8h12l-1 12H7L6 8z M9 8V6.5a3 3 0 0 1 6 0V8',
  phone: 'M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3z M11 18h2',
  hanger: 'M12 8a2 2 0 1 1 2-2 M12 8v1.5 L3 17.5h18L12 9.5',
  hourglass: 'M7 3h10 M7 21h10 M8 3c0 5 8 5.5 8 9s-8 4-8 9 M16 3c0 5-8 5.5-8 9s8 4 8 9',
  person: 'M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M5 20.5c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3.5 20c0-3.3 2.4-5.5 5.5-5.5s5.5 2.2 5.5 5.5 M16 11a2.6 2.6 0 1 0 0-5.2 M17 14.6c2.2.4 3.5 2.3 3.5 5.4',
  building: 'M3.5 20.5h17 M5 20.5V9.5l7-5 7 5v11 M9.5 20.5v-5h5v5 M9 11.5h1 M14 11.5h1',
  bulb: 'M9.5 18h5 M10.5 21h3 M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z',
  map: 'M3.5 6.5l5.5-3 6 3 5.5-3v14l-5.5 3-6-3-5.5 3z M9 3.5v14 M15 6.5v14',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1',
  heart: 'M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z',
  question: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.6 M12 16.8v.1',
  disk: 'M5 3.5h11l3 3v14H5z M8 3.5v5h7v-5 M8 20.5v-6h8v6',
};

// What a button IS, from what it says. The institution's button is named by the
// world's vocabulary, so its word comes in as `institutionWord`.
export function iconKey(label, opts = {}) {
  const t = String(label || '').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return null;
  const first = t.split(' ')[0];
  const table = {
    inventory: 'bag', phone: 'phone', outfit: 'hanger', wait: 'hourglass', character: 'person',
    people: 'people', hints: 'bulb', hint: 'bulb', maps: 'map', map: 'map', options: 'gear',
    support: 'heart', help: 'question', save: 'disk', college: 'building', institute: 'building',
  };
  if (table[first]) return table[first];
  const word = String(opts.institutionWord || '').toLowerCase().trim();
  if (word && (t === word || t.endsWith(` ${word}`) || t.startsWith(word))) return 'building';
  return null;
}

// Buttons: tagged by what they are, for the theme's order rules. The tooltip
// names the button, since a regrouped grid is easier to scan with one.
function decorateButtons(root, opts) {
  let n = 0;
  for (const btn of root.querySelectorAll('.storymenu-button-container button')) {
    if (btn.dataset.obIco) continue;
    if (btn.classList.contains('phone-dropdown-arrow') || btn.classList.contains('phone-shortcut')) continue;
    const label = (btn.querySelector('.phone-button-label') || btn).textContent;
    const key = iconKey(label, opts);
    if (!key) continue;
    btn.dataset.obIco = key;
    if (!btn.getAttribute('title')) btn.setAttribute('title', label.replace(/\s+/g, ' ').trim());
    n += 1;
  }
  return n;
}

// Feedback and Comments, beside Save, Options, Help and Support: the last
// button block, which is there from the first screen of character creation.
// The sidebar is drawn again on every passage, so this runs every time and
// adds only what is missing.
export function addCommunityButtons(root, deps = {}) {
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  const setup = deps.setup || (typeof window !== 'undefined' && window.SugarCube ? window.SugarCube.setup : null);
  if (!doc || !root || typeof root.querySelectorAll !== 'function') return 0;
  const blocks = root.querySelectorAll('.storymenu-button-block');
  const block = blocks[blocks.length - 1];
  if (!block) return 0;
  let added = 0;
  for (const [ico, label, fn] of [['feedback', 'Feedback', 'ob_open_feedback'], ['comments', 'Comments', 'ob_open_comments']]) {
    if (block.querySelector(`[data-ob-ico="${ico}"]`)) continue;
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'macro-button link-internal ob-community';
    b.dataset.obIco = ico;
    b.textContent = label;
    b.setAttribute('title', label);
    b.addEventListener('click', () => { try { if (setup && typeof setup[fn] === 'function') setup[fn](); } catch { /* not the sidebar's failure */ } });
    // the same wrapper the chassis gives its own buttons, so they are styled
    // and placed by the same rules
    const wrap = doc.createElement('div');
    wrap.className = 'storymenu-button-container';
    wrap.appendChild(b);
    block.appendChild(wrap);
    added += 1;
  }
  return added;
}

export function decorateSidebar(root, vars, opts = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return { buttons: 0 };
  const buttons = decorateButtons(root, opts);
  addCommunityButtons(root, opts);
  return { buttons };
}

// Installed once at boot. deps: document, SugarCube, jQuery (optional),
// institutionWord() - the world's word for the institution.
let installedSidebar = null;

export function installSidebar(deps = {}) {
  if (installedSidebar) return installedSidebar;
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  if (!doc) return null;
  const vars = () => (SC && SC.State && SC.State.variables) || {};
  let busy = false;
  const run = () => {
    if (busy) return null;
    busy = true;
    try {
      const root = doc.getElementById('story-caption');
      return decorateSidebar(root, vars(), { institutionWord: deps.institutionWord ? deps.institutionWord() : '' });
    } finally { busy = false; }
  };
  const $ = deps.jQuery !== undefined ? deps.jQuery : (typeof window !== 'undefined' ? window.jQuery : null);
  if ($) $(doc).on(':passageend', run);
  else if (doc.addEventListener) doc.addEventListener(':passageend', run);
  const caption = doc.getElementById && doc.getElementById('story-caption');
  if (caption && typeof MutationObserver === 'function') {
    new MutationObserver(() => run()).observe(caption, { childList: true, subtree: true });
  }
  run();
  installedSidebar = { run };
  return installedSidebar;
}
