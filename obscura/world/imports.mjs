// world/imports.mjs — a lorebook as a world, characters as people in it.
//
// Players arrive with files: a SillyTavern or Chub character card (a PNG with
// the JSON hidden in it, or the JSON itself), a lorebook exported from one of
// the usual places, or a page of notes. This reads them - locally, with no
// network, and without trusting the file - into one shape the premise screen
// and the build are written against:
//
//   { kind: 'character' | 'lorebook', title, setting,
//     characters: [{ name, profile, portraitUrl }], lore: [{ title, content, keys, constant }],
//     skipped: [what could not be used, said out loud] }

// ---- the PNG card ---------------------------------------------------------
// A plain walk of the chunk layout - an 8-byte signature, then repeating
// [length u32 big-endian][type 4 ascii][data][crc u32] - reading only the
// chunk it wants. The declared length is the untrusted number in this format,
// so every step is checked against the end of the buffer.
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export function readPngTextChunk(bytes, wanted) {
  const data = ArrayBuffer.isView(bytes) ? bytes : new Uint8Array(bytes || []);
  if (data.length < 8) return null;
  for (let i = 0; i < PNG_SIGNATURE.length; i++) if (data[i] !== PNG_SIGNATURE[i]) return null;
  let at = 8;
  while (at + 8 <= data.length) {
    const length = ((data[at] << 24) >>> 0) + (data[at + 1] << 16) + (data[at + 2] << 8) + data[at + 3];
    const type = String.fromCharCode(data[at + 4], data[at + 5], data[at + 6], data[at + 7]);
    const start = at + 8;
    const end = start + length;
    if (end > data.length) return null;
    if (type === 'IEND') return null;
    if (type === 'tEXt') {
      let split = start;
      while (split < end && data[split] !== 0) split++;
      let keyword = '';
      for (let k = start; k < split; k++) keyword += String.fromCharCode(data[k]);
      if (keyword === wanted) {
        let value = '';
        for (let v = split + 1; v < end; v++) value += String.fromCharCode(data[v]);
        return value;
      }
    }
    at = end + 4;
  }
  return null;
}

// The card's JSON text, or null. The base64 is checked before decoding: the
// browser throws on bad base64 and Node decodes garbage, and a card that reads
// differently depending on where it runs is worse than no card.
export function cardTextFromPng(bytes) {
  const encoded = readPngTextChunk(bytes, 'chara');
  if (!encoded) return null;
  const clean = encoded.replace(/\s+/g, '');
  if (!clean || clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return null;
  try {
    const binary = typeof atob === 'function' ? atob(clean) : Buffer.from(clean, 'base64').toString('binary');
    const utf8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) utf8[i] = binary.charCodeAt(i) & 0xff;
    return new TextDecoder('utf-8').decode(utf8);
  } catch { return null; }
}

// ---- character cards ------------------------------------------------------
// v2 and v3 nest the card under `data`; v1 is the bare object. A card is known
// by carrying a field only a card has, not by a version field it may not have.
export function cardPayload(node) {
  if (!node || typeof node !== 'object') return null;
  const inner = node.data && typeof node.data === 'object' ? node.data : node;
  const name = String(inner.name || inner.char_name || '').trim();
  if (!name) return null;
  const cardish = ['description', 'personality', 'first_mes', 'mes_example', 'scenario', 'char_persona'];
  if (!cardish.some(k => String(inner[k] || '').trim())) return null;
  return inner;
}

const text = (v) => String(v == null ? '' : v).trim();

// What a person IS: description and personality. The greeting, the example
// chats and the author's advice to a model are a chat app's scaffolding, not
// facts about someone, and are left out. The scenario frames a world, so it
// goes to the world.
export function characterFromCard(card) {
  const inner = cardPayload(card);
  const out = { character: null, setting: '', lore: [], skipped: [] };
  if (!inner) return out;
  const avatar = text(inner.avatar || (card && card.avatar));
  out.character = {
    name: text(inner.name || inner.char_name).slice(0, 90),
    profile: [text(inner.description) || text(inner.char_persona), text(inner.personality)].filter(Boolean).join('\n\n'),
    portraitUrl: /^https:\/\/\S+$/i.test(avatar) ? avatar.slice(0, 2048) : '',
  };
  out.setting = text(inner.scenario || inner.world_scenario);
  const book = inner.character_book || (card && card.character_book);
  for (const e of book && Array.isArray(book.entries) ? book.entries : []) {
    const item = e && typeof e === 'object' ? e : {};
    const content = text(item.content || item.text);
    const title = text(item.name || item.comment);
    if (!content) { out.skipped.push(title || 'an entry with no text'); continue; }
    out.lore.push({ title: title || 'Lore', content, keys: keysOf(item), constant: item.constant === true });
  }
  return out;
}

