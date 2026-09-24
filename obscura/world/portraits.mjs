// world/portraits.mjs — the people have faces.
//
// The painter (world/painter.mjs) paints places and maps; nobody in the world
// had a face. A portrait is painted the same way - by Perchance's own
// text-to-image plugin, in the one shared queue, idle-only, cached per world -
// from the engine's own description of the person (its Person class: age, skin,
// hair, eyes, build) dressed for the world's period. Until it is painted, a
// plain silhouette stands in.
import { WORLD_ID_KEY } from './durable.mjs';
import { keyHash, premiseShort } from './painter.mjs';

// 96x128, stored at 2x with square pixels, like the places.
export const FACE_FRAME = { w: 96, h: 128, scale: 2, margin: 4 };
export const FACE_RESOLUTION = '512x768';
export const FACE_STYLE = 'pixel art character portrait, head and shoulders, facing the viewer, clean dark pixel '
  + 'outlines, flat colours, simple shading, centred, plain pure white background';
export const FACE_NEGATIVE = 'text, letters, words, watermark, signature, logo, frame, border, photo, photograph, '
  + 'photorealistic, 3d render, blurry, noisy, full body, hands, several people, crowd, nude';
// A grey head and shoulders, for a face not painted yet.
export const SILHOUETTE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 128"><rect width="96" height="128" fill="#1b1d22"/>'
  + '<circle cx="48" cy="50" r="22" fill="#3a3d45"/><path d="M10 128c2-30 18-44 38-44s36 14 38 44z" fill="#3a3d45"/></svg>',
)}`;

export const faceKey = (worldId, name, prompt) => `face|${worldId}|${name}|${keyHash(String(prompt || ''))}`;

const NOUN = { female: 'woman', male: 'man' };
const POSSESSIVE = { female: 'her', male: 'his' };

// The engine's age descriptor - "college" or "college-age" under 22, "early
// twenties", "elderly" - with the gender, in plain words.
export function personNoun(ageDesc, gender) {
  const g = NOUN[gender] || 'person';
  const d = String(ageDesc || '').trim();
  if (/^college/.test(d)) return `a young ${g}`;
  if (d === 'elderly') return `an elderly ${g}`;
  return d ? `a ${g} in ${POSSESSIVE[gender] || 'their'} ${d}` : `a ${g}`;
}

// What the painter needs, read off the engine's Person. A style the engine
// calls "unstyled" is no style; a shaved style is a shaved head.
export function lookOf(person, hairstyles = {}) {
  const get = (k) => (person && typeof person[k] === 'string' ? person[k].trim() : '');
  const call = (fn) => { try { return String((person && person[fn] && person[fn]()) || ''); } catch { return ''; } };
  const style = get('hair style');
  const info = hairstyles && hairstyles[style];
  let hair = '';
  if (info && info.shaved) hair = 'a shaved head';
  else if (get('hair length') || get('hair color')) {
    hair = `${[get('hair length'), get('hair color')].filter(Boolean).join(' ')} hair`;
    if (style && style !== 'unstyled') hair += `, ${style}`;
  }
  return { age: call('age_descriptor'), skin: get('skin color'), hair, eyes: get('eye color'), build: call('physique_descriptor') };
}

const andList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function portraitPrompt(look = {}, setting = '') {
  const noun = personNoun(look.age, look.gender);
  const withs = [look.skin && `${look.skin} skin`, look.eyes && `${look.eyes} eyes`, look.hair].filter(Boolean);
  const parts = [withs.length ? `${noun} with ${andList(withs)}` : noun];
  if (look.build) parts.push(`${look.build} build`);
  const when = premiseShort(setting);
  if (when) parts.push(`dressed as people are in ${when.charAt(0).toLowerCase()}${when.slice(1)}`);
  return `${parts.join(', ')}, ${FACE_STYLE}`;
}

// The world's period: the short premise's setting when there is one, else the
// premise.
export function settingOf(V) {
  const w = V && V.obscuraWorld;
  return (w && w.setting) || (V && V.obscuraPremise) || '';
}

export function faceFor(SC, name, PersonClass) {
  const V = (SC && SC.State && SC.State.variables) || {};
  let person;
  try { person = new PersonClass({ person: name }); } catch { return null; }
  let gender = '';
  try { gender = SC.setup.people.pronouns(name).gender; } catch { /* a person */ }
  const prompt = portraitPrompt({ ...lookOf(person, SC.setup && SC.setup.ob_hairstyles), gender }, settingOf(V));
  return { key: faceKey(V[WORLD_ID_KEY] || 'none', name, prompt), prompt };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// What each face on screen was asked to look like, by key, for the painter's
// job when it is asked for.
const prompts = new Map();
export const promptFor = (key) => prompts.get(key) || null;

export function faceMarkup(SC, name, opts = {}) {
  const PersonClass = opts.Person !== undefined ? opts.Person : (typeof window !== 'undefined' ? window.Person : null);
  const face = typeof PersonClass === 'function' ? faceFor(SC, name, PersonClass) : null;
  if (!face) return `<img class="ob-face" src="${SILHOUETTE}" alt="">`;
  prompts.set(face.key, face.prompt);
  return `<img class="ob-face" data-ob-face="${esc(face.key)}" src="${SILHOUETTE}" alt="">`;
}

const cssKey = (k) => String(k).replace(/["\\]/g, '\\$&');
let hooked = false;

// The page side, installed at boot. deps: SugarCube, document, jQuery,
// painter() -> the shared painter (world/painter.mjs) or null, enabled() -> the
// painting switch, Person (the engine's class; window.Person by default).
export function installPortraits(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const doc = deps.document !== undefined ? deps.document : (typeof document !== 'undefined' ? document : null);
  const $ = deps.jQuery !== undefined ? deps.jQuery : (typeof window !== 'undefined' ? window.jQuery : null);
  if (!SC || !doc || !$) return false;
  const painterOf = typeof deps.painter === 'function' ? deps.painter : () => deps.painter || null;
  const enabled = deps.enabled || (() => true);
  const PersonClass = deps.Person !== undefined ? deps.Person : (typeof window !== 'undefined' ? window.Person : null);

  const show = (key, url) => {
    for (const img of doc.querySelectorAll(`img[data-ob-face="${cssKey(key)}"]`)) {
      if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      if (img.classList) img.classList.add('ob-face-painted');
    }
  };
  let listening = null;
  const listen = (painter) => {
    if (painter === listening) return;
    painter.onPainted((key, url) => { if (String(key).startsWith('face|')) show(key, url); });
    listening = painter;
  };
  // Every face under root: shown from the store, or asked for.
  const fill = (root, priority) => {
    const painter = painterOf();
    if (!painter || !root) return;
    listen(painter);
    for (const img of root.querySelectorAll('img[data-ob-face]')) {
      const key = img.getAttribute('data-ob-face');
      Promise.resolve(painter.lookup(key)).then((url) => {
        if (url) { show(key, url); return; }
        // gone from the screen while the store was asked: not painted for nobody
        if (img.isConnected === false) return;
        const prompt = promptFor(key);
        if (!prompt || !enabled()) return;
        painter.request({ key, priority, prompt, frame: FACE_FRAME, resolution: FACE_RESOLUTION, negative: FACE_NEGATIVE });
      }).catch(() => { /* the silhouette stays */ });
    }
  };
  const nameOf = (who) => (typeof who === 'string' ? who : (who && (who.person || who.name)) || null);
  // The face of the profile on screen. A player clicking through the People
  // screen opens profile after profile: only the one in front of them waits
  // to be painted, and it is let go when the profile closes - each painting is
  // the player's data and the image service's time.
  let profileKey = null;
  const letGo = () => {
    const painter = painterOf();
    if (profileKey && painter && typeof painter.cancel === 'function') painter.cancel(profileKey);
    profileKey = null;
  };

  if (!hooked) {
    // a conversation: the face asked for ahead of everything else
    $(doc).on(':passagedisplay', () => fill(doc.getElementById('passages'), -1));
    // a profile: the face in the engine's own picture slot - the circle with
    // the initials, which it covers once painted - or at the top if the
    // profile has none; asked for after the place the player is in
    $(doc).on(':dialogopened', () => {
      const body = doc.getElementById('ui-dialog-body');
      if (!body || !body.classList.contains('view-person')) return;
      if (body.querySelector('.ob-face-profile') || body.querySelector('.npc-display-avatar .ob-face')) return;
      const V = SC.State.variables;
      const name = nameOf(V.npctodisplay);
      if (!name || !(V.people && V.people[name])) return;
      letGo();
      const face = typeof PersonClass === 'function' ? faceFor(SC, name, PersonClass) : null;
      const markup = faceMarkup(SC, name, { Person: PersonClass });
      const circle = body.querySelector('.npc-display-avatar');
      if (circle) circle.insertAdjacentHTML('beforeend', markup);
      else body.insertAdjacentHTML('afterbegin', `<div class="ob-face-profile">${markup}</div>`);
      profileKey = face && face.key;
      fill(body, 1);
    });
    $(doc).on(':dialogclosed', letGo);
    hooked = true;
  }
  return true;
}
