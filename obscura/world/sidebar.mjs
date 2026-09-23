// world/sidebar.mjs — the sidebar, made ours.
//
// Side by side with the original, the chassis's sidebar was the same screen in
// different colours: the weather capsule and place frame side by side, the
// money and time rows, eight labelled green bars in two columns, and a
// two-column grid of text buttons in the same order. This rebuilds it as
// Obscura's own - a place card, chips, ring gauges and an icon dock - and does
// it by DECORATING the chassis's markup after it renders, never by replacing
// it. The caption is 41 KB of phone states, class timers and debug hooks;
// rewriting it is how a button quietly loses its action. Here every button is
// the chassis's own button, doing exactly what it did, wearing our icon.
//
// The decoration is idempotent and runs whenever the caption is redrawn: after
// every passage, and whenever the engine redraws the caption on its own.

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

const svg = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" `
  + `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

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

export function needTone(v) {
  if (!Number.isFinite(v)) return 'good';
  if (v >= 0.6) return 'good';
  if (v >= 0.3) return 'fair';
  return 'low';
}

// Buttons: an icon before the label, the label in its own span.
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
    const doc = btn.ownerDocument;
    if (!btn.querySelector('.phone-button-label')) {
      const lbl = doc.createElement('span');
      lbl.className = 'ob-lbl';
      while (btn.firstChild) lbl.appendChild(btn.firstChild);
      btn.appendChild(lbl);
    }
    const ico = doc.createElement('span');
    ico.className = 'ob-ico';
    ico.innerHTML = svg(ICONS[key]);
    btn.insertBefore(ico, btn.firstChild);
    n += 1;
  }
  return n;
}

// Gauges: each need's value (0 to 1) and tone on its tile; the CSS draws the
// ring. Read from the save, not from the bar's pixels.
function decorateMeters(root, vars) {
  let n = 0;
  const needs = (vars && vars.pcneeds) || {};
  for (const tile of root.querySelectorAll('#status-meters .status-meter-labeled')) {
    const labelEl = tile.querySelector('.status-meter-label');
    const name = labelEl ? labelEl.textContent.trim().split(/\s+/)[0] : '';
    const raw = needs[name];
    if (!name || typeof raw !== 'number') continue;
    const v = Math.max(0, Math.min(1, raw / 1000));
    tile.style.setProperty('--ob-v', v.toFixed(3));
    tile.dataset.obTone = needTone(v);
    tile.dataset.obNeed = name;
    n += 1;
  }
  return n;
}

// Chips: the money, time and date runs, each an icon and what follows it.
function decorateStats(root) {
  const box = root.querySelector('.essential-stats');
  if (!box || box.dataset.obChips) return 0;
  box.dataset.obChips = '1';
  const doc = box.ownerDocument;
  const row = doc.createElement('div');
  row.className = 'ob-chips';
  let chip = null;
  let n = 0;
  for (const node of [...box.childNodes]) {
    if (node.nodeType === 1 && node.classList.contains('essential-stats-class-status')) break;
    const isIcon = node.nodeType === 1 && node.tagName === 'IMG' && node.classList.contains('icon');
    if (isIcon) {
      chip = doc.createElement('span');
      chip.className = 'ob-chip';
      row.appendChild(chip);
      n += 1;
    }
    if (node.nodeType === 1 && (node.tagName === 'BR' || node.tagName === 'P')) { box.removeChild(node); chip = null; continue; }
    // the original spaced its rows with runs of &nbsp;, which would pad a chip
    if (node.nodeType === 3 && !node.textContent.trim()) { box.removeChild(node); continue; }
    if (chip) chip.appendChild(node);
  }
  if (n) box.insertBefore(row, box.firstChild);
  return n;
}

export function decorateSidebar(root, vars, opts = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return { buttons: 0, meters: 0, chips: 0 };
  return {
    buttons: decorateButtons(root, opts),
    meters: decorateMeters(root, vars),
    chips: decorateStats(root),
  };
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
