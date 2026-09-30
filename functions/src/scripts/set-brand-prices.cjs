// Sets market-based prices on the seeded brand products (Meet: "invent the prices based on the current
// market in Ahmedabad"). Each price carries its basis in priceBasis; all stay editable in Admin.
// Products with no market data are left as price-on-request (quote flow). Idempotent.
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "autodeck-studio" });
const db = admin.firestore();
const P = {"xpel-ultimate-plus": [145000, "XPEL full body: Rs 1,05,000-1,85,000 (alwaysdryindia.co.in 2026); Ahmedabad PPF Rs 66,000-2,80,000 (carzspa.com/studios/ahmedabad)"], "xpel-stealth": [175000, "Satin/matte full body runs above gloss: Rs 1,80,000-2,80,000+ (fortifycarcare.in LLumar matte); carzspa.com Ahmedabad range up to Rs 2,80,000"], "xpel-fusion-plus-premium-v2": [28000, "XPEL Fusion Plus coating Rs 14,000-28,000 total (getdetailpro.com); top variant priced at the top of the range"], "xpel-fusion-plus-classic": [18000, "XPEL Fusion Plus coating Rs 14,000-28,000 total (getdetailpro.com); mid range"], "xpel-fusion-plus-lite": [14000, "XPEL Fusion Plus coating Rs 14,000-28,000 total (getdetailpro.com); low end for the Lite variant"], "garware-protect-ppf": [65000, "Garware full body Rs 55,000-95,000 (alwaysdryindia.co.in 2026); Protect is Garware's 3-year entry tier; Ahmedabad full body Rs 50,000-1,80,000 (nextgenautocare.co.in)"], "garware-ceramic-coating": [12000, "Standard 9H ceramic Rs 15,000-25,000 (motorheadz.in); CarzSpa Nikol Ahmedabad ceramic rate card Rs 12,950 (carverseindia.com)"], "llumar-platinum-gloss": [205000, "Matches the studio's own LLumar Platinum price; LLumar full car Rs 1,50,000-4,50,000+ (urbancarcare.com)"], "llumar-platinum-matte": [240000, "Matte full body Rs 1,80,000-2,80,000+ (fortifycarcare.in LLumar); priced above the studio's gloss Platinum"], "llumar-gloss-and-matte": [145000, "Matches the studio's own LLumar Gloss price (5-year line); LLumar full car Rs 1,50,000-4,50,000+ (urbancarcare.com)"], "3m-scotchgard-paint-protection-film-pro-series-200": [115000, "3M PPF full body Rs 70,000-1,25,000 (alwaysdryindia.co.in 2026); Ahmedabad PPF Rs 66,000-2,80,000 (carzspa.com)"], "3m-ceramic-coating": [9999, "3M ceramic coating: hatchback Rs 9,999, sedan Rs 11,999, SUV Rs 12,999 (carxtreme.in/3m-ceramic-coating-price); Rs 10,000-50,000 range (carcare-india.com)"], "kovalent-graphene": [11000, "Graphene ceramic Rs 22,000-35,000 market (motorheadz.in) but set below it, in line with the studio's own Kovalent prices (Prolong 10,000, Graphene Matrix 12,000, Borophene 14,000)"], "fireball-dok-do": [30000, "Flagship 9H, 10-year: premium graphene/pro tier Rs 30,000-45,000 (motorheadz.in); Dok Do kit retails Rs 15,295 (remaxautoconcepts.com)"], "fireball-butterfly-graphene": [18000, "Graphene ceramic Rs 22,000-35,000 market (motorheadz.in); Butterfly Graphene 50ml retails Rs 8,363 (remaxautoconcepts.com); priced at the low end"]};
const PCT = { hatchback: 0, sedan: 10, suv: 20, luxury: 35, van: 20, commercial: 20 };
(async () => {
  let n = 0;
  for (const [suffix, [rupees, basis]] of Object.entries(P)) {
    const id = "svc-brand-" + suffix;
    const ref = db.collection("services").doc(id);
    const snap = await ref.get();
    if (!snap.exists) { console.log("missing", id); continue; }
    const base = rupees * 100;
    const pricing = Object.entries(PCT).filter(([, p]) => p > 0).map(([c, p]) => ({
      vehicleCategory: c, additionalPricePaise: Math.max(50000, Math.round((base * p) / 100 / 50000) * 50000), additionalMinutes: 0,
    }));
    await ref.update({ basePrice: base, vehicleCategoryPricing: pricing, priceOnRequest: false, priceBasis: basis, priceBasisAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    n++;
  }
  console.log("PRICES DONE updated=" + n);
})().catch((e) => { console.error(e); process.exit(1); });
