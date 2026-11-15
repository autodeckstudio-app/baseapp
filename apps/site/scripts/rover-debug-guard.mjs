// Rover debug-surface guard: the interactive 3D rover shipped with dev-only
// URL diagnostics (?objdump, ?probe, ?covdebug, ?only, ?buildms, ?markdebug,
// ?side, ?pick) used while classifying the GLB. They were stripped for
// production; this guard fails if any of them reappear in rover-zones.ts.
// Run: node scripts/rover-debug-guard.mjs
import { readFileSync } from 'node:fs';

const FILE = new URL('../src/scripts/rover-zones.ts', import.meta.url).pathname;
const src = readFileSync(FILE, 'utf8');

const BANNED = [
  ['URLSearchParams', 'any URL query diagnostic hook'],
  ['objdump', '?objdump object dump'],
  ['PROBE', '?probe numeric probe'],
  ['covdebug', '?covdebug shader debug tint'],
  ['uDebug', 'shader uDebug uniform'],
  ['markdebug', '?markdebug marker dump'],
  ['MARKDEBUG', '?markdebug marker dump'],
  ['buildms', '?buildms build-timing override'],
  ['pickQ', '?pick raycast probe'],
  ['sideView', '?side camera override'],
  ["get('only')", '?only object isolation'],
];

const hits = BANNED.filter(([needle]) => src.includes(needle)).map(([, label]) => label);
if (hits.length) {
  console.error('rover-debug-guard: dev diagnostics present in rover-zones.ts: ' + hits.join(', '));
  process.exit(1);
}
console.log('rover-debug-guard: no dev diagnostics in rover-zones.ts');
