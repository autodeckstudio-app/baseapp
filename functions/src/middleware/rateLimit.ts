import { HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { AuthorizedUser, UserRole } from "@autodeck/auth";
import { COLLECTIONS } from "@autodeck/database";

/**
 * Fixed-window, per-uid+action abuse counters. Server-side only — no paid
 * service, no scheduler. Windows are never physically deleted; a doc past
 * its window is simply overwritten on next use (see design note in Phase
 * 3D HANDOFF: "expired windows can be overwritten/reused safely").
 */
export type RateLimitAction =
  | "auth.setupProfile"
  | "auth.resolveClaims"
  | "booking.create"
  | "booking.cancel"
  | "booking.reschedule"
  | "job.walkinCreate"
  | "job.advanceStatus"
  | "job.assignBay"
  | "approval.create"
  | "approval.respond"
  | "approval.cancel"
  | "payment.initiate"
  | "payment.confirmMock"
  | "payment.confirmManual"
  | "payment.refund"
  | "payment.recordManual"
  | "membership.purchase"
  | "membership.activate"
  | "membership.cancel"
  | "membership.planCreate"
  | "membership.planUpdate"
  | "membership.planSetActive"
  | "service.create"
  | "service.update"
  | "service.setActive"
  | "studio.updateSettings"
  | "studio.upsertBay"
  | "studio.addHoliday"
  | "studio.removeHoliday"
  | "employee.add"
  | "employee.updateRole"
  | "employee.deactivate"
  | "attendance.checkIn"
  | "attendance.checkOut"
  | "attendance.break"
  | "attendance.mark"
  | "attendance.readStudio"
  | "attendance.readEmployee"
  | "expense.create"
  | "expense.update"
  | "expense.delete"
  | "expense.read"
  | "inventory.create"
  | "inventory.update"
  | "inventory.txn"
  | "inventory.read"
  | "paper.submit"
  | "paper.review"
  | "paper.update"
  | "paper.read"
  | "dailyClose.perform"
  | "dailyClose.read"
  | "gallery.create"
  | "gallery.update"
  | "gallery.delete"
  | "gallery.read"
  | "office.dashboard"
  | "office.report"
  | "vehicle.create"
  | "vehicle.update"
  | "vehicle.archive"
  | "protection.create"
  | "protection.update"
  | "invoice.void"
  | "inspection.start"
  | "inspection.update"
  | "inspection.finalize"
  | "read.availability"
  | "read.catalogue"
  | "read.calculatePrice"
  | "read.studioJobs"
  | "read.myMemberships"
  | "read.membershipPlans"
  | "read.membershipUsage"
  | "notification.markRead";

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

// CRITICAL mutations: tight windows for customer-facing/public-risk actions;
// looser windows for studio/admin-only actions performed by trusted staff at
// realistic business throughput (a busy front desk can process many jobs per
// minute — see Phase 3D HANDOFF: raised after the emulator suite proved the
// initial studio/admin limits blocked legitimate rapid sequential usage).
// MODERATE reads: looser windows still. Deliberately NOT applied to every
// callable — see Phase 3D HANDOFF audit (LOW-tier: health, onAuditLogCreated
// trigger, and the two zero-caller expireStale* ops functions are left
// unlimited; unauthenticated requests are already rejected by extractUser
// before any rate-limit code runs). Phase 5B P1-13 hardening review (Batch
// 4) found health.ts's extractUser/assertRole check had gone missing
// entirely — it was fixed there specifically to make this LOW-tier
// assumption true again, not weakened.
const RATE_LIMITS: Record<RateLimitAction, RateLimitConfig> = {
  "auth.setupProfile": { limit: 10, windowMs: 60_000 },
  "auth.resolveClaims": { limit: 20, windowMs: 60_000 },
  "booking.create": { limit: 10, windowMs: 60_000 },
  "booking.cancel": { limit: 10, windowMs: 60_000 },
  "booking.reschedule": { limit: 10, windowMs: 60_000 },
  "job.walkinCreate": { limit: 60, windowMs: 60_000 },
  "job.advanceStatus": { limit: 60, windowMs: 60_000 },
  "job.assignBay": { limit: 60, windowMs: 60_000 },
  "approval.create": { limit: 60, windowMs: 60_000 },
  "approval.respond": { limit: 30, windowMs: 60_000 },
  "approval.cancel": { limit: 60, windowMs: 60_000 },
  "payment.initiate": { limit: 10, windowMs: 60_000 },
  "payment.confirmMock": { limit: 60, windowMs: 60_000 },
  "payment.confirmManual": { limit: 60, windowMs: 60_000 },
  "payment.refund": { limit: 30, windowMs: 60_000 },
  "payment.recordManual": { limit: 60, windowMs: 60_000 },
  "membership.purchase": { limit: 5, windowMs: 60_000 },
  "membership.activate": { limit: 60, windowMs: 60_000 },
  "membership.cancel": { limit: 60, windowMs: 60_000 },
  "membership.planCreate": { limit: 30, windowMs: 60_000 },
  "membership.planUpdate": { limit: 60, windowMs: 60_000 },
  "membership.planSetActive": { limit: 60, windowMs: 60_000 },
  "service.create": { limit: 60, windowMs: 60_000 },
  "service.update": { limit: 60, windowMs: 60_000 },
  "service.setActive": { limit: 60, windowMs: 60_000 },
  "studio.updateSettings": { limit: 30, windowMs: 60_000 },
  "studio.upsertBay": { limit: 60, windowMs: 60_000 },
  "studio.addHoliday": { limit: 60, windowMs: 60_000 },
  "studio.removeHoliday": { limit: 60, windowMs: 60_000 },
  "employee.add": { limit: 30, windowMs: 60_000 },
  "attendance.checkIn": { limit: 30, windowMs: 60_000 },
  "attendance.checkOut": { limit: 30, windowMs: 60_000 },
  "attendance.break": { limit: 60, windowMs: 60_000 },
  "attendance.mark": { limit: 60, windowMs: 60_000 },
  "attendance.readStudio": { limit: 120, windowMs: 60_000 },
  "attendance.readEmployee": { limit: 120, windowMs: 60_000 },
  "expense.create": { limit: 30, windowMs: 60_000 },
  "expense.update": { limit: 30, windowMs: 60_000 },
  "expense.delete": { limit: 30, windowMs: 60_000 },
  "expense.read": { limit: 120, windowMs: 60_000 },
  "inventory.create": { limit: 30, windowMs: 60_000 },
  "inventory.update": { limit: 30, windowMs: 60_000 },
  "inventory.txn": { limit: 60, windowMs: 60_000 },
  "inventory.read": { limit: 120, windowMs: 60_000 },
  "paper.submit": { limit: 30, windowMs: 60_000 },
  "paper.review": { limit: 30, windowMs: 60_000 },
  "paper.update": { limit: 30, windowMs: 60_000 },
  "paper.read": { limit: 120, windowMs: 60_000 },
  "dailyClose.perform": { limit: 30, windowMs: 60_000 },
  "dailyClose.read": { limit: 120, windowMs: 60_000 },
  "gallery.create": { limit: 30, windowMs: 60_000 },
  "gallery.update": { limit: 30, windowMs: 60_000 },
  "gallery.delete": { limit: 30, windowMs: 60_000 },
  "gallery.read": { limit: 120, windowMs: 60_000 },
  "office.dashboard": { limit: 120, windowMs: 60_000 },
  "office.report": { limit: 60, windowMs: 60_000 },
  "employee.updateRole": { limit: 60, windowMs: 60_000 },
  "employee.deactivate": { limit: 30, windowMs: 60_000 },
  "vehicle.create": { limit: 20, windowMs: 60_000 },
  "vehicle.update": { limit: 30, windowMs: 60_000 },
  "vehicle.archive": { limit: 20, windowMs: 60_000 },
  "protection.create": { limit: 60, windowMs: 60_000 },
  "protection.update": { limit: 60, windowMs: 60_000 },
  "invoice.void": { limit: 30, windowMs: 60_000 },
  "inspection.start": { limit: 30, windowMs: 60_000 },
  "inspection.update": { limit: 120, windowMs: 60_000 }, // many small checklist edits per session
  "inspection.finalize": { limit: 30, windowMs: 60_000 },
  "read.availability": { limit: 120, windowMs: 60_000 },
  "read.catalogue": { limit: 120, windowMs: 60_000 },
  "read.calculatePrice": { limit: 120, windowMs: 60_000 },
  "read.studioJobs": { limit: 120, windowMs: 60_000 },
  "read.myMemberships": { limit: 120, windowMs: 60_000 },
  "read.membershipPlans": { limit: 120, windowMs: 60_000 },
  "read.membershipUsage": { limit: 120, windowMs: 60_000 },
  "notification.markRead": { limit: 120, windowMs: 60_000 },
};

interface RateLimitSubject {
  uid: string;
  tenantId: string | null;
  role: UserRole | null;
}

/** Builds a rate-limit subject from an already-authorized user (the common case). */
export function subjectFrom(user: AuthorizedUser): RateLimitSubject {
  return { uid: user.uid, tenantId: user.claims.tenantId, role: user.claims.role };
}

function friendlyMessage(role: UserRole | null): string {
  if (role === "studio") return "Too many attempts. Please wait before trying again.";
  if (role === "admin" || role === "superadmin") return "Too many requests. Please try again shortly.";
  return "Too many attempts. Please wait and try again.";
}

/**
 * Atomically checks and increments a per-uid+action fixed-window counter.
 * Throws HttpsError("resource-exhausted", ...) when the limit is exceeded —
 * fails closed (any Firestore error propagates as a thrown error, denying
 * the request rather than silently allowing it through).
 *
 * Deliberately its own short transaction, run BEFORE any business-logic
 * transaction, rather than nested inside one: the callable's business
 * transaction may retry for reasons unrelated to this caller (e.g. bay
 * contention from a different user), and nesting would risk re-incrementing
 * the counter once per internal retry instead of once per actual request.
 */
export async function enforceRateLimit(subject: RateLimitSubject, action: RateLimitAction): Promise<void> {
  const { limit, windowMs } = RATE_LIMITS[action];
  const db = getFirestore();
  const key = `${subject.tenantId ?? "_"}__${subject.uid}__${action}`;
  const ref = db.collection(COLLECTIONS.rateLimits()).doc(key);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const state = snap.exists ? (snap.data() as { windowStart: number; count: number }) : null;

    if (!state || now - state.windowStart >= windowMs) {
      tx.set(ref, { windowStart: now, count: 1 });
      return;
    }

    if (state.count >= limit) {
      throw new HttpsError("resource-exhausted", friendlyMessage(subject.role));
    }

    tx.update(ref, { count: state.count + 1 });
  });
}
