// Adds 4 brand products (Meet's 12:50 PM Oct 1 approval relayed by parent). Specs from brand sites; prices are
// labelled Ahmedabad-market estimates. Uses Firestore REST with an access token in $TOKEN. Idempotent (PATCH by id).
const P = "autodeck-studio", T = process.env.TOKEN;
const PCT = { sedan: 10, suv: 20, luxury: 35, van: 20, commercial: 20 };
const S = (s) => ({ stringValue: s }), I = (n) => ({ integerValue: String(n) }), B = (b) => ({ booleanValue: b }), N = { nullValue: null };
const items = [
  { id: "svc-brand-llumar-select-black", name: "LLumar Select Black", cat: "ppf", brand: "LLumar", rupees: 205000, order: 150,
    desc: "Glossy black colour-change film with the protection of LLumar Platinum PPF. Restyle and protect with one installation. Specs per llumar.com/en/paint-protection-film. Photo is a placeholder.",
    wl: "10-year limited warranty", wv: 10, wu: "years", basis: "Estimate from closest comparable (LLumar Platinum Gloss), not a published price: Ahmedabad market." },
  { id: "svc-brand-garware-titanium", name: "Garware Titanium", cat: "ppf", brand: "Garware", rupees: 165000, order: 151,
    desc: "Garware Titanium paint protection film, full coverage. Specs per garwarehitechfilms.com/paint-protection-films/titanium-ppf. Photo is a placeholder.",
    wl: "Lifetime e-warranty (first-time ownership)", wv: null, wu: "lifetime", basis: "Estimate from closest comparable (Garware Premium), not a published price: Ahmedabad market." },
  { id: "svc-brand-garware-matte", name: "Garware Matte", cat: "ppf", brand: "Garware", rupees: 125000, order: 152,
    desc: "Self-healing matte-finish paint protection film, chemical and stain resistant. Specs per garwarehitechfilms.com/paint-protection-films. Photo is a placeholder.",
    wl: null, wv: null, wu: null, basis: "Estimate from closest comparable (Garware Plus), not a published price: Ahmedabad market." },
  { id: "svc-brand-kovalent-revive", name: "Kovalent Revive", cat: "ceramic", brand: "Kovalent", rupees: 12000, order: 153,
    desc: "Premier ceramic coating with marine protection. Specs per kovalentcoatings.com/products. Photo is a placeholder.",
    wl: null, wv: null, wu: null, basis: "Estimate from closest comparable (Kovalent ceramic range), not a published price: Ahmedabad market." },
];
(async () => {
  for (const it of items) {
    const base = it.rupees * 100, now = new Date().toISOString();
    const pricing = Object.entries(PCT).map(([c, p]) => ({ mapValue: { fields: { vehicleCategory: S(c), additionalPricePaise: I(Math.max(50000, Math.round((base * p) / 100 / 50000) * 50000)), additionalMinutes: I(0) } } }));
    const f = { id: S(it.id), tenantId: S("automodz"), name: S(it.name), category: S(it.cat), brand: S(it.brand), description: S(it.desc),
      basePrice: I(base), currency: S("INR"), estimatedDurationMinutes: I(480), warrantyLabel: it.wl ? S(it.wl) : N,
      warrantyDurationValue: it.wv ? I(it.wv) : N, warrantyDurationUnit: it.wu ? S(it.wu) : N,
      vehicleCategoryPricing: { arrayValue: { values: pricing } }, requiredBayType: S("protection"), membershipWashEligible: B(false),
      priceOnRequest: B(false), active: B(true), displayOrder: I(it.order), priceBasis: S(it.basis), priceBasisAt: S(now), createdAt: S(now), updatedAt: S(now) };
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents/services/${it.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${T}`, "Content-Type": "application/json", "x-goog-user-project": P }, body: JSON.stringify({ fields: f }) });
    console.log(it.id, r.status, r.ok ? "ok" : (await r.text()).slice(0, 200));
  }
})();
