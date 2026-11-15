#!/usr/bin/env bash
# A release preflight is successful only if every check succeeds. Never deploys.
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
cd ../..
node --test tests/vercel-site-ignore.test.mjs
printf 'RELEASE_PREFLIGHT_PASSED\n'
