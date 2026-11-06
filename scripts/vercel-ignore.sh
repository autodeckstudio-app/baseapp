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
# Exact reviewed Customer + Site frontend release. Unknown source is never promoted.
if [ "${VERCEL_GIT_COMMIT_REF:-}" = main ] && [ "$(git rev-parse --verify HEAD^ 2>/dev/null || true)" = 1686827c573e220d09d5055017e623d477c37b9c ]; then
  release_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  [ -n "$release_root" ] || exit 0
  cd "$release_root" || exit 0
  release_paths="$(git diff --name-only HEAD^ HEAD 2>/dev/null)" || exit 0
  expected_paths=$(cat <<'REVIEWED_PATHS'
.github/workflows/ci.yml
apps/customer/src/app/(tabs)/book/confirm.tsx
apps/customer/src/app/(tabs)/catalogue/[id].tsx
apps/customer/src/app/(tabs)/help.tsx
apps/customer/src/lib/booking-confirm-copy.test.ts
apps/customer/src/lib/booking-confirm-copy.ts
apps/customer/src/lib/day-surfaces.test.ts
apps/customer/src/lib/policy-copy.test.ts
apps/customer/src/lib/raised.ts
apps/customer/src/lib/service-home-images.ts
apps/customer/src/lib/showcase.ts
apps/customer/src/lib/studio-info.ts
apps/customer/src/ui/BookingReviewGuide.tsx
apps/customer/src/ui/HomeView.tsx
apps/customer/src/ui/ServiceHomes.tsx
apps/customer/src/ui/ServicePrice.tsx
apps/customer/src/ui/ServiceTimePicker.tsx
apps/customer/src/ui/ServiceVisitFacts.tsx
apps/customer/src/ui/booking-review-guide.render.test.tsx
apps/customer/src/ui/design-contract.test.ts
apps/customer/src/ui/home-merged.test.ts
apps/customer/src/ui/homes-reference.render.test.tsx
apps/customer/src/ui/service-homes-work.render.test.tsx
apps/customer/src/ui/service-visit-facts.render.test.tsx
apps/customer/src/ui/uc-review-contract.test.ts
apps/site/src/data/redesign/services.html
apps/site/src/data/site-service-family-overrides.json
apps/site/src/pages/services.astro
apps/site/src/pages/services/[slug].astro
apps/site/tests/category-handoff.test.mjs
apps/site/tests/public-cars.test.mjs
apps/site/tests/recheck.test.mjs
apps/site/tests/service-decision.test.mjs
functions/src/functions/files/getPrivateFileUrl.ts
functions/src/functions/inspection/issueInspectionPhotoUploadUrl.ts
functions/src/lib/photo-provenance.ts
functions/src/test/emulator/advance-activation-booking.emulator.test.ts
functions/src/test/emulator/booking-cancel-money.emulator.test.ts
functions/src/test/emulator/booking-owed-rules.emulator.test.ts
functions/src/test/emulator/booking-reschedule-request.emulator.test.ts
functions/src/test/emulator/booking-reschedule.emulator.test.ts
functions/src/test/emulator/cancel-outbox.emulator.test.ts
functions/src/test/emulator/garage-ownership.emulator.test.ts
functions/src/test/emulator/inspection.emulator.test.ts
functions/src/test/emulator/m6-office-rules.emulator.test.ts
functions/src/test/emulator/membership-refund-policy.emulator.test.ts
functions/src/test/emulator/membership.emulator.test.ts
functions/src/test/emulator/multiday-booking.emulator.test.ts
functions/src/test/emulator/native-membership-url.emulator.test.ts
functions/src/test/emulator/notifications.emulator.test.ts
functions/src/test/emulator/papers-real-transport.emulator.test.ts
functions/src/test/emulator/payment-confirm.emulator.test.ts
functions/src/test/emulator/protection-listener-rules.emulator.test.ts
functions/src/test/emulator/rate-limit.emulator.test.ts
functions/src/test/emulator/round2-history.emulator.test.ts
functions/src/test/emulator/security-rules.emulator.test.ts
functions/src/test/emulator/storage-rules.emulator.test.ts
functions/src/test/emulator/studio-backend-batch.emulator.test.ts
functions/src/test/emulator/upgrade-claim-barrier.emulator.test.ts
functions/src/test/emulator/waiting-cancel-processing.emulator.test.ts
functions/src/test/emulator/waiting-cancel.emulator.test.ts
functions/src/test/fixtures/nonmember-byte-inputs.json
functions/src/test/unit/paper-lifecycle-flow.test.ts
functions/src/test/unit/private-file-url.test.ts
scripts/vercel-ignore.sh
REVIEWED_PATHS
)
  if [ "$release_paths" != "$expected_paths" ]; then printf 'reviewed frontend release paths do not match: SKIP\n'; exit 0; fi
  case "$app" in
    customer|site) printf 'reviewed frontend release: BUILD (%s)\n' "$app"; exit 1 ;;
    *) printf 'reviewed frontend release: SKIP (%s)\n' "$app"; exit 0 ;;
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
