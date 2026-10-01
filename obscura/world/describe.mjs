// world/describe.mjs — how a person's hair and clothes read, in Obscura's words.
//
// The engine keeps a hairstyle as a phrase that is also its key
// (setup.ob_hairstyles[person["hair style"]] says whether it is shaved or an
// updo), so the phrase cannot change in the tables or in a save without
// breaking every lookup. What changes is what is shown: the hair sentence the
// engine builds (Person.hair_descriptor) ends on the phrase, and a hairstyle
// the original words at length is shown in Obscura's phrasing instead, found
// by the hash of the engine's phrase. Only hashes and Obscura's words are
// kept here. A short plain name ("in a bun", "in cornrows") is shown as it is.

// cyrb53, as tools/fingerprint.mjs has it: a world module cannot import the tools.
export function hash53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export const HAIR_WORDS = {
  '19cd6735b21daf': "in two Dutch braids",
  '88f62f121511': "braided around the head like a crown",
  '1f481929b6f131': "short in front and long at the back",
  'd4be77d8d6050': "artfully messy",
  'c5ed7904b508c': "in a cascading waterfall braid",
  'dd530f3f365f1': "pulled up into a high ponytail",
  '1f2b766808638': "tied back in a ponytail",
  '1505f8ddcc19a8': "in a bubble ponytail",
  '974f9162e423f': "in a tight braided ponytail",
  '16541de6da9735': "feathered, parted in the middle",
  'c72199c059755': "feathered, parted at the side",
  '635056d034bb1': "worn down with blunt bangs",
  '13b76aa0b9aa03': "worn in two braids",
  '1a6d50bb3d8cd5': "worn in one long braid",
  'c4db90887c7bc': "cut in choppy layers",
  '158cdd0d2b2b13': "in many thin braids",
  '982ab647108ed': "in a comma-curl side part",
  '114ed6583446a7': "in a long mermaid cut around the face",
  '1214d7cc9864f6': "kept in a tidy crew cut",
  '4ecdd405719e7': "in two afro puffs",
  '474bc6a0851a0': "in tight, rounded curls",
  'eb72a0ac02cf3': "in a rough pixie cut",
  '17b29225230089': "in a rough wolf cut",
  '234e25592ccff': "in one heavy French braid",
  '1768ab1dae2906': "in a tousled shag",
  '12129c3d985aa8': "in a wispy shag",
  '8b179837752d9': "twisted into a rope braid",
  '1ee11dcfe266bf': "curly, with frosted tips",
  '1d44d31e1330fa': "in locs on top, shaved at the sides",
  'e52b3d21a3fec': "in big, glamorous curls",
  '16bf488d560496': "long on one side, shaved on the other",
  '6c43250254905': "long on top, shaved at the sides",
  '178497340657e2': "worn down around the face",
  '18624d73c9244f': "cut flat across the top",
  '11badc1be2d54f': "piled up in a messy bun",
  '1d2c8fe9cfcc76': "spiked, the tips frosted",
  '1858a52e7c8487': "straight, with a fringe swept hard to one side",
  '142a5997f47034': "with the edges gelled down",
  '1fd2951254f1a': "shaved at the sides, the rest tied in a topknot",
};

export const hairWords = (phrase) => (typeof phrase === 'string' && HAIR_WORDS[hash53(phrase).toString(16)]) || phrase;

// The engine's sentence, its last words swapped for Obscura's when they are a
// hairstyle it knows. Anything else comes back as the engine built it.
export function swapHairstyle(sentence, style) {
  if (typeof sentence !== 'string' || typeof style !== 'string' || !style) return sentence;
  const mine = hairWords(style);
  return mine !== style && sentence.endsWith(style) ? sentence.slice(0, sentence.length - style.length) + mine : sentence;
}

// A clothing configuration ("how it is worn") is printed by its key, which the
// engine reads; the long ones are shown in Obscura's words when a text node is
// one of them, whole, in the case it was printed in (world/guard.mjs's
// transform, beside the renames). Only hashes and Obscura's words are kept.
export const CONFIG_WORDS = {
  '5eec8ea64f8ff': "slung over your shoulders",
  '5874e7b604b72': "crossed at the neck, each side over the nearer breast",
  '1bb0d93a30e837': "crossed over the stomach, each side over the far breast and up over the shoulders",
  '142758c8ed176b': "pulled down off the shoulders",
  'f00041db68545': "tied once, straight across",
  '72e658e709d44': "opened low, a little underboob showing",
  'de1f926e55c48': "opened to the waist",
  '14dca1b691dd4b': "opened at the collarbone",
  '11b7d43b737584': "opened for a little cleavage",
  '1c9c2823c20b88': "opened over the stomach",
  '1545e4c6ba5deb': "opened to show a little underboob",
  '147b305a39e8fc': "opened wide, the chest bare",
  '104a6d5277030': "barely covering the nipples",
  '16a89a445f71eb': "strung in a delicate web",
  '2e2b3ae00281c': "lashed tight like a ship's rigging",
  '1409b7e521b312': "pulled down to cover more",
  '56a7a0e4d84e8': "pulled tight behind the neck and tied at the waistband",
  'e94e4bf7d5cbf': "tied in two lines across",
  'a10fcea36ce14': "knotted at the front",
  'e348b99fa3680': "tied down the front from shoulder to waist",
  'fc7cb13989068': "unbuttoned and pinned back",
  '954b5063f8361': "unbuttoned but for the collar and the waist",
  '197f42a007ff58': "undone down one side",
  '161f859a28a3': "untied down one side",
  '2c6a378f4915': "untied down to the hip",
  '1a0fda8ebe9b62': "unzipped and knotted around the waist",
  '165827b471aeb8': "wrapped around and knotted in front",
};

const caseLike = (model, words) => {
  if (model === model.toUpperCase() && /[A-Z]/.test(model)) return words.toUpperCase();
  const w = model.split(/\s+/).filter(Boolean);
  if (w.length > 1 && w.every((x) => /^[A-Z]/.test(x))) return words.replace(/(^|\s)([a-z])/g, (m, s, c) => s + c.toUpperCase());
  if (/^[A-Z]/.test(model)) return words.charAt(0).toUpperCase() + words.slice(1);
  return words;
};

export function configLabel(text) {
  if (typeof text !== 'string' || text.length < 10 || text.length > 160) return text;
  const core = text.trim();
  const mine = CONFIG_WORDS[hash53(core.toLowerCase()).toString(16)];
  if (!mine) return text;
  const lead = text.slice(0, text.indexOf(core));
  return lead + caseLike(core, mine) + text.slice(lead.length + core.length);
}

// Person.hair_descriptor, wrapped once: the engine still decides the length,
// the colour, a shaved head and an updo.
export function installDescriptions({ Person } = {}) {
  const proto = Person && Person.prototype;
  if (!proto || typeof proto.hair_descriptor !== 'function') return false;
  if (proto.hair_descriptor.obscura) return true;
  const original = proto.hair_descriptor;
  const wrapped = function hairDescriptor(...args) {
    const out = original.apply(this, args);
    try { return swapHairstyle(out, this && this['hair style']); } catch { return out; }
  };
  wrapped.obscura = true;
  proto.hair_descriptor = wrapped;
  return true;
}
