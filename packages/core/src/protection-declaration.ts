// Building the staff-declared protection-work declaration for a delivery.
// The declaration is the staff member's explicit statement of the work
// ACTUALLY performed - never derived from the booked service, which is
// shown as context only and never prefills anything. Every field that
// describes the work starts UNCHOSEN (null) and must be affirmed by the
// staff member; nothing is inherited silently from an old record.
import type { Protection, ProtectionCosmeticKind, ProtectionCoverageScope, ProtectionWorkEvent } from "./types/index.js";


// kind/coverage are null until the staff member explicitly picks them - the
// app never pre-affirms scope or protection type.
export type DraftInstall = { action: "install"; kind: ProtectionCosmeticKind | null; coverage: ProtectionCoverageScope | null; brand: string; warrantyYears: string };
// expectedRevision is FROZEN when the staff member selects the target (see
// selectTarget). If the record changes afterwards, the build refuses the
// stale selection instead of quietly re-aiming at the newer revision.
export type DraftReplace = { action: "replace"; targetProtectionId: string | null; expectedRevision: number | null; brand: string; warrantyYears: string };
export type DraftRemove = { action: "remove"; targetProtectionId: string | null; expectedRevision: number | null };
export type DraftEvent = DraftInstall | DraftReplace | DraftRemove;

/** The declaration choice: null = the staff member has NOT chosen yet (the
 * delivery cannot be confirmed - an absent choice is never a silent none). */
export type DeclarationDraft = { choice: null } | { choice: "none" } | { choice: "work"; events: DraftEvent[] };

/** Records that can be named as replace/remove targets: current COSMETIC
 * (PPF/ceramic) records on THIS car only. History is never a target, and
 * neither are legal/financial records (insurance, FastTag, PUC, RC, extended
 * warranty) - delivery declarations manage the cosmetic protection lifecycle
 * only, and the backend rejects any event naming a non-cosmetic record. */
export function targetableRecords(protections: Protection[]): Protection[] {
  return protections.filter((p) => (p.lifecycle ?? "current") === "current" && (p.kind === "ppf" || p.kind === "ceramic"));
}

export function newInstallDraft(): DraftInstall {
  return { action: "install", kind: null, coverage: null, brand: "", warrantyYears: "" };
}

/** A replacement is like-for-like: kind and coverage come FROM the target
 * record and are not editable - a change of kind or scope must be declared
 * as a removal plus a new install (the backend rejects anything else). */
export function newReplaceDraft(): DraftReplace {
  return { action: "replace", targetProtectionId: null, expectedRevision: null, brand: "", warrantyYears: "" };
}

export function newRemoveDraft(): DraftRemove {
  return { action: "remove", targetProtectionId: null, expectedRevision: null };
}

/** Freezes the staff member's target selection, including the revision the
 * record showed at THAT moment. Re-running selectTarget (or clearing and
 * re-picking) is the only way to aim at a newer revision - never automatic. */
export function selectTarget<T extends DraftReplace | DraftRemove>(draft: T, target: Protection): T {
  return { ...draft, targetProtectionId: target.id, expectedRevision: target.revision ?? 0 };
}

const years = (raw: string): number | null | "invalid" => {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0 || n > 30) return "invalid";
  return n;
};

/** Validates the draft and builds the exact wire payload, or null when the
 * declaration is incomplete/invalid/stale (the confirm button must stay off). */
export function buildProtectionWork(draft: DeclarationDraft, protections: Protection[]): ProtectionWorkEvent[] | null {
  if (draft.choice === null) return null;
  if (draft.choice === "none") return [];
  if (draft.events.length === 0) return null;
  const targets = new Map(targetableRecords(protections).map((p) => [p.id, p]));
  const events: ProtectionWorkEvent[] = [];
  const seenTargets = new Set<string>();
  for (const ev of draft.events) {
    if (ev.action === "install") {
      if (ev.kind === null || ev.coverage === null) return null; // scope must be affirmed, never defaulted
      const wy = years(ev.warrantyYears);
      if (wy === "invalid") return null;
      events.push({ action: "install", kind: ev.kind, coverage: ev.coverage, brand: ev.brand.trim() || null, warrantyYears: wy });
      continue;
    }
    if (!ev.targetProtectionId) return null;
    const target = targets.get(ev.targetProtectionId);
    if (!target) return null;
    if (seenTargets.has(target.id)) return null; // two events, one record: never
    seenTargets.add(target.id);
    // The frozen selection must still match the record's current revision.
    // A mismatch means the record changed since the staff member picked it:
    // refuse (null) so the UI forces re-review - never auto-advance.
    if (ev.expectedRevision === null || (target.revision ?? 0) !== ev.expectedRevision) return null;
    if (ev.action === "remove") {
      events.push({ action: "remove", targetProtectionId: target.id, expectedRevision: ev.expectedRevision });
      continue;
    }
    const wy = years(ev.warrantyYears);
    if (wy === "invalid") return null;
    // Like-for-like: kind + coverage are the target's own, never re-asked.
    if (target.coverage == null || (target.kind !== "ppf" && target.kind !== "ceramic")) return null;
    // Brand and warranty describe the NEW work. They are what the staff
    // member entered, or null - NEVER inherited from the old record, which
    // would silently turn the old product into evidence of the new work.
    events.push({
      action: "replace",
      targetProtectionId: target.id,
      expectedRevision: ev.expectedRevision,
      kind: target.kind,
      coverage: target.coverage,
      brand: ev.brand.trim() || null,
      warrantyYears: wy,
    });
  }
  return events;
}
