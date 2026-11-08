#!/usr/bin/env bash
# Vercel "Ignored Build Step". Exit 0 = SKIP the build, exit 1 = BUILD.
# Usage (from vercel.json ignoreCommand): bash ../../scripts/vercel-ignore.sh <app>
# An app builds only when its own files or a package it imports change.
# Never triggers a build: docs, functions/, firestore/storage rules, tests, markdown.
# Unknown base commit or git error => build (safe default).
app="$1"
# This isolated emulator-fixture branch never builds or promotes a website/app.
if [ "${VERCEL_GIT_COMMIT_REF:-}" = qa/quote-fixtures-20261106 ]; then
  printf 'isolated fixture QA branch: SKIP (%s)\n' "$app"
  exit 0
fi
# Script-only CI contract correction. No app bytes changed, so no app builds.
release_parent="$(git rev-parse --verify HEAD^ 2>/dev/null || true)"
if [ "${VERCEL_GIT_COMMIT_REF:-}" = main ] && [ "$release_parent" = e6e5c212b0db7643b1133fb85fa76244c04de676 ]; then
  release_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  [ -n "$release_root" ] || exit 0
  cd "$release_root" || exit 0
  release_paths="$(git diff --name-only "$release_parent" HEAD 2>/dev/null)" || exit 0
  if [ "$release_paths" = scripts/vercel-ignore.sh ]; then
    printf 'reviewed script-only CI correction: SKIP (%s)\n' "$app"
    exit 0
  fi
  printf 'script-only correction paths mismatch: SKIP (%s)\n' "$app"
  exit 0
fi
# Exact reviewed Customer photo/journey repair. Inert beyond this direct parent.
release_parent="$(git rev-parse --verify HEAD^ 2>/dev/null || true)"
if [ "${VERCEL_GIT_COMMIT_REF:-}" = main ] && [ "$release_parent" = bb65e6bac5ac399ee711b51ed85f3a59271aead9 ]; then
  release_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  [ -n "$release_root" ] || exit 0
  cd "$release_root" || exit 0
  release_paths="$(git diff --name-only bb65e6bac5ac399ee711b51ed85f3a59271aead9 HEAD 2>/dev/null)" || exit 0
  expected_paths=$(cat <<'CUSTOMER_REVIEWED_PATHS'
apps/customer/src/app/(tabs)/catalogue/[id].tsx
apps/customer/src/app/(tabs)/catalogue/brands.tsx
apps/customer/src/app/(tabs)/catalogue/enquiry.tsx
apps/customer/src/app/(tabs)/catalogue/index.tsx
apps/customer/src/app/(tabs)/garage/add.tsx
apps/customer/src/app/(tabs)/garage/archive-states.render.test.tsx
apps/customer/src/app/(tabs)/garage/history.tsx
apps/customer/src/app/(tabs)/garage/index.tsx
apps/customer/src/app/(tabs)/profile.native-photo.render.test.tsx
apps/customer/src/app/(tabs)/profile.tsx
apps/customer/src/app/(tabs)/quote-request-auth.render.test.tsx
apps/customer/src/app/(tabs)/quote-request.tsx
apps/customer/src/lib/private-photo-service.test.ts
apps/customer/src/lib/private-photo-service.ts
apps/customer/src/lib/vehicle-service.ts
apps/customer/src/ui/CarThumb.tsx
apps/customer/src/ui/FilterPills.tsx
apps/customer/src/ui/GarageShowroom.tsx
apps/customer/src/ui/JourneySheet.tsx
apps/customer/src/ui/ProfileHero.tsx
apps/customer/src/ui/SavedLicensePhoto.tsx
apps/customer/src/ui/SceneCard.tsx
apps/customer/src/ui/SceneIntro.tsx
apps/customer/src/ui/SceneMotion.tsx
apps/customer/src/ui/ServiceHomes.tsx
apps/customer/src/ui/ServicePackageCard.tsx
apps/customer/src/ui/inputs.tsx
apps/customer/src/ui/journey-sheet.render.test.tsx
apps/customer/src/ui/kit.tsx
apps/customer/src/ui/profile-photo.render.test.tsx
apps/customer/src/ui/saved-license-photo.render.test.tsx
apps/customer/src/ui/scene-motion.render.test.tsx
apps/customer/src/ui/uc-review-contract.test.ts
scripts/vercel-ignore.sh
CUSTOMER_REVIEWED_PATHS
)
  if [ "$release_paths" != "$expected_paths" ]; then printf 'reviewed Customer repair paths mismatch: SKIP\n'; exit 0; fi
  case "$app" in
    customer) printf 'reviewed Customer photo/journey repair: BUILD\n'; exit 1 ;;
    *) printf 'reviewed Customer photo/journey repair: SKIP (%s)\n' "$app"; exit 0 ;;
  esac
