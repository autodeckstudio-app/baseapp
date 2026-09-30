exec > /tmp/dpl6.log 2>&1
set -x
cd ~/baseapp
git checkout -- functions/package.json
git pull -q origin instinct/preview
git log --oneline | head -1
sed -i '/workspace:\*/d' functions/package.json
(cd functions && npm install --no-audit --no-fund --silent)
firebase deploy --only functions:createBooking,functions:createService,functions:updateService,functions:advanceJobStatus,functions:setBookingQuote,functions:respondToBookingQuote --project autodeck-studio --non-interactive
git checkout -- functions/package.json
(cd functions && node src/scripts/seed-brand-products.cjs)
(cd functions && node src/scripts/set-brand-prices.cjs)
echo FINISHED
