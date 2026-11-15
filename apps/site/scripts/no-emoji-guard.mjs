// No-emoji guard for the AutoDeck site.
// Fails when site copy or UI source contains emoji, emoji variation selectors,
// or the pictographic arrow/dingbat characters we removed from the design
// (thin-line SVG icons in src/components/Arrow.astro replaced them).
// Run: node scripts/no-emoji-guard.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN_DIRS = ['src', 'public'];
const EXT = new Set(['.astro', '.js', '.ts', '.jsx', '.tsx', '.css', '.json', '.md', '.txt', '.html', '.svg']);

// Emoji with default emoji presentation, extended pictographs, variation
// selectors, and the specific symbol characters banned from site copy.
const BANNED = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{FE0E}\u{FE0F}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{2700}-\u{27BF}]/u;

const failures = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    const ext = name.slice(name.lastIndexOf('.'));
    if (!EXT.has(ext)) continue;
    const text = readFileSync(p, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const m = line.match(BANNED);
      if (m) failures.push(`${p.replace(ROOT + '/', '')}:${i + 1} contains ${JSON.stringify(m[0])}`);
    });
  }
}
for (const d of SCAN_DIRS) walk(join(ROOT, d));

if (failures.length) {
  console.error('No-emoji guard failed. Remove these characters (use the Arrow.astro icon component instead):');
  for (const f of failures.slice(0, 30)) console.error('  ' + f);
  if (failures.length > 30) console.error(`  ... and ${failures.length - 30} more`);
  process.exit(1);
}
console.log('No-emoji guard passed: site copy and UI are free of emoji and symbol glyphs.');