fi
# Exact reviewed Customer illustration repair; other app builds are never inferred.
release_parent="$(git rev-parse --verify HEAD^ 2>/dev/null || true)"
if [ "${VERCEL_GIT_COMMIT_REF:-}" = main ] && [ "$release_parent" = 6fb18ca112a8a475bbd87cd26e648b0882d8042f ]; then
  release_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  [ -n "$release_root" ] || exit 0
  cd "$release_root" || exit 0
  release_paths="$(git diff --name-only "$release_parent" HEAD 2>/dev/null)" || exit 0
  expected_paths=$(cat <<'REVIEWED_PATHS'
apps/customer/src/ui/ServiceHomes.tsx
apps/customer/src/ui/uc-review-contract.test.ts
scripts/vercel-ignore.sh
REVIEWED_PATHS
)
  if [ "$release_paths" != "$expected_paths" ]; then printf 'reviewed repair paths do not match: SKIP\n'; exit 0; fi
  case "$app" in
    customer) printf 'reviewed illustration repair: BUILD (%s)\n' "$app"; exit 1 ;;
    *) printf 'reviewed illustration repair: SKIP (%s)\n' "$app"; exit 0 ;;
  esac
fi
# One-shot Confirmed-product visibility release. Exact parent and file allowlist isolate this release.
if [ "${VERCEL_GIT_COMMIT_REF:-}" = main ]; then
  release_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  release_parent="$(git rev-parse --verify HEAD^ 2>/dev/null || true)"
  if [ "$release_parent" = 9419155f38188849dc4d95a28c213efd8756f8cc ]; then
    [ -n "$release_root" ] || exit 0
    cd "$release_root" || exit 0
    release_paths="$(git diff --name-only "$release_parent" HEAD 2>/dev/null)" || exit 0
    unexpected="$(printf '%s\n' "$release_paths" | grep -Fvx \
      -e 'apps/customer/src/lib/services-tree.ts' \
      -e 'apps/customer/src/lib/services-tree.test.ts' \
      -e 'apps/customer/src/lib/customer-offering-visibility.ts' \
      -e 'apps/site/src/pages/services/[slug].astro' \
      -e 'apps/site/src/data/redesign/home.html' \
      -e 'apps/site/src/data/redesign/services.html' \
      -e 'packages/core/src/customer-offering-visibility.json' \
      -e 'packages/core/src/customer-offering-visibility.ts' \
      -e 'tests/keramik-customer-hold.test.mjs' \
      -e 'tests/customer-confirmed-offerings.test.mjs' \
      -e 'tests/vercel-confirmed-release.test.mjs' \
      -e 'scripts/vercel-ignore.sh' | grep -v '^$' || true)"
    if [ -n "$unexpected" ]; then printf 'Confirmed-product release unexpected paths: SKIP\n'; exit 0; fi
    case "$app" in
      customer|site) printf 'Confirmed-product visibility release: BUILD (%s)\n' "$app"; exit 1 ;;
      *) printf 'Confirmed-product visibility release: SKIP (%s)\n' "$app"; exit 0 ;;
    esac
  fi
fi
# One-shot Keramik visibility release. Exact parent and file allowlist isolate this release.
if [ "${VERCEL_GIT_COMMIT_REF:-}" = main ]; then
  release_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  release_parent="$(git rev-parse --verify HEAD^ 2>/dev/null || true)"
  if [ "$release_parent" = db86ae802280ded4a8b30a9a02fbbad1faf96549 ]; then
    [ -n "$release_root" ] || exit 0
    cd "$release_root" || exit 0
    release_paths="$(git diff --name-only "$release_parent" HEAD 2>/dev/null)" || exit 0
    unexpected="$(printf '%s\n' "$release_paths" | grep -Fvx \
      -e 'apps/customer/src/app/(tabs)/book/[serviceId].tsx' \
      -e 'apps/customer/src/app/(tabs)/catalogue/[id].tsx' \
      -e 'apps/customer/src/lib/brand-enquiries.ts' \
      -e 'apps/customer/src/lib/catalogue-service.ts' \
      -e 'apps/customer/src/lib/customer-offering-visibility.ts' \
      -e 'apps/site/src/pages/services/[slug].astro' \
      -e 'tests/keramik-customer-hold.test.mjs' \
      -e 'tests/vercel-keramik-release.test.mjs' \
      -e 'scripts/vercel-ignore.sh' | grep -v '^$' || true)"
    if [ -n "$unexpected" ]; then printf 'Keramik release unexpected paths: SKIP\n'; exit 0; fi
    case "$app" in
      customer|site) printf 'Keramik visibility release: BUILD (%s)\n' "$app"; exit 1 ;;
      *) printf 'Keramik visibility release: SKIP (%s)\n' "$app"; exit 0 ;;
    esac
  fi
