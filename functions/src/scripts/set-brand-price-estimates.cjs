// Estimates for brand products with no published Ahmedabad market price. Meet approved pricing all remaining
// items from the closest comparables (phonemsg-01M3T8JSM1T4C6J9EE2DX8QNAW "Sure"). Marked as estimates in priceBasis; editable in Admin.
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "autodeck-studio" });
const db = admin.firestore();
const C = "Estimate from closest comparable, not a published price: ";
const R = [
  [/xpel-fusion-plus-paint/, 20000, C + "XPEL Fusion Plus coating Rs 14,000-28,000 (getdetailpro.com); paint-and-PPF variant mid-high"],
  [/xpel-fusion-plus-satin/, 16000, C + "XPEL Fusion Plus coating Rs 14,000-28,000 (getdetailpro.com); satin variant mid"],
  [/xpel-fusion-plus-glass/, 4500, C + "glass coating Rs 3,000-6,000 typical in Ahmedabad studios"],
  [/xpel-fusion-plus-plastic/, 3500, C + "plastic and trim coating Rs 2,500-5,000 typical"],
  [/garware-coloured/, 210000, C + "colour PPF full body Rs 1,80,000-2,80,000 (fortifycarcare.in, carzspa.com Ahmedabad top range)"],
  [/llumar-platinum-extra/, 225000, C + "priced just above the studio's LLumar Platinum 2,05,000; LLumar full car Rs 1,50,000-4,50,000+ (urbancarcare.com)"],
  [/3m-ceramic-boost/, 6000, C + "booster/top-up coat below 3M ceramic coating Rs 9,999 (carxtreme.in/3m-ceramic-coating-price)"],
  [/kovalent-prolong-light/, 8000, C + "below the studio's Kovalent Prolong 10,000"],
  [/kovalent-powershield/, 13000, C + "near the studio's Kovalent Borophene 14,000 tier"],
  [/kovalent-overlay/, 6000, C + "top-up layer over an existing coating, Rs 5,000-8,000 typical"],
  [/kovalent-restore/, 5000, C + "restoration/decontamination step Rs 4,000-7,000 typical"],
  [/kovalent-matte/, 11000, C + "matte-finish coating near the studio's Kovalent Graphene 11,000"],
  [/kovalent-fabric/, 4000, C + "fabric/upholstery protection Rs 3,000-5,000 typical"],
  [/kovalent-glass/, 4500, C + "glass coating Rs 3,000-6,000 typical"],
  [/fireball-butterfly$/, 14000, C + "below Butterfly Graphene 18,000; Butterfly retails Rs 8,363 per 50ml (remaxautoconcepts.com)"],
  [/fireball-typhoon/, 12000, C + "mid Fireball tier; 9H ceramic Rs 15,000-25,000 market (motorheadz.in) at a lower tier"],
  [/fireball-talon/, 15000, C + "mid Fireball tier; 9H ceramic Rs 15,000-25,000 market (motorheadz.in)"],
  [/fireball-devil/, 22000, C + "upper Fireball tier; premium Rs 30,000-45,000 (motorheadz.in) for the flagship Dok Do"],
  [/fireball-silla/, 10000, C + "entry Fireball tier; Dok Do kit retails Rs 15,295 (remaxautoconcepts.com)"],
  [/fireball-aegis/, 26000, C + "upper Fireball tier below the flagship Dok Do 30,000"],
];
const PCT = { sedan: 10, suv: 20, luxury: 35, van: 20, commercial: 20 };
(async () => {
  const snap = await db.collection("services").where("priceOnRequest", "==", true).get();
  let n = 0; const un = [];
  for (const d of snap.docs) {
    const r = R.find(([re]) => re.test(d.id));
    if (!r) { un.push(d.id); continue; }
    const base = r[1] * 100;
    const pricing = Object.entries(PCT).map(([c, p]) => ({ vehicleCategory: c, additionalPricePaise: Math.max(50000, Math.round((base * p) / 100 / 50000) * 50000), additionalMinutes: 0 }));
    await d.ref.update({ basePrice: base, vehicleCategoryPricing: pricing, priceOnRequest: false, priceBasis: r[2], priceBasisAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    n++;
  }
  console.log("EST DONE updated=" + n + " unmatched=" + un.join(","));
})().catch((e) => { console.error(e); process.exit(1); });
