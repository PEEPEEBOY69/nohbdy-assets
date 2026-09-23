// world/premise.mjs — "What kind of world?", properly.
//
// The premise screen was a one-line text box. A world can now start from a
// line, a paragraph, one of the examples, or a whole world brought in - a
// lorebook or a page of notes - and it can come with people: character cards
// or plain descriptions, made into people when the world exists
// (world/cast.mjs). Everything read here is read locally (world/imports.mjs).
import { readImport } from './imports.mjs';

export const EXAMPLES = [
  'a rain-dark port city of debts and favours, run by three rival guilds',
  'a fishing village in Edo-period Japan, where the tide brings strangers',
  '1920s Harlem: jazz clubs, rent parties and a speakeasy under the laundry',
  'a generation ship three hundred years out, where the lower decks keep their own rules',
  'a sleepy Texas town in 1955 with a drive-in, a diner and a secret',
  'a snowbound boarding school for magic, cut off from the world until spring',
  'modern Seoul: a talent agency, its trainees and the people who own them',
  'a Norse trading town at the edge of winter, a century before the sagas',
];

// What a save and a prompt can carry without either suffering.
export const LIMITS = { lore: 60, loreChars: 40000, characters: 8, profile: 2000, premise: 1500 };

export function newPremiseState(premise) {
  return { premise: String(premise || ''), world: { title: '', setting: '', lore: [] }, characters: [] };
}

export function addWorld(state, model) {
  if (!model) return state;
  if (model.title && !state.world.title) state.world.title = String(model.title).slice(0, 90);
  if (model.setting) state.world.setting = [state.world.setting, model.setting].filter(Boolean).join('\n\n');
  for (const e of model.lore || []) state.world.lore.push(e);
  for (const c of model.characters || []) state.characters.push(c);
  return state;
}

// A card brings a person, and whatever book and scenario ride with it belong
// to the world.
export function addCharacters(state, model) {
  if (!model) return state;
  for (const c of model.characters || []) state.characters.push(c);
  if (model.setting) state.world.setting = [state.world.setting, model.setting].filter(Boolean).join('\n\n');
  for (const e of model.lore || []) state.world.lore.push(e);
  return state;
}

// Pasted descriptions: one person per block, a short first line is the name.
export function charactersFromText(src) {
  const out = [];
  for (const block of String(src || '').split(/\n\s*\n/)) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const name = lines[0].replace(/[:\-–—]+$/, '').trim();
    if (!name || name.length > 60 || /[.!?]$/.test(name)) continue;
    out.push({ name, profile: lines.slice(1).join('\n') });
  }
  return out;
}

export function buildPayload(state) {
  const lore = [];
  let chars = 0;
  for (const e of state.world.lore) {
    if (lore.length >= LIMITS.lore) break;
    const content = String(e.content || '').slice(0, 2000);
    if (chars + content.length > LIMITS.loreChars) break;
    chars += content.length;
    lore.push({ title: String(e.title || 'Lore').slice(0, 90), content, keys: (e.keys || []).slice(0, 12), constant: !!e.constant });
  }
  const premise = String(state.premise || '').trim().slice(0, LIMITS.premise) || state.world.title || '';
  return {
    premise,
    import: {
      title: state.world.title,
      setting: String(state.world.setting || '').slice(0, 3000),
      lore,
      characters: state.characters.slice(0, LIMITS.characters).map(c => ({
        name: String(c.name || '').slice(0, 60),
        profile: String(c.profile || '').slice(0, LIMITS.profile),
        portraitUrl: /^https:\/\/\S+$/i.test(String(c.portraitUrl || '')) ? c.portraitUrl : '',
      })),
    },
  };
}