fi
# Single approved website release. Exact parent + allowed paths keep other projects off.
guard_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ "${VERCEL_GIT_COMMIT_REF:-}" = main ] && [ -n "$guard_root" ] && [ -f "$guard_root/scripts/site-only-release-20261104" ]; then
  cd "$guard_root" || exit 0
  expected="$(cat scripts/site-only-release-20261104 2>/dev/null)"
  parent="$(git rev-parse --verify HEAD^ 2>/dev/null || true)"
  # A marker alone is not a matching release. Unresolved ancestry falls through
  # to each app's normal safety policy (apps BUILD, website SKIP without a base).
  if [ "$expected" = 6f31d7c346d1c2c3fe092a9f2bb3d59d2625068a ] && [ "$parent" = "$expected" ]; then
    changed="$(git diff --name-only "$parent" HEAD 2>/dev/null)" || exit 0
    unexpected="$(printf '%s\n' "$changed" | grep -vE '^(apps/site/|scripts/vercel-ignore\.sh$|scripts/site-only-release-20261104$|tests/vercel-site-only-release\.test\.mjs$)' | grep -v '^$' || true)"
    if [ -n "$unexpected" ]; then printf 'site-only release has unexpected paths: SKIP\n'; exit 0; fi
    if [ "$app" = site ]; then printf 'approved site-only release: BUILD\n'; exit 1; fi
    printf 'approved site-only release: SKIP (%s)\n' "$app"; exit 0
  fi
  # A proven later commit makes this one-shot marker inert. Existing policy resumes.
fi
# Scoped reviewed web release: only these reviewed projects build on this exact branch.
# Studio remains unchanged. Other branches keep their existing diff/default policy.
if [ "${VERCEL_GIT_COMMIT_REF:-}" = "release/approved-web-20261104" ]; then
  case "$app" in
    customer|admin|site) printf 'reviewed web release: BUILD (%s)\n' "$app"; exit 1 ;;
    *) printf 'reviewed web release: SKIP (%s)\n' "$app"; exit 0 ;;
  esac
fi
# One-shot reviewed wrap release (customer app + marketing site). Fires only
# when HEAD's parent is exactly the reviewed wrap tip 19ca7ca5 AND HEAD itself
# changes nothing but this script; any doubt falls through to the policies
# below (exit 0 = SKIP, never an accidental build).
if [ "${VERCEL_GIT_COMMIT_REF:-}" = main ]; then
  wrap_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  wrap_parent="$(git rev-parse --verify HEAD^ 2>/dev/null || true)"
  if [ -n "$wrap_root" ] && [ "$wrap_parent" = 19ca7ca50f5031dedce40a2880b7e59fee539ddb ]; then
    cd "$wrap_root" || exit 0
    wrap_changed="$(git diff --name-only "$wrap_parent" HEAD 2>/dev/null)" || exit 0
    if [ "$wrap_changed" = scripts/vercel-ignore.sh ]; then
      case "$app" in
        customer|site) printf 'reviewed wrap release: BUILD (%s)\n' "$app"; exit 1 ;;
        *) printf 'reviewed wrap release: SKIP (%s)\n' "$app"; exit 0 ;;
      esac
    fi
  fi
fi
# One-shot site rebuild for the Rodim source-mapping fix (docs-only change;
# customer/studio/admin unaffected). Fires only when HEAD's parent is exactly
# 70c7a6a4 AND HEAD changes nothing but this script; doubt falls through.
if [ "${VERCEL_GIT_COMMIT_REF:-}" = main ]; then
  fix_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  fix_parent="$(git rev-parse --verify HEAD^ 2>/dev/null || true)"
  if [ -n "$fix_root" ] && [ "$fix_parent" = 70c7a6a417e725a6cf0b3b9d96dc8b619804ca14 ]; then
    cd "$fix_root" || exit 0
    fix_changed="$(git diff --name-only "$fix_parent" HEAD 2>/dev/null)" || exit 0
    if [ "$fix_changed" = scripts/vercel-ignore.sh ]; then
      case "$app" in
        site) printf 'rodim mapping site rebuild: BUILD (%s)\n' "$app"; exit 1 ;;
        *) printf 'rodim mapping site rebuild: SKIP (%s)\n' "$app"; exit 0 ;;
      esac
    fi
  fi
