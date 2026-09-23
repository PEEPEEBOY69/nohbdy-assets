// world/leftovers.mjs — what the model did not write never reaches the screen.
//
// The generator replaces placeholder strings - "[ob_names-20]", "[description
// — unwritten #12]" - and a field it does not reach keeps its placeholder: a
// batch that failed twice, a table past the per-build cap. Nothing ever wrote
// those later, so a player met them as they were. The published build showed
// "Your full name is [ob_names-20] [ob_names-32]" and a room full of
// "[ob_names-6] [ob_names-21]".
//
// So the last step of a build sweeps them. A field goes back to the chassis's
// own value at the same place when that value is real: the chassis ships its
// name lists, so a name comes back as a name. Prose the chassis only ever held
// as a placeholder becomes empty - an absent sentence reads better than a
// bracketed token.
//
// Names must stay distinct within their list. The engine draws a name until it
// finds one not in use (ob_unique_random_name); a list of duplicates spins it
// forever. So a restored name already used in the list is skipped for an
// unused one from the same original list.
import { findPlaceholders, isPlaceholder } from './ai-generator.mjs';
import { PLACEHOLDER } from './named.mjs';

const real = (v) => typeof v === 'string' && v.trim() !== '' && !isPlaceholder(v) && !PLACEHOLDER.test(v);

function at(root, parts) {
  let node = root;
  for (const p of parts) {
    if (!node || typeof node !== 'object') return undefined;
    node = node[p];
  }
  return node;
}

export function sweepLeftovers(world, originals) {
  let restored = 0;
  let blanked = 0;
  for (const found of findPlaceholders(world)) {
    const parts = found.path.split('.');
    const key = parts[parts.length - 1];
    const parent = at(world, parts.slice(0, -1));
    if (!parent || typeof parent !== 'object') continue;
    const origParent = at(originals, parts.slice(0, -1));
    const orig = origParent && typeof origParent === 'object' ? origParent[key] : undefined;

    let value = '';
    if (Array.isArray(parent)) {
      const used = new Set(parent.filter(real));
      if (real(orig) && !used.has(orig)) value = orig;
      else if (Array.isArray(origParent)) value = origParent.find(v => real(v) && !used.has(v)) || '';
    } else if (real(orig)) {
      value = orig;
    }
    parent[key] = value;
    if (value) restored += 1; else blanked += 1;
  }
  return { restored, blanked };
}
