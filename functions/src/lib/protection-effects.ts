// How a delivered job changes a vehicle's Protection records.
// NEVER inferred from a catalog service id, name or category: a purchased
// service is not performed work. Staff declare the ACTUAL events at delivery
// - install / replace / remove - each with its own identity, explicit
// targets, and the revision of the target the staff member was looking at.
// Nothing supersedes or removes a record unless a declared event names it;
// history ("superseded"/"removed") and provenance (owner, source) are
// preserved forever.
import type { Protection, ServiceJob } from "@autodeck/core";

export type ProtectionInstallSpec = {
  kind: "ppf" | "ceramic";
  coverage: "full_body" | "full_front" | "high_impact";
  brand: string | null;
  warrantyYears: number | null;
};

export type ProtectionWorkEvent =
  | ({ action: "install" } & ProtectionInstallSpec)
  | ({ action: "replace"; targetProtectionId: string; expectedRevision: number } & ProtectionInstallSpec)
  | { action: "remove"; targetProtectionId: string; expectedRevision: number };

export type PlannedEvent =
  | { action: "install"; eventIndex: number; record: Protection }
  | { action: "replace"; eventIndex: number; record: Protection; supersedeId: string; supersedeNextRevision: number }
  | { action: "remove"; eventIndex: number; removeId: string; removeNextRevision: number };

/**
 * Deterministic per-event install id: the payload index is part of the
 * operation's identity, so an exact retry of the same declaration replays
 * event-for-event and never double-applies. No per-kind or per-count
 * assumptions - any number of explicit events is plannable.
 */
export function installId(jobId: string, eventIndex: number): string {
  return `job-${jobId}-ev${eventIndex}`;
}

const isCurrent = (p: Protection) => (p.lifecycle ?? "current") === "current";
// A record with NO coverage field has UNKNOWN scope - it must never be
// treated as whole-car (or any scope) by inference. Unknown scope blocks a
// like-for-like replacement; the honest paths are an explicit removal plus
// a new install, or a staff-confirmed scope repair on the record first.

/**
 * Defense-in-depth no-dup guard (NOT a replay/receipt mechanism - the
 * terminal DELIVERED gate on the job is what rejects a normal retry, and
 * this planner makes no exact-replay claim). If a record already sits at
 * this event's deterministic id, it is left untouched ONLY when it still
 * matches the declaration's immutable identity exactly; anything else at
 * that id is a conflict, never a silent skip or re-apply.
 */
function matchesCommittedInstall(rec: Protection, job: Pick<ServiceJob, "id" | "tenantId" | "customerId" | "vehicleId">, ev: ProtectionInstallSpec): boolean {
  return (
    rec.kind === ev.kind &&
    rec.coverage === ev.coverage &&
    (rec.provider ?? null) === (ev.brand ?? null) &&
    (rec.warrantyYears ?? null) === (ev.warrantyYears ?? null) &&
    rec.tenantId === job.tenantId &&
    rec.vehicleId === job.vehicleId &&
    rec.customerId === job.customerId &&
    rec.installedByJobId === job.id
  );
}

/**
 * Pure planner over the staff-declared events and the vehicle's EXISTING
 * protection records (all kinds, read fresh in-tx, doc-id authoritative, and
 * tenant+vehicle filtered by the caller - a record entered for a FORMER
 * owner of this car is still a valid target on the car, and its owner and
 * source are preserved untouched when it becomes history).
 *
 * Fails closed on: unknown id, a non-current (history) target that this same
 * job did not already retire (replay), two events naming the same target, a
 * stale expectedRevision (the record changed since the staff member looked),
 * a replacement that changes kind or coverage scope (silent coverage loss is
 * never allowed - declare an explicit removal plus install instead), and any
 * replay whose committed record no longer matches the declaration exactly.
 */
