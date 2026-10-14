#!/usr/bin/env bash
# Lists function source files changed since the last deployed commit, so none are forgotten.
# Usage: scripts/pending-functions.sh <last-deployed-sha>   (default: the newest commit tagged deployed-functions)
set -euo pipefail
base="${1:-$(git rev-list -n1 deployed-functions 2>/dev/null || true)}"
[ -n "$base" ] || { echo "Pass the last deployed sha, or tag it: git tag -f deployed-functions <sha>"; exit 2; }
echo "Changed under functions/ and firestore.rules since ${base:0:7}:"
git diff --name-only "$base"..HEAD -- functions/src firestore.rules firestore.indexes.json | sed 's/^/  /'
echo "After a deploy, record it: git tag -f deployed-functions HEAD"
