/**
 * Menu migration: puts the approved service menu (packages/core/src/menu.ts) into Firestore.
 *
 *   npx tsx src/scripts/seed-menu.ts                 # dry run: prints exactly what would change, writes nothing
 *   npx tsx src/scripts/seed-menu.ts --apply         # creates missing menu services, leaves existing ones untouched
 *   npx tsx src/scripts/seed-menu.ts --apply --retire  # also hides (active:false) the old services the new menu replaces
 *
 * Safe to re-run: new services use deterministic ids (menu-*) and are created only once, so
 * a price the owner already tuned in admin is never overwritten. Nothing is deleted; "retire"
 * only switches a service off in the catalogue (reversible from admin). Old bookings, jobs and
 * invoices keep their own snapshots of service name and price.
 * Targets whatever project the Admin SDK default credentials point at (or the emulator).
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { FIRST_TENANT_ID, MENU_SEED, menuGroupOf, sizePricingForCategory, type Service } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

if (!getApps().length) initializeApp();
const db = getFirestore();
const apply = process.argv.includes("--apply");
const retire = process.argv.includes("--retire");
const tenantId = process.argv.find((a) => a.startsWith("tenant="))?.slice(7) ?? FIRST_TENANT_ID;

async function main() {
  const col = db.collection(COLLECTIONS.services());
  const snap = await col.where("tenantId", "==", tenantId).get();
  const existing = new Map(snap.docs.map((d) => [d.id, d.data() as Service]));
  const now = new Date().toISOString();

  const toCreate = MENU_SEED.filter((m) => !existing.has(m.id));
  const keep = MENU_SEED.length - toCreate.length;
  // Old services in the four groups the new menu replaces. Tint, inspection and other items move group by category alone.
  const REPLACED = new Set(["washing", "ceramic", "coating", "ppf"]);
  const toRetire = [...existing.entries()].filter(([id, s]) => !id.startsWith("menu-") && s.active && REPLACED.has(s.category));
  const regroup = [...existing.entries()].filter(([id, s]) => !id.startsWith("menu-") && !REPLACED.has(s.category));

  console.log(`Tenant ${tenantId}: ${existing.size} existing services.`);
  console.log(`\nCREATE ${toCreate.length} menu services (${keep} already present, left untouched):`);
  for (const m of toCreate) console.log(`  [${menuGroupOf(m.category).label}] ${m.name}${m.brand ? ` (${m.brand})` : ""} - ${m.consult ? "consult" : `from Rs ${m.rupees.toLocaleString("en-IN")}${m.placeholder ? " (placeholder price)" : ""}`}`);
  console.log(`\nREGROUP (no data change, now shown under the new group): ${regroup.length}`);
  for (const [, s] of regroup) console.log(`  ${s.name}: ${s.category} -> ${menuGroupOf(s.category).label}`);
  console.log(`\nOLD SERVICES the new menu replaces: ${toRetire.length}${retire ? " (will be switched off)" : " (stay live unless --retire is passed)"}`);
  for (const [, s] of toRetire) console.log(`  ${s.name} [${s.category}${s.brand ? `, ${s.brand}` : ""}] Rs ${(s.basePrice / 100).toLocaleString("en-IN")}`);

  if (!apply) { console.log("\nDry run only. Re-run with --apply to write."); return; }

  let batch = db.batch(); let n = 0;
  const flush = async () => { if (n) { await batch.commit(); batch = db.batch(); n = 0; } };
  for (const m of toCreate) {
    const base = m.rupees * 100;
    const doc: Service = {
      id: m.id, tenantId, name: m.name, category: m.category, brand: m.brand, description: m.description,
      basePrice: base, currency: "INR", estimatedDurationMinutes: m.minutes,
      warrantyLabel: m.warrantyLabel ?? null, warrantyDurationValue: m.warrantyYears ?? null, warrantyDurationUnit: m.warrantyYears ? "years" : null,
      vehicleCategoryPricing: m.consult || m.group === "pickup" || m.group === "garage" ? [] : sizePricingForCategory(m.category, base),
      requiredBayType: m.bay, membershipWashEligible: m.group === "wash", priceOnRequest: m.consult === true,
      coverageLevel: m.coverageLevel ?? null, priceFrom: m.priceFrom === true,
      ...(m.placeholder ? { internalNotes: "Starting price for the owner to tune. No study anchor for this item." } : {}),
      active: true, displayOrder: m.order, createdAt: now, updatedAt: now,
    };
    batch.set(col.doc(m.id), doc); if (++n >= 400) await flush();
  }
  if (retire) for (const [id] of toRetire) { batch.update(col.doc(id), { active: false, updatedAt: now }); if (++n >= 400) await flush(); }
  await flush();
  console.log(`\nDone: created ${toCreate.length}${retire ? `, retired ${toRetire.length}` : ""}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
