// Run from functions/: npx tsx src/scripts/export-site-menu.ts. Writes apps/site/src/data/menu.json from the shared menu (packages/core/src/menu.ts) so the website lists the same structure.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MENU_GROUPS, MENU_SEED, PAINT_INSPECTION_NOTE, COVERAGE_LEVELS, needsInspectionNote } from "@autodeck/core";

const out = {
  note: PAINT_INSPECTION_NOTE,
  coverage: COVERAGE_LEVELS,
  groups: MENU_GROUPS.map((g) => ({
    key: g.key, label: g.label, blurb: g.blurb, byBrand: g.byBrand,
    items: MENU_SEED.filter((m) => m.group === g.key).sort((a, b) => a.order - b.order).map((m) => ({
      name: m.name, brand: m.brand, rupees: m.rupees, consult: m.consult === true, from: m.priceFrom === true || m.group === "ppf" && m.coverageLevel === "full_body",
      coverage: m.coverageLevel ?? null, warranty: m.warrantyLabel ?? "", hours: Math.round((m.minutes / 60) * 10) / 10, inspection: needsInspectionNote(m.category),
    })),
  })),
};
writeFileSync(resolve(process.cwd(), "../apps/site/src/data/menu.json"), JSON.stringify(out, null, 2) + "\n");
console.log("wrote menu.json", out.groups.map((g) => `${g.key}:${g.items.length}`).join(" "));