// ---- the page -------------------------------------------------------------
const el = (doc, tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

async function readFile(file) {
  const isPng = /\.png$/i.test(file.name) || file.type === 'image/png';
  if (isPng) return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
  return { name: file.name, text: await file.text() };
}

export function createPremiseScreen(host, deps = {}) {
  const doc = deps.document || host.ownerDocument;
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  // read when used: SugarCube gives every move a new variables object
  const vars = () => (SC ? SC.State.variables : (deps.vars || {}));
  const state = newPremiseState(vars().obscuraPremise || '');
  host.textContent = '';
  const root = el(doc, 'div', 'ob-premise');

  const lead = el(doc, 'p', 'ob-premise-lead', 'Describe it in a line or a paragraph. Everything in it is built from this.');
  const text = el(doc, 'textarea', 'ob-premise-text');
  text.rows = 3; text.maxLength = LIMITS.premise; text.value = state.premise;
  text.placeholder = EXAMPLES[0];
  text.addEventListener('input', () => { state.premise = text.value; });

  const ex = el(doc, 'div', 'ob-premise-examples');
  ex.appendChild(el(doc, 'span', 'ob-premise-examples-label', 'Or start from one of these:'));
  for (const e of EXAMPLES) {
    const chip = el(doc, 'button', 'ob-premise-example', e);
    chip.type = 'button';
    chip.addEventListener('click', () => { text.value = e; state.premise = e; text.focus(); });
    ex.appendChild(chip);
  }

  const note = el(doc, 'div', 'ob-premise-note');
  note.setAttribute('aria-live', 'polite');
  const say = (s) => { note.textContent = s; };

  // bring a world
  const worldBox = el(doc, 'details', 'ob-import');
  worldBox.appendChild(el(doc, 'summary', null, 'Bring your own world: a lorebook or notes'));
  worldBox.appendChild(el(doc, 'p', 'ob-import-help', 'A SillyTavern or Chub lorebook (.json), or plain notes - one entry per paragraph. It becomes the world, and the place names, people and prose are built from it.'));
  const worldFile = el(doc, 'input', 'ob-import-file');
  worldFile.type = 'file'; worldFile.accept = '.json,.txt,.md,.png';
  const worldPaste = el(doc, 'textarea', 'ob-import-paste');
  worldPaste.rows = 4; worldPaste.placeholder = '...or paste it here';
  const worldUse = el(doc, 'button', 'macro-button ob-import-use', 'Use this');
  worldUse.type = 'button';
  const worldList = el(doc, 'div', 'ob-import-list');
  worldBox.append(worldFile, worldPaste, worldUse, worldList);

  // bring people
  const castBox = el(doc, 'details', 'ob-import');
  castBox.appendChild(el(doc, 'summary', null, 'Bring characters: cards or descriptions'));
  castBox.appendChild(el(doc, 'p', 'ob-import-help', `Character cards (.png or .json), or plain descriptions - a name on the first line, then who they are. Up to ${LIMITS.characters}. They will be in your world, and you will know them.`));
  const castFile = el(doc, 'input', 'ob-import-file');
  castFile.type = 'file'; castFile.accept = '.png,.json,.txt'; castFile.multiple = true;
  const castPaste = el(doc, 'textarea', 'ob-import-paste');
  castPaste.rows = 4; castPaste.placeholder = 'Mireille\nA night-market fixer with red hair and no patience.';
  const castUse = el(doc, 'button', 'macro-button ob-import-use', 'Add them');
  castUse.type = 'button';
  const castList = el(doc, 'div', 'ob-import-list');
  castBox.append(castFile, castPaste, castUse, castList);

  const build = el(doc, 'button', 'macro-button ob-premise-build', 'Build it');
  build.type = 'button';

  const render = () => {
    worldList.textContent = '';
    if (state.world.title || state.world.lore.length) {
      const row = el(doc, 'div', 'ob-import-row', `${state.world.title || 'Your world'} - ${state.world.lore.length} entr${state.world.lore.length === 1 ? 'y' : 'ies'}`);
      const x = el(doc, 'button', 'ob-import-remove', 'Remove');
      x.type = 'button';
      x.addEventListener('click', () => { state.world = { title: '', setting: '', lore: [] }; render(); });
      row.appendChild(x);
      worldList.appendChild(row);
    }
    castList.textContent = '';
    state.characters.forEach((c, i) => {
      const row = el(doc, 'div', 'ob-import-row', `${c.name} - ${String(c.profile || '').split(/[.\n]/)[0].slice(0, 80)}`);
      const x = el(doc, 'button', 'ob-import-remove', 'Remove');
      x.type = 'button';
      x.addEventListener('click', () => { state.characters.splice(i, 1); render(); });
      row.appendChild(x);
      castList.appendChild(row);
    });
  };

  worldFile.addEventListener('change', async () => {
    for (const f of worldFile.files || []) {
      try {
        const model = readImport(await readFile(f));
        if (!model.lore.length && !model.characters.length) { say(`Nothing I could use in ${f.name}.`); continue; }
        addWorld(state, model);
        say(`${f.name}: ${model.lore.length} entr${model.lore.length === 1 ? 'y' : 'ies'}${model.characters.length ? `, ${model.characters.length} character(s)` : ''}.`);
      } catch { say(`I could not read ${f.name}.`); }
    }
    worldFile.value = '';
    render();
  });
  worldUse.addEventListener('click', () => {
    const src = worldPaste.value.trim();
    if (!src) return;
    const model = readImport({ name: '', text: src });
    addWorld(state, model);
    worldPaste.value = '';
    say(`Added ${model.lore.length} entr${model.lore.length === 1 ? 'y' : 'ies'}.`);
    render();
  });
  castFile.addEventListener('change', async () => {
    for (const f of castFile.files || []) {
      try {
        const got = await readFile(f);
        const model = readImport(got);
        const before = state.characters.length;
        if (model.characters.length) addCharacters(state, model);
        else if (got.text) addCharacters(state, { characters: charactersFromText(got.text), lore: [] });
        if (state.characters.length === before) say(`No character in ${f.name}.`);
        else say(`Added ${state.characters.slice(before).map(c => c.name).join(', ')}.`);
      } catch { say(`I could not read ${f.name}.`); }
    }
    castFile.value = '';
    render();
  });
  castUse.addEventListener('click', () => {
    const src = castPaste.value.trim();
    if (!src) return;
    let model = readImport({ name: '', text: src });
    if (!model.characters.length) model = { characters: charactersFromText(src), lore: [] };
    if (!model.characters.length) { say('Put a name on the first line, then who they are.'); return; }
    addCharacters(state, model);
    say(`Added ${model.characters.map(c => c.name).join(', ')}.`);
    castPaste.value = '';
    render();
  });

  build.addEventListener('click', () => {
    state.premise = text.value;
    // An empty box with nothing brought builds the example it shows, so
    // pressing Build straight away still makes a world. With a world brought
    // in, an empty box means that world and nothing else.
    const brought = state.world.lore.length || state.world.setting || state.characters.length;
    if (!state.premise.trim() && !brought) state.premise = text.placeholder || EXAMPLES[0];
    const payload = buildPayload(state);
    if (!payload.premise) { say('Describe a world first, or bring one.'); text.focus(); return; }
    const V = vars();
    V.obscuraPremise = payload.premise;
    V.obscuraImport = payload.import;
    if (SC && SC.Engine) SC.Engine.play('ObscuraBuilding');
  });

  root.append(lead, text, ex, worldBox, castBox, note, build);
  host.appendChild(root);
  render();
  return { state, render };
}

// The passage's <<run>> happens before the passage is on the page, so the
// screen is drawn a moment later, into whatever holds the id by then.
export function installPremiseHook(deps = {}) {
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  if (!SC || !SC.setup) return false;
  SC.setup.ob_premise_screen = (id) => {
    setTimeout(() => {
      const host = typeof document !== 'undefined' ? document.getElementById(id) : null;
      if (host) createPremiseScreen(host, deps);
    }, 0);
  };
  return true;
}
