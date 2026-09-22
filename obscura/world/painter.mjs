// world/painter.mjs — the player's world, painted by Perchance itself.
//
// The shipped place pictures are rooms from the original map: a laundry room,
// a lecture hall, a street. They are the right STYLE and the wrong WORLD - a
// caveman world has no laundry room. So each place is painted for the world
// the player described, by Perchance's own text-to-image plugin, and the
// shipped room only holds the frame until that picture exists.
//
// What the plugin does was read from its source, not assumed:
//   - `await textToImage({prompt, negativePrompt, resolution})` resolves to a
//     String carrying .dataUrl. Called from code, the plugin adds its own
//     hidden iframe after 150 ms and removes it when done.
//   - referenceImage is disabled server-side: no img2img, so the style is
//     carried by the prompt (STYLE) and by world/pixels.mjs, which cuts the
//     picture into the same frame as the shipped rooms.
//   - a call can hang: a check in a hidden frame has no one to answer it. So
//     every call has a timeout, and a failure is remembered, never looped.
//
// The scheduling rule is the living world's: IDLE ONLY. A picture starts only
// when the text queue is empty and no other picture is in flight. The current
// place goes first, then the places one step away.
import { buildPersona, faultsIn as defaultFaults } from './persona.mjs';
import { keyOutBackground, alphaBox, fitInto, hardenAlpha, FRAME_W, FRAME_H, SCALE } from './pixels.mjs';
import { placesIn, exitsOf } from './hub.mjs';
import { displayName } from './places.mjs';
import { WORLD_ID_KEY } from './durable.mjs';
import { parseModelJson } from './safejson.mjs';

export const STYLE = 'isometric pixel art game asset, a small cutaway diorama of one place seen from above at an '
  + 'angle, diamond-shaped floor, clean dark pixel outlines, flat bright colours, simple shading, centred, plain '
  + 'pure white background';
export const NEGATIVE = 'text, letters, words, watermark, signature, logo, people, person, character, face, crowd, '
  + 'nude, photo, photograph, photorealistic, 3d render, blurry, noisy, frame, border, user interface';
export const RESOLUTION = '512x512';
export const MAX_LOOK = 160;
export const LOOKS_PER_CALL = 30;

// FNV-1a, for keys only: a renamed place must not reuse its old picture.
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export const pictureKey = (worldId, placeKey, name) => `pic|${worldId}|${placeKey}|${hash(String(name || ''))}`;
export const lookKey = (worldId, placeKey, name) => `look|${worldId}|${placeKey}|${hash(String(name || ''))}`;

// The first sentence of the premise, short: the look carries the world when
// there is one, and this only stands in when there is not.
function premiseShort(premise) {
  const s = String(premise || '').trim().split(/(?<=[.!?])\s/)[0] || '';
  return s.replace(/[.!?]+$/, '').slice(0, 120);
}

export function paintPrompt({ look, name, premise } = {}) {
  const subject = look
    ? String(look).trim()
    : [name, premiseShort(premise) && `in ${premiseShort(premise)}`].filter(Boolean).join(', ');
  return `${subject}, ${STYLE}`;
}

export function buildLooksPrompt(persona, batch) {
  return [
    persona,
    '',
    'TASK',
    'An illustrator will paint each of these places as it is in THIS world. For each one, say what it LOOKS like:',
    'the room or the ground, the main objects in it, what they are made of, the light.',
    '',
    'RULES',
    '- Reply with ONLY a JSON object. No prose, no markdown, no code fences.',
    '- Use each place\'s NUMBER as the key, as a string: {"1": "...", "2": "..."}.',
    `- One line per place, under ${MAX_LOOK} characters. Concrete things only.`,
    '- No people, no events, no story. Only the place.',
    '',
    'PLACES',
    ...batch.map((p, i) => `${i + 1}. ${p.name}`),
  ].join('\n');
}

