// world/community.mjs — feedback, comments, fullscreen, bug capture.
//
// The lists panel imports my console (nohbdy), the tabbed comments, the
// fullscreen button and the bug reporter, and until now nothing on the page
// used any of them. Every one is found where perchance.org puts an import -
// root (world/plugins.mjs) - and every one is optional: a copy without the
// import line loses the feature, never the game.
import { findPlugin, findPluginObject } from './plugins.mjs';

export const FEEDBACK_EMAIL = 'nohbdyai@gmail.com';
export const COMMENT_CHANNELS = ['general', 'worlds', 'feedback'];
const KINDS = new Set(['bug', 'idea', 'other']);

// Only what the player typed, capped to what the console keeps.
export function feedbackPayload(text, options = {}) {
  const body = String(text == null ? '' : text).trim().slice(0, 1000);
  if (!body) return null;
  const cat = String(options.cat == null ? '' : options.cat).trim();
  return {
    body,
    from: String(options.from == null ? '' : options.from).trim().slice(0, 80),
    cat: KINDS.has(cat) ? cat : 'other',
  };
}

export function createCommunity(deps = {}) {
  const find = (name) => findPlugin(name, deps.scope);
  let beacon = null;
  let captureStarted = false;

  // My console: one beacon a page. Making it is also how an arrival is
  // counted, so it is made at idle, after the game is up.
  const console$ = () => {
    if (beacon) return beacon;
    const factory = find('nohbdy');
    if (!factory) return null;
    try { beacon = factory({ host: 'obscura' }); } catch { beacon = null; }
    return beacon;
  };

  return {
    feedbackAvailable: () => !!find('nohbdy'),
    arrive() {
      const b = console$();
      if (b && b.ready && typeof b.ready.catch === 'function') b.ready.catch(() => {});
      return !!b;
    },
    async sendFeedback(text, options = {}) {
      const payload = feedbackPayload(text, options);
      if (!payload) { const e = new Error('empty'); e.code = 'empty'; throw e; }
      const b = console$();
      if (!b) { const e = new Error('no-console'); e.code = 'no-console'; throw e; }
      await b.ready;
      return b.feedback(payload.body, { from: payload.from, cat: payload.cat });
    },
    commentsElement() {
      const plugin = find('tabbedCommentsPlugin');
      if (!plugin) return null;
      // Characters are this plugin's option, not this game's: every way the
      // plugin's versions spell "off" is set.
      const off = {
        allowSpeakAsCharacter: false, hideSpeakAsCharacterButton: true, speakAsCharacter: false,
        characterMode: false, hideCharacterButton: true, hideAvatarPicker: true, userCharacters: false,
      };
      const channels = COMMENT_CHANNELS.map((n) => ({ getName: n, name: n, ...off }));
      try {
        return plugin({ channels, defaultChannelOptions: { submitButtonText: 'Send', ...off }, ...off });
      } catch { return null; }
    },
    startBugCapture() {
      if (captureStarted) return;
      captureStarted = true;
      const b = findPluginObject('bugReport', deps.scope);
      try { if (b && typeof b.initAutoErrorCapture === 'function') b.initAutoErrorCapture(); } catch { /* not the game's failure */ }
    },
    fullscreenMarkup() {
      const f = find('fullscreenButton');
      if (!f) return '';
      try { return String(f('&nbsp;Fullscreen&nbsp;', '&nbsp;Exit&nbsp;') || ''); } catch { return ''; }
    },
  };
}

// ---- the page ---------------------------------------------------------------

