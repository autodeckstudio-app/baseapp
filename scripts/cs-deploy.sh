exec > /tmp/dpl4.log 2>&1
set -x
cd ~/baseapp
git checkout -- functions/package.json
git pull -q origin instinct/preview
git log --oneline | head -1
cat > /tmp/cors.json <<'J'
[{"origin":["*"],"method":["PUT","GET","HEAD"],"responseHeader":["Content-Type","x-goog-meta-ownerid","x-goog-meta-ownerId"],"maxAgeSeconds":3600}]
J
gcloud storage buckets update gs://autodeck-studio.firebasestorage.app --cors-file=/tmp/cors.json --project autodeck-studio
sed -i '/workspace:\*/d' functions/package.json
(cd functions && npm install --no-audit --no-fund --silent)
firebase deploy --only firestore:rules,storage,functions --project autodeck-studio --non-interactive
git checkout -- functions/package.json
echo FINISHED
