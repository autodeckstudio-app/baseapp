exec > /tmp/dpl4.log 2>&1
set -x
cd ~/baseapp
git checkout -- functions/package.json
git pull -q origin instinct/preview
git log --oneline | head -1
# Guardrail: keep in sync with scripts/cors.json (enforced by
# functions/src/test/unit/cors-guardrail.test.ts). The two newer headers are
# load-bearing: inspection photo signed-URL PUTs fail browser-side without
# x-goog-meta-customerId and x-goog-if-generation-match (found 2026-10-26).
cat > /tmp/cors.json <<'J'
[{"origin":["*"],"method":["PUT","GET","HEAD"],"responseHeader":["Content-Type","x-goog-meta-ownerid","x-goog-meta-ownerId","x-goog-meta-customerId","x-goog-if-generation-match"],"maxAgeSeconds":3600}]
J
gcloud storage buckets update gs://autodeck-studio.firebasestorage.app --cors-file=/tmp/cors.json --project autodeck-studio
sed -i '/workspace:\*/d' functions/package.json
(cd functions && npm install --no-audit --no-fund --silent)
firebase deploy --only firestore:rules,storage,functions --project autodeck-studio --non-interactive
git checkout -- functions/package.json
echo FINISHED