const h = (doc, tag, cls, text) => {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// The feedback form, in a SugarCube dialog. Mine, so first person.
export function openFeedback(community, deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  if (!SC || !doc) return false;
  SC.Dialog.setup('Feedback', 'ob-feedback-dialog');
  const body = SC.Dialog.body();
  const box = h(doc, 'div', 'ob-feedback');
  box.appendChild(h(doc, 'p', 'ob-feedback-intro',
    'A bug, an idea, something that read wrong: it comes straight to me. Nothing from your game is sent, only what you type here.'));
  const cat = h(doc, 'select', 'ob-feedback-cat');
  for (const [v, label] of [['bug', 'A bug'], ['idea', 'An idea'], ['other', 'Something else']]) {
    const o = h(doc, 'option', null, label); o.value = v; cat.appendChild(o);
  }
  const text = h(doc, 'textarea', 'ob-feedback-text');
  text.maxLength = 1000; text.rows = 6;
  text.placeholder = 'What happened, or what you would want.';
  const from = h(doc, 'input', 'ob-feedback-from');
  from.type = 'text'; from.maxLength = 80;
  from.placeholder = 'Email or a Reddit name, only if you want an answer';
  const status = h(doc, 'div', 'ob-feedback-status');
  status.setAttribute('aria-live', 'polite');
  const send = h(doc, 'button', 'macro-button ob-feedback-send', 'Send');
  send.type = 'button';
  const mail = h(doc, 'div', 'ob-feedback-mail');
  mail.append('Or email me at ');
  const a = h(doc, 'a', null, FEEDBACK_EMAIL); a.href = `mailto:${FEEDBACK_EMAIL}`;
  mail.append(a, '.');
  const label = (t, el) => { const l = h(doc, 'label', 'ob-feedback-label', t); l.appendChild(el); return l; };
  box.append(label('What is it', cat), label('Your note', text), label('How I can reach you (optional)', from), status, send, mail);
  body.appendChild(box);
  if (!community.feedbackAvailable()) status.textContent = 'The direct line is not available in this copy, so the email below is the way to reach me.';
  send.addEventListener('click', async () => {
    if (!text.value.trim()) { status.textContent = 'Say something first.'; text.focus(); return; }
    if (!community.feedbackAvailable()) { status.textContent = `Email me at ${FEEDBACK_EMAIL} instead; your note is still in the box.`; return; }
    send.disabled = true; send.textContent = 'Sending...'; status.textContent = '';
    try {
      await community.sendFeedback(text.value, { from: from.value, cat: cat.value });
      text.value = '';
      status.textContent = 'Sent. Thank you - I read every one.';
    } catch (e) {
      status.textContent = e && e.code === 'rate' ? 'A moment between messages, please.'
        : `It did not go through. Email me at ${FEEDBACK_EMAIL} instead; your note is still in the box.`;
    } finally { send.disabled = false; send.textContent = 'Send'; }
  });
  SC.Dialog.open();
  setTimeout(() => { try { text.focus(); } catch { /* fine */ } }, 60);
  return true;
}

export function openComments(community, deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  if (!SC || !doc) return false;
  SC.Dialog.setup('Comments', 'ob-comments-dialog');
  const el = community.commentsElement();
  if (el) SC.Dialog.body().appendChild(el);
  else SC.Dialog.body().appendChild(h(doc, 'p', null, 'Comments are not available in this copy.'));
  SC.Dialog.open();
  return true;
}

// Installed once at boot: bug capture now, my console at idle, the
// fullscreen button in the sidebar's tray, and setup.ob_open_feedback /
// setup.ob_open_comments for the passages and the sidebar to call.
let installed = null;
export function installCommunity(deps = {}) {
  if (installed) return installed;
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  const community = createCommunity(deps);
  community.startBugCapture();
  if (SC && SC.setup) {
    SC.setup.ob_open_feedback = () => openFeedback(community, deps);
    SC.setup.ob_open_comments = () => openComments(community, deps);
  }
  const later = () => { try { community.arrive(); } catch { /* not the game's failure */ } };
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(later, { timeout: 20000 });
      else later();
    }, 8000);
  }
  const tray = doc && doc.getElementById ? doc.getElementById('ui-bar-tray') : null;
  const markup = community.fullscreenMarkup();
  if (tray && markup && !doc.getElementById('ob-fullscreen')) {
    const host = h(doc, 'span', 'ob-fullscreen');
    host.id = 'ob-fullscreen';
    host.innerHTML = markup; // the first-party plugin's own markup, not a player's
    tray.appendChild(host);
  }
  installed = community;
  return community;
}
