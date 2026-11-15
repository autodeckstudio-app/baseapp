#!/usr/bin/env bash
# Post-deploy guardrail (READ-ONLY, FAIL CLOSED, grants nothing).
# Verifies that every service listed in scripts/public-callables.manifest -
# the reviewed set of intended-public Firebase callables - currently has
# roles/run.invoker on allUsers. A missing binding makes that feature fail for
# every user at ingress (HTTP 403 before any code runs) while deploy output
# still says "success". Services absent from the manifest are not checked;
# some functions are intentionally private, so this never asserts a universal
# public posture and never modifies IAM.
#
# Incident 2026-11-01: 5 newly created callables (createMyProtection,
# updateMyProtection, removeMyVehicleImage, removeMyListingPhoto,
# replaceMyListingPhoto) were first-deployed without the binding and were
# unreachable from creation until discovered in QA.
#
# Run after ANY functions deploy (firebase deploy, gcloud, console, CI):
#   scripts/verify-callable-invoker.sh                 # uses gcloud auth
#   ACCESS_TOKEN=$(...) scripts/verify-callable-invoker.sh
# Exit 0 = every manifest entry verified public. Exit 1 = a binding is missing
# OR a policy could not be read (fail closed). Remediation is a human decision:
#   gcloud run services add-iam-policy-binding SERVICE \
#     --region asia-south1 --member allUsers --role roles/run.invoker \
#     --project autodeck-studio
set -u
PROJECT="${PROJECT:-autodeck-studio}"
REGION="${REGION:-asia-south1}"
MANIFEST="${MANIFEST:-$(dirname "$0")/public-callables.manifest}"
TOKEN="${ACCESS_TOKEN:-$(gcloud auth print-access-token 2>/dev/null)}"
[ -n "$TOKEN" ] || { echo "FAIL: no access token (gcloud auth or ACCESS_TOKEN)"; exit 1; }
[ -f "$MANIFEST" ] || { echo "FAIL: manifest not found: $MANIFEST"; exit 1; }

BAD=0; TOTAL=0
while IFS= read -r NAME; do
  case "$NAME" in ''|\#*) continue;; esac
  TOTAL=$((TOTAL+1))
  POL=$(curl -s --max-time 20 -H "Authorization: Bearer $TOKEN" \
    "https://run.googleapis.com/v2/projects/$PROJECT/locations/$REGION/services/$NAME:getIamPolicy")
  if ! printf '%s' "$POL" | python3 -c "
import json,sys
try: p=json.load(sys.stdin)
except Exception: sys.exit(1)
ok=any(b.get('role')=='roles/run.invoker' and 'allUsers' in b.get('members',[]) for b in p.get('bindings',[]))
sys.exit(0 if ok else 1)"; then
    echo "FAIL: $NAME - roles/run.invoker allUsers binding missing or policy unreadable"
    BAD=$((BAD+1))
  else
    echo "OK:   $NAME"
  fi
  sleep 0.5   # stay well under IAM read throttle; do not retry-loop
done < "$MANIFEST"
echo "checked $TOTAL manifest services: $BAD failing"
[ "$BAD" -eq 0 ]