export function planProtectionEvents(params: {
  job: Pick<ServiceJob, "id" | "tenantId" | "customerId" | "vehicleId">;
  events: ProtectionWorkEvent[];
  existing: Protection[];
  actorUid: string;
  now: string;
}): { outcomes: PlannedEvent[] } {
  const { job, events, existing, actorUid, now } = params;
  const outcomes: PlannedEvent[] = [];
  const targeted = new Set<string>();

  events.forEach((ev, i) => {
    let target: Protection | undefined;
    if (ev.action !== "install") {
      target = existing.find((p) => p.id === ev.targetProtectionId);
      if (!target) throw new Error(`Declared ${ev.action} target ${ev.targetProtectionId} is not a protection record on this vehicle.`);
      if (targeted.has(target.id)) throw new Error(`Two declared events name the same protection record ${target.id}.`);
      targeted.add(target.id);
      // Delivery declarations manage the COSMETIC protection lifecycle only.
      // A remove/replace event can never retire an insurance, FastTag, PUC,
      // RC or warranty record - those are legal/financial documents with
      // their own lifecycle, and no UI path offers them as targets.
      if (target.kind !== "ppf" && target.kind !== "ceramic") {
        throw new Error(`Declared ${ev.action} target ${target.id} is a ${target.kind} record, not cosmetic protection. Delivery declarations manage PPF/ceramic records only.`);
      }
    }

    if (ev.action === "remove") {
      const t = target!;
      // No-dup guard first: this same job already retired this record. The
      // record is history now (and its revision has moved on), so the
      // checks below must NOT turn an already-applied outcome into an error.
      if ((t.lifecycle ?? "current") === "removed" && t.removedByJobId === job.id) return;
      if (!isCurrent(t)) throw new Error(`Declared removal target ${t.id} is already history.`);
      if ((t.revision ?? 0) !== ev.expectedRevision) throw new Error(`Declared removal target ${t.id} has changed since it was reviewed. Refresh the car's protection records and declare again.`);
      outcomes.push({ action: "remove", eventIndex: i, removeId: t.id, removeNextRevision: (t.revision ?? 0) + 1 });
      return;
    }

    // install / replace share the install half. No-dup guard: the event's
    // deterministic record already exists AND still matches the declaration
    // exactly (and, for a replacement, its named target really was retired
    // by this job). Anything else at that id is a conflict.
    const committed = existing.find((p) => p.id === installId(job.id, i));
    if (committed) {
      if (!matchesCommittedInstall(committed, job, ev)) {
        throw new Error(`Delivery replay conflict at event ${i + 1}: the recorded work no longer matches this declaration. Refresh the job and the car's protection records instead of resubmitting.`);
      }
      if (ev.action === "replace") {
        const t = target!;
        if ((t.lifecycle ?? "current") !== "superseded" || t.supersededByJobId !== job.id) {
          throw new Error(`Delivery replay conflict at event ${i + 1}: the declared replacement target was not retired by this job. Refresh the car's protection records instead of resubmitting.`);
        }
      }
      return; // already applied by this job: apply nothing twice
    }

    const record: Protection = {
      id: installId(job.id, i),
      tenantId: job.tenantId,
      vehicleId: job.vehicleId,
      customerId: job.customerId,
      kind: ev.kind,
      provider: ev.brand,
      policyNumber: null,
      startDate: now.slice(0, 10),
      // expiryDate stays null: no coverage end date is derived from a
      // performed-work declaration.
      expiryDate: null,
      warrantyYears: ev.warrantyYears,
      documentUrl: null,
      status: "verified",
      source: "autodeck",
      coverage: ev.coverage,
      lifecycle: "current",
      installedByJobId: job.id,
      supersededByJobId: null,
      removedByJobId: null,
      lifecycleAt: null,
      verifiedBy: actorUid,
      verifiedAt: now,
      notes: null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    if (ev.action === "install") {
      outcomes.push({ action: "install", eventIndex: i, record });
      return;
    }
    // replace: the named current record is explicitly superseded by this
    // job - same kind, same coverage scope ONLY. A replacement that would
    // change what is covered (say, a full-body PPF record superseded by a
    // high-impact ceramic one) silently destroys coverage; that must be
    // declared as an explicit removal plus install, never smuggled through
    // a "replace".
    const t = target!;
    if (!isCurrent(t)) throw new Error(`Declared replacement target ${t.id} is already history.`);
    if ((t.revision ?? 0) !== ev.expectedRevision) throw new Error(`Declared replacement target ${t.id} has changed since it was reviewed. Refresh the car's protection records and declare again.`);
    if (t.coverage == null) {
      throw new Error(`Declared replacement target ${t.id} has no recorded coverage scope - its scope is unknown, and unknown is never assumed. Remove it explicitly and install the new record, or repair the record's scope first.`);
    }
    if (t.kind !== ev.kind || t.coverage !== ev.coverage) {
      throw new Error(`Declared replacement changes the kind or coverage of ${t.id}. Declare an explicit removal plus a new install instead, so the change of coverage is on record.`);
    }
    outcomes.push({
      action: "replace", eventIndex: i, record,
      supersedeId: t.id,
      supersedeNextRevision: (t.revision ?? 0) + 1,
    });
  });

  return { outcomes };
}
