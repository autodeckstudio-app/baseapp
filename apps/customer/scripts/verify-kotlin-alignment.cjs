const assert = require('node:assert/strict');
const fs = require('node:fs');
const {align} = require('../plugins/with-android-kotlin-alignment.cjs');
const one = align('allprojects {}\n');
assert.equal(align(one), one, 'must remain idempotent');
assert.throws(() => align('// @autodeck/kotlin-alignment begin'), /Incomplete/);
assert(!one.includes('skip-metadata'));
assert(one.includes("details.useVersion '1.9.0'"));
assert(one.includes("details.useVersion '2.0.21'"));
if (process.argv[2]) {
  const actual = fs.readFileSync(`${process.argv[2]}/android/build.gradle`, 'utf8');
  assert.equal(actual.split('// @autodeck/kotlin-alignment begin').length, 2);
  assert(actual.includes(one.slice(one.indexOf('// @autodeck/kotlin-alignment begin')).trim()));
  assert(!actual.includes('startsWith('), 'disposable broad trial must not remain');
}
console.log('Bounded Kotlin alignment, idempotence, fail-closed marker and generated-source checks PASS');
