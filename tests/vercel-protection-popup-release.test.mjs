import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const source = resolve('scripts/vercel-ignore.sh');
function fixture(extra = false) {
 const dir = mkdtempSync(join(tmpdir(), 'popup-release-'));
 mkdirSync(join(dir, 'scripts')); mkdirSync(join(dir, 'bin'));
 copyFileSync(source, join(dir, 'scripts/vercel-ignore.sh'));
 const changed = ['apps/customer/src/ui/services-experience/ExperienceView.tsx', 'apps/customer/src/ui/services-experience/protection-one-view.render.test.tsx', 'scripts/vercel-ignore.sh', 'tests/vercel-protection-popup-release.test.mjs'];
 if (extra) changed.push('functions/src/index.ts');
 writeFileSync(join(dir, 'bin/git'), '#!/bin/sh\ncase "$*" in\n*--show-toplevel*) printf "%s\\n" "$POPUP_TEST_ROOT";;\n*HEAD^*) echo c0761a4f52768b6f9df0455b300fa2839349e831;;\ndiff*) cat "$POPUP_TEST_ROOT/changed";;\n*) exit 1;;\nesac\n', { mode: 0o755 });
 writeFileSync(join(dir, 'changed'), changed.join('\n')+'\n');
 return (app, branch) => spawnSync('bash', [join(dir, 'scripts/vercel-ignore.sh'), app], {cwd:dir, env:{...process.env, PATH:join(dir,'bin')+':'+process.env.PATH, POPUP_TEST_ROOT:dir, VERCEL_GIT_COMMIT_REF:branch, VERCEL_GIT_PREVIOUS_SHA:''}}).status;
}
test('approved exact popup builds Customer only from main', () => { const run=fixture(); assert.equal(run('customer','main'),1); for(const app of ['admin','studio','site','other','']) assert.equal(run(app,'main'),0); });
test('approved popup staging branch builds nothing', () => { const run=fixture(); for(const app of ['customer','admin','studio','site']) assert.equal(run(app,'release/approved-protection-popup-20261125'),0); });
test('unexpected payload cannot use the one-shot exception', () => { const run=fixture(true); assert.equal(run('studio','main'),1); assert.equal(run('site','main'),0); });
