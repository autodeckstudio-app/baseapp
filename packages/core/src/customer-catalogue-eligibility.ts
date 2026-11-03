/** Reversible local-review safeguard for source-unverified legacy catalogue identities. No stored service, price or history changes. */
const UNVERIFIED_IDS = new Set([
  "menu-coat-autodeck-1",
  "menu-coat-fireball-1",
  "menu-coat-autodeck-2",
  "menu-coat-fireball-2",
  "svc-brand-3m-ceramic-coating",
  "menu-coat-kovalent-prolong",
  "menu-ppf-garware-full-body",
  "menu-ppf-3m-full-body",
  "menu-ppf-llumar-full-body",
  "menu-ppf-xpel-full-body",
  "menu-ppf-garware-full-front",
  "menu-ppf-3m-full-front",
  "menu-ppf-llumar-full-front",
  "menu-ppf-xpel-full-front",
  "menu-ppf-garware-high-impact",
  "menu-ppf-3m-high-impact",
  "menu-ppf-llumar-high-impact",
  "menu-ppf-xpel-high-impact"
]);
export function customerCatalogueEligible(row:{id:string}, previewHold=false):boolean {return previewHold !== true || !UNVERIFIED_IDS.has(row.id);}
