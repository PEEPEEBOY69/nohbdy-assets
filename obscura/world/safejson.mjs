// world/safejson.mjs — parsing what a model wrote, without SugarCube's reviver.
//
// SugarCube replaces JSON.parse with a version that REVIVES tagged arrays: a
// ["(revive:eval)", "<code>"] anywhere in the text is evaluated as code. That
// is how a save keeps its functions, and it is exactly wrong for text a model
// wrote - a reply with that shape in it would run in the player's page, and
// the premise that steers the model is free text. The engine keeps the
// untouched parser as JSON._real_parse; model output always goes through it.
export function parseModelJson(text) {
  const real = typeof JSON._real_parse === 'function' ? JSON._real_parse : JSON.parse;
  return real.call(JSON, text);
}