fi
# One-shot customer-only redeploy for the advance-payment exclusion revert.
# Fires only when HEAD's parent is exactly 0cdf414c AND HEAD changes nothing
# but this script; doubt falls through to the policies below.
if [ "${VERCEL_GIT_COMMIT_REF:-}" = main ]; then
  rev_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  rev_parent="$(git rev-parse --verify HEAD^ 2>/dev/null || true)"
  if [ -n "$rev_root" ] && [ "$rev_parent" = 0cdf414cd5c8488600f9308d956682cff6aeaf54 ]; then
    cd "$rev_root" || exit 0
    rev_changed="$(git diff --name-only "$rev_parent" HEAD 2>/dev/null)" || exit 0
    if [ "$rev_changed" = scripts/vercel-ignore.sh ]; then
      case "$app" in
        customer) printf 'advance exclusion revert: BUILD (%s)\n' "$app"; exit 1 ;;
        *) printf 'advance exclusion revert: SKIP (%s)\n' "$app"; exit 0 ;;
      esac
    fi
  fi
fi
# Website releases fail closed. An app-only push must never rebuild the site
# merely because its older successful base is missing from a shallow clone.
if [ "$app" = site ]; then
  site_skip() { printf 'site: SKIP (%s)\n' "$1"; exit 0; }
  root="$(git rev-parse --show-toplevel 2>/dev/null)" || site_skip 'git root unavailable'
  cd "$root" || site_skip 'git root inaccessible'
  # One-shot audited site release: a committed marker scripts/site-release-<full-sha>
  # fires a build only when it names HEAD's exact parent commit AND that commit
  # changes nothing but scripts/vercel-ignore.sh and the marker itself. When the
  # marker exists but anything is in doubt (diff failure, unexpected path) it
  # skips; without a marker the fail-closed base check below runs unchanged.
  # Every resolution failure falls through to that check; nothing here may exit
  # nonzero by accident, because a nonzero exit means BUILD.
  head_sha="$(git rev-parse HEAD 2>/dev/null || true)"
  parent_sha="$(git rev-parse HEAD~1 2>/dev/null || true)"
  marker="scripts/site-release-$parent_sha"
  if [ -n "$head_sha" ] && [ -n "$parent_sha" ] && [ -f "$marker" ]; then
    changed="$(git diff --name-only "$parent_sha" "$head_sha" 2>/dev/null)" || site_skip 'release-marker: diff failed'
    unexpected="$(printf '%s\n' "$changed" | grep -Fvx -e 'scripts/vercel-ignore.sh' -e "$marker" | grep -v '^$' || true)"
    [ -z "$unexpected" ] || site_skip "release-marker: unexpected changed paths: $unexpected"
    printf 'site: BUILD (audited one-shot release marker for parent %s)\n' "$parent_sha"
    exit 1
  fi
  base="${VERCEL_GIT_PREVIOUS_SHA:-}"
  [[ "$base" =~ ^[0-9a-fA-F]{40}$ ]] || site_skip 'previous successful SHA missing or invalid'
  if ! git cat-file -e "$base^{commit}" 2>/dev/null; then
    # Fetch only the actual successful base. HEAD^ is unsafe for multi-commit pushes.
    GIT_TERMINAL_PROMPT=0 timeout 15s git fetch --no-tags --depth=1 origin "$base" >/dev/null 2>&1 || site_skip 'previous successful commit unavailable'
    git cat-file -e "$base^{commit}" 2>/dev/null || site_skip 'fetched base is not a commit'
  fi
  changed="$(git diff --name-only "$base" HEAD -- apps/site 2>/dev/null)" || site_skip 'site diff failed'
  relevant="$(printf '%s\n' "$changed" | grep -vE '(\.test\.tsx?$|\.md$|/__tests__/|^docs/)' | grep -v '^$')"
  [ -n "$relevant" ] || site_skip 'no relevant website changes'
  printf 'site: BUILD (verified website changes since %s)\n' "$base"
  exit 1
fi
case "$app" in
  customer|studio|admin) paths="apps/$app packages/core packages/database packages/ui packages/auth packages/config pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json" ;;
  site) paths="apps/site" ;;
  *) exit 1 ;;
esac
root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 1
base="${VERCEL_GIT_PREVIOUS_SHA:-}"
# No usable base commit (first build, shallow clone, force push): always build. Never guess the parent commit:
# a push of several commits would then skip an app whose changes are further back.
[ -n "$base" ] && git cat-file -e "$base^{commit}" 2>/dev/null || exit 1
cd "$root" || exit 1
changed="$(git diff --name-only "$base" HEAD -- $paths 2>/dev/null)" || exit 1
relevant="$(printf '%s\n' "$changed" | grep -vE '(\.test\.tsx?$|\.md$|/__tests__/|^docs/)' | grep -v '^$')"
[ -z "$relevant" ] && exit 0
exit 1