export function parseLooks(text, batch, faultsIn = defaultFaults) {
  const looks = {};
  const raw = String(text == null ? '' : text);
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const a = body.indexOf('{');
  const b = body.lastIndexOf('}');
  if (a === -1 || b <= a) return { looks, error: 'no JSON object in the reply' };
  let parsed;
  try { parsed = parseModelJson(body.slice(a, b + 1)); } catch (e) { return { looks, error: `bad JSON: ${e.message}` }; }
  batch.forEach((p, i) => {
    const v = parsed[String(i + 1)];
    if (typeof v !== 'string') return;
    const look = v.trim().replace(/\s+/g, ' ');
    if (!look || look.length > MAX_LOOK) return;
    if (faultsIn(look).length) return;
    looks[p.key] = look;
  });
  return { looks, error: null };
}

// One text call per batch of places, cached by world, place and name.
export function createLooks(deps) {
  const { model, cache, persona, faultsIn = defaultFaults, worldId } = deps;
  const memo = new Map();
  const inflight = new Map();

  async function fromCache(place) {
    const k = lookKey(worldId(), place.key, place.name);
    if (memo.has(k)) return memo.get(k);
    const v = await Promise.resolve(cache.get(k)).catch(() => undefined);
    if (typeof v === 'string' && v) { memo.set(k, v); return v; }
    return null;
  }

  async function ask(batch) {
    let reply;
    try {
      reply = await model.ask(buildLooksPrompt(persona(), batch), {
        maxTokens: 60 + batch.length * 40, temperature: 0.8, background: true,
      });
    } catch { return {}; }
    const { looks } = parseLooks(reply, batch, faultsIn);
    for (const p of batch) {
      if (!looks[p.key]) continue;
      const k = lookKey(worldId(), p.key, p.name);
      memo.set(k, looks[p.key]);
      await Promise.resolve(cache.put(k, looks[p.key])).catch(() => {});
    }
    return looks;
  }

  return {
    async lookFor(place, siblings = [place]) {
      const hit = await fromCache(place);
      if (hit) return hit;
      if (!model || typeof model.ask !== 'function' || (model.available && !model.available())) return null;
      // The batch this place is in, so one call covers its neighbours too.
      const all = siblings.some(s => s.key === place.key) ? siblings : [place, ...siblings];
      const at = all.findIndex(s => s.key === place.key);
      const start = Math.floor(at / LOOKS_PER_CALL) * LOOKS_PER_CALL;
      const batch = all.slice(start, start + LOOKS_PER_CALL);
      const id = `${worldId()}|${start}|${batch.map(b => b.key).join(',')}`;
      if (!inflight.has(id)) inflight.set(id, ask(batch).finally(() => inflight.delete(id)));
      const looks = await inflight.get(id);
      return looks[place.key] || null;
    },
  };
}

function withTimeout(p, ms) {
  let timer;
  return Promise.race([
    Promise.resolve(p).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`no picture after ${ms} ms`)), ms); }),
  ]);
}