const keysOf = (item) => [].concat(item.keys || item.key || []).map(v => text(v)).filter(Boolean).slice(0, 20);

// ---- lorebooks --------------------------------------------------------------
// SillyTavern keeps entries in an object keyed by id; Chub and NovelAI in an
// array; NovelAI calls the text `text` and the title `displayName`.
export function loreFromJson(json) {
  const out = { title: text(json && (json.name || json.title)), lore: [], skipped: [] };
  const raw = json && json.entries;
  const entries = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
  for (const e of entries) {
    const item = e && typeof e === 'object' ? e : {};
    const content = text(item.content || item.text);
    const title = text(item.comment || item.name || item.displayName || item.title);
    if (!content) { out.skipped.push(title || 'an entry with no text'); continue; }
    out.lore.push({ title: title || 'Lore', content, keys: keysOf(item), constant: item.constant === true });
  }
  return out;
}

// Notes: one entry per block of lines. A short first line is the title, and a
// "Keys:" line is the keys.
export function loreFromText(src) {
  const out = { title: '', lore: [], skipped: [] };
  for (const block of String(src || '').split(/\n\s*\n/)) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    let title = '';
    if (lines.length > 1 && lines[0].length <= 60 && !/[.!?]$/.test(lines[0])) title = lines.shift().replace(/:$/, '');
    let keys = [];
    const k = lines.findIndex(l => /^keys?\s*:/i.test(l));
    if (k !== -1) { keys = lines[k].replace(/^keys?\s*:/i, '').split(',').map(s => s.trim()).filter(Boolean); lines.splice(k, 1); }
    const content = lines.join('\n').trim();
    if (!content) continue;
    out.lore.push({ title: title || content.split(/[.!?\n]/)[0].slice(0, 60), content, keys: keys.length ? keys : (title ? [title] : []), constant: false });
  }
  return out;
}

// ---- one door for every file --------------------------------------------
export function readImport(file) {
  const name = String((file && file.name) || '');
  const model = { kind: 'lorebook', title: '', setting: '', characters: [], lore: [], skipped: [] };
  let body = file && typeof file.text === 'string' ? file.text : null;
  if (file && file.bytes && (/\.png$/i.test(name) || !body)) {
    const cardText = cardTextFromPng(file.bytes);
    if (!cardText) { model.skipped.push(`${name || 'the picture'}: no character card inside`); return model; }
    body = cardText;
  }
  let json = null;
  if (body != null && /^\s*[{[]/.test(body)) { try { json = JSON.parse(body); } catch { json = null; } }
  if (json && cardPayload(json)) {
    const c = characterFromCard(json);
    model.kind = 'character';
    model.title = c.character.name;
    model.setting = c.setting;
    model.characters.push(c.character);
    model.lore = c.lore;
    model.skipped = c.skipped;
    return model;
  }
  if (json && json.entries) {
    const l = loreFromJson(json);
    model.title = l.title || name.replace(/\.[a-z]+$/i, '');
    model.lore = l.lore;
    model.skipped = l.skipped;
    return model;
  }
  const t = loreFromText(body || '');
  // a file is called by its name; pasted notes by their first entry
  model.title = name ? name.replace(/\.[a-z]+$/i, '') : (t.lore[0] ? t.lore[0].title : '');
  model.lore = t.lore;
  return model;
}

// ---- the world, from its lore --------------------------------------------
// What every prompt carries as the premise, bounded: the title, the setting,
// what is always true (constant entries), then as much of the rest as fits,
// shortest first so more of the world makes it in.
export function worldBriefFrom(model, max = 1400) {
  const parts = [];
  const add = (s) => {
    const t = text(s);
    if (!t) return;
    const room = max - parts.join('\n').length - (parts.length ? 1 : 0);
    if (room <= 20) return;
    parts.push(t.length > room ? `${t.slice(0, room - 1).replace(/\s+\S*$/, '')}…` : t);
  };
  add(model.title);
  add(model.setting);
  const lore = model.lore || [];
  for (const e of lore.filter(e => e.constant)) add(`${e.title}: ${e.content}`);
  for (const e of lore.filter(e => !e.constant).sort((a, b) => a.content.length - b.content.length)) add(`${e.title}: ${e.content}`);
  return parts.join('\n').slice(0, max);
}
