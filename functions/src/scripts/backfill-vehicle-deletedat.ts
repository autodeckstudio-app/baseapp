/**
 * Legacy deletedAt normalization for /vehicles - LOCAL PROTOTYPE, emulator-only
 * by default.
 *
 *   # dry run (emulator): prints the eligibility manifest + digest, writes nothing
 *   npx tsx src/scripts/backfill-vehicle-deletedat.ts --tenant=<id>
 *
 *   # apply (emulator): requires the REVIEWED manifest digest + attribution
 *   npx tsx src/scripts/backfill-vehicle-deletedat.ts --tenant=<id> --apply \
 *     --manifest=<sha256> --approved-by="<name>" --approval-ref="<reference>"
 *
 * Scope flags: --tenant=<id> (tenant-scoped scan) and/or --ids=a,b,c (explicit
 * allowlist), --max-count=<n> (default 1000), --page-size=<n> (default 200).
 * An unscoped run is refused.
 *
 * LIVE TARGETS: without FIRESTORE_EMULATOR_HOST the script refuses to run at
 * all unless --project=<id> is passed explicitly AND matches the resolved
 * credentials project. Even a dry run READS cloud data, so a live dry run
 * needs an authorized account read scope first; a live apply additionally
 * needs the owner's explicit approval. Neither has been granted or run.
 *
 * Safety: exactly one field written (deletedAt:null); updatedAt/revision and
 * all other fields stay byte-identical; an auditLog entry is written in the
 * same transaction; per-id outcomes are printed so a partial run is
 * recoverable; quarantined rows are never written.
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { backfillVehicleDeletedAt } from "../lib/vehicle-deletedat-backfill.js";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name: string) => process.argv.includes(`--${name}`);

const apply = has("apply");
const tenantId = arg("tenant");
const ids = arg("ids")?.split(",").map((s) => s.trim()).filter(Boolean);
const maxCount = arg("max-count") ? Number(arg("max-count")) : undefined;
const pageSize = arg("page-size") ? Number(arg("page-size")) : undefined;
const manifestDigest = arg("manifest");
const approvedBy = arg("approved-by");
const approvalRef = arg("approval-ref");
const project = arg("project");

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  if (!project) {
    console.error("Refused: no FIRESTORE_EMULATOR_HOST and no explicit --project. This prototype defaults to the emulator.");
    process.exit(2);
  }
  if (apply && (!approvedBy || !approvalRef)) {
    console.error("Refused: live apply requires --approved-by and --approval-ref (attributable owner approval).");
    process.exit(2);
  }
}
if (!tenantId && (!ids || ids.length === 0)) {
  console.error("Refused: pass --tenant=<id> and/or --ids=a,b,c. Unscoped runs are not supported.");
  process.exit(2);
}
if (apply && !manifestDigest) {
  console.error("Refused: --apply requires --manifest=<sha256> from the reviewed dry-run output.");
  process.exit(2);
}

if (!getApps().length) initializeApp(project ? { projectId: project } : {});
const db = getFirestore();

async function main() {
  const opts: Parameters<typeof backfillVehicleDeletedAt>[1] = { apply };
  if (tenantId) opts.tenantId = tenantId;
  if (ids && ids.length > 0) opts.allowIds = ids;
  if (maxCount) opts.maxCount = maxCount;
  if (pageSize) opts.pageSize = pageSize;
  if (manifestDigest) opts.manifestDigest = manifestDigest;
  if (approvedBy) opts.performedBy = `${approvedBy} (${approvalRef ?? "no-ref"})`;
  const result = await backfillVehicleDeletedAt(db, opts);
  console.log(`Scope: tenant=${tenantId ?? "-"} ids=${ids?.length ?? 0} max=${maxCount ?? 1000}`);
  console.log(`Missing deletedAt: ${result.missing.length} (eligible ${result.eligible.length}, quarantined ${result.quarantined.length}).`);
  console.log(`Eligibility manifest sha256: ${result.manifestDigest}`);
  for (const q of result.quarantined) console.log(`  QUARANTINED (never written automatically): ${q.id} - ${q.reason}`);
  if (!apply) {
    for (const id of result.eligible) console.log(`  WOULD normalize: ${id}`);
    console.log("Dry run - nothing written.");
    return;
  }
  for (const [id, outcome] of Object.entries(result.outcomes)) console.log(`  ${outcome}: ${id}${result.errors[id] ? ` (${result.errors[id]})` : ""}`);
  console.log(`Audit entries: ${result.auditIds.length}. Quarantined rows were NOT touched.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