export function createPainter(deps) {
  const {
    generate,
    process = async (x) => x,
    cache,
    isIdle = () => true,
    now = () => Date.now(),
    schedule = (fn, ms) => setTimeout(fn, ms),
    timeoutMs = 120000,
    minGapMs = 4000,
    maxPerSession = 60,
    // How soon to look again when the text model was busy. Short enough that a
    // quiet moment is not missed, long enough not to spin.
    idleRecheckMs = 1500,
  } = deps;
  const jobs = new Map();
  const memo = new Map();
  const failed = new Set();
  const listeners = new Set();
  const stats = { started: 0, painted: 0, failed: 0, fromCache: 0, skippedBusy: 0, lastError: null };
  let busy = false;
  let lastStart = -Infinity;
  let timer = null;

  const emit = (key, url) => { for (const fn of listeners) { try { fn(key, url); } catch { /* a listener is not our failure */ } } };

  async function lookup(key) {
    if (memo.has(key)) return memo.get(key);
    const v = await Promise.resolve(cache.get(key)).catch(() => undefined);
    if (typeof v === 'string' && v) { memo.set(key, v); stats.fromCache += 1; return v; }
    return undefined;
  }

  function kick(ms) {
    if (timer) return;
    timer = schedule(() => { timer = null; pump(); }, ms);
  }

  async function pump() {
    if (busy || !jobs.size) return;
    if (stats.started >= maxPerSession) { jobs.clear(); return; }
    const wait = lastStart + minGapMs - now();
    if (wait > 0) { kick(wait); return; }
    if (!isIdle()) { stats.skippedBusy += 1; kick(idleRecheckMs); return; }
    const job = [...jobs.values()].sort((a, b) => a.priority - b.priority)[0];
    jobs.delete(job.key);
    busy = true;
    try {
      const hit = await lookup(job.key);
      if (hit) { emit(job.key, hit); return; }
      lastStart = now();
      stats.started += 1;
      const prompt = typeof job.prompt === 'function' ? await job.prompt() : job.prompt;
      const raw = await withTimeout(generate(prompt), timeoutMs);
      const src = raw && typeof raw === 'object' && typeof raw.dataUrl === 'string' ? raw.dataUrl : String(raw || '');
      if (!/^data:image\//.test(src)) throw new Error(`no picture came back: ${src.slice(0, 60)}`);
      const url = await process(src);
      if (typeof url !== 'string' || !/^data:image\//.test(url)) throw new Error('the picture could not be processed');
      memo.set(job.key, url);
      await Promise.resolve(cache.put(job.key, url)).catch(() => {});
      stats.painted += 1;
      emit(job.key, url);
    } catch (err) {
      failed.add(job.key);
      stats.failed += 1;
      stats.lastError = String(err && err.message ? err.message : err);
    } finally {
      busy = false;
      if (jobs.size) kick(minGapMs);
    }
  }

  return {
    stats,
    lookup,
    pending: () => jobs.size,
    busy: () => busy,
    onPainted(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    request(job) {
      if (!job || !job.key || failed.has(job.key) || memo.has(job.key)) return false;
      const priority = typeof job.priority === 'number' ? job.priority : 9;
      const existing = jobs.get(job.key);
      if (existing) { existing.priority = Math.min(existing.priority, priority); return true; }
      jobs.set(job.key, { ...job, priority });
      kick(0);
      return true;
    },
  };
}

// The browser half of world/pixels.mjs: decode, key out the background, crop
// to the subject, fit the chassis's 128x112 frame, and store at 2x with square
// pixels - the framing every shipped room has.
export async function processPicture(src, doc) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('the picture did not decode'));
    i.src = src;
  });
  const w = img.naturalWidth; const h = img.naturalHeight;
  const full = doc.createElement('canvas'); full.width = w; full.height = h;
  const fctx = full.getContext('2d', { willReadFrequently: true });
  fctx.drawImage(img, 0, 0);
  const data = fctx.getImageData(0, 0, w, h);
  keyOutBackground(data.data, w, h);
  fctx.putImageData(data, 0, 0);
  const box = alphaBox(data.data, w, h) || { x: 0, y: 0, w, h };
  const fit = fitInto(box.w, box.h, FRAME_W - 4, FRAME_H - 4);
  const small = doc.createElement('canvas'); small.width = FRAME_W; small.height = FRAME_H;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(full, box.x, box.y, box.w, box.h,
    Math.floor((FRAME_W - fit.w) / 2), Math.floor((FRAME_H - fit.h) / 2), fit.w, fit.h);
  const sd = sctx.getImageData(0, 0, FRAME_W, FRAME_H);
  hardenAlpha(sd.data);
  sctx.putImageData(sd, 0, 0);
  const big = doc.createElement('canvas'); big.width = FRAME_W * SCALE; big.height = FRAME_H * SCALE;
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(small, 0, 0, big.width, big.height);
  return big.toDataURL('image/png');
}

// The page side. Installed once, at boot, when the lists panel has the
// text-to-image plugin. deps: plugin, SugarCube, document, jQuery (optional),
// model (the SHARED text model, for looks), store (savePicture/loadPicture),
// persona() for the looks prompt, process (defaults to processPicture),
// prefetch (exits painted ahead, default 3), painterOptions.
let installedPainter = null;

export function installPainter(deps = {}) {
  if (installedPainter) return installedPainter;
  const SC = deps.SugarCube || (typeof window !== 'undefined' ? window.SugarCube : null);
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  const plugin = deps.plugin;
  if (!SC || !doc || typeof plugin !== 'function' || !deps.store) return null;

  const vars = () => (SC.State && SC.State.variables) || {};
  const model = deps.model || null;
  const cache = { get: (k) => deps.store.loadPicture(k), put: (k, v) => deps.store.savePicture(k, v) };
  const painter = createPainter({
    generate: (prompt) => plugin({ prompt, negativePrompt: NEGATIVE, resolution: RESOLUTION }),
    process: (src) => (deps.process || processPicture)(src, doc),
    cache,
    isIdle: () => !model || typeof model.idle !== 'function' || model.idle(),
    ...(deps.painterOptions || {}),
  });
  const looks = createLooks({
    model, cache, faultsIn: deps.faultsIn || defaultFaults,
    persona: deps.persona || (() => buildPersona(vars().obscuraPremise || '', vars().obscuraLexicon)),
    worldId: () => vars()[WORLD_ID_KEY] || 'none',
  });

  const places = () => placesIn(SC.setup);
  const info = (key) => {
    const p = places().get(key);
    return p ? { key, node: p, map: p.map, name: displayName(vars(), key, p.name || key) } : null;
  };
  const siblings = (place) => [...places().values()].filter(p => p.map === place.map)
    .map(p => ({ key: p.key, name: displayName(vars(), p.key, p.name || p.key) }));
  const keyOf = (place) => pictureKey(vars()[WORLD_ID_KEY], place.key, place.name);
  const jobFor = (place, priority) => ({
    key: keyOf(place),
    priority,
    prompt: async () => paintPrompt({
      look: await looks.lookFor(place, siblings(place)),
      name: place.name,
      premise: vars().obscuraPremise,
    }),
  });

  const paintInto = (img, url) => {
    if (img.getAttribute('src') !== url) img.setAttribute('src', url);
    img.style.display = '';
    img.style.imageRendering = 'pixelated';
  };
  // The caption's frame shows a CLASS or a SPORT picture in those states; only
  // the place picture is replaced.
  const show = (placeKey, url) => {
    const v = vars();
    if (v.location === placeKey && !v.inclass && !v.sport) {
      for (const img of doc.querySelectorAll('#story-caption .locimg img')) paintInto(img, url);
    }
    for (const img of doc.querySelectorAll(`.ob-hub-picture img[data-ob-place="${String(placeKey).replace(/["\\]/g, '')}"]`)) {
      paintInto(img, url);
    }
  };

  let lastShown = null;
  const onPassage = () => {
    const v = vars();
    if (!v[WORLD_ID_KEY]) return;
    const here = info(v.location);
    if (!here) return;
    const k = keyOf(here);
    painter.lookup(k).then((url) => {
      if (url) { lastShown = [here.key, url]; show(here.key, url); } else painter.request(jobFor(here, 0));
    });
    exitsOf(here.node, places()).slice(0, deps.prefetch ?? 3).forEach((e, i) => {
      const p = info(e);
      if (p) painter.lookup(keyOf(p)).then((u) => { if (!u) painter.request(jobFor(p, i + 1)); });
    });
  };
  painter.onPainted((key, url) => {
    const here = info(vars().location);
    if (here && keyOf(here) === key) { lastShown = [here.key, url]; show(here.key, url); }
  });

  const $ = deps.jQuery !== undefined ? deps.jQuery : (typeof window !== 'undefined' ? window.jQuery : null);
  if ($) $(doc).on(':passageend', onPassage);
  else if (doc.addEventListener) doc.addEventListener(':passageend', onPassage);

  // The caption can be redrawn without a new passage. Put the picture back.
  const caption = doc.getElementById && doc.getElementById('story-caption');
  if (caption && typeof MutationObserver === 'function') {
    new MutationObserver(() => { if (lastShown) show(lastShown[0], lastShown[1]); })
      .observe(caption, { childList: true, subtree: true });
  }

  installedPainter = { painter, looks, onPassage };
  if (typeof window !== 'undefined') window.ObscuraPainter = installedPainter;
  return installedPainter;
}

export { buildPersona };
