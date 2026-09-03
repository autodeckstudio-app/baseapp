import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import { isValidBookingTransition } from '@autodeck/domain';
import { FIREBASE_ADMIN_APP } from '../auth/firebase-admin.provider';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { AuditLogService } from '../audit/audit-log.service';
import { BookingsService } from '../bookings/bookings.service';
import { VisitsService } from '../visits/visits.service';
import type { ApprovalRecord } from './approvals.types';
import type { RequestApprovalDto } from './dto/request-approval.dto';
import type { ResolveApprovalDto } from './dto/resolve-approval.dto';

/**
 * Mid-visit approval requests: staff proposes extra work/cost during an
 * in-progress visit, pausing it (`in_progress -> approval_required`), and
 * later records the customer's decision, resuming it
 * (`approval_required -> in_progress`).
 *
 * Two flagged assumptions, made explicit rather than silently baked in
 * (see the Phase 2G implementation summary for the full reasoning):
 *
 * 1. WHO resolves an approval: the product-decision record describes
 *    "mid-visit approvals" as a customer-facing app feature, but nothing in
 *    this backend (through Phase 2F) gives a customer token any role claim
 *    or write path at all — `FirebaseAuthGuard` rejects any token without
 *    one. Building a genuine customer-authenticated decision endpoint would
 *    mean inventing a new authorization scheme with no precedent anywhere
 *    in this codebase, well beyond Phase 2G's scope. This module instead
 *    has STAFF record the customer's real-world decision (`@Roles('staff')`
 *    on both routes) — the same trust model as every other mutation here.
 *
 * 2. WHETHER resolving resumes the workflow: `resolve()` always drives the
 *    booking/visit back to `in_progress`, regardless of `approved` vs
 *    declined. This is not an invented default — it is the ONLY transition
 *    `ALLOWED_BOOKING_TRANSITIONS.approval_required` has ever contained
 *    (packages/domain/src/stateMachine.ts, unmodified since Phase 1,
 *    written before Approvals existed). A declined approval does not
 *    auto-cancel the booking; if that's the real outcome, staff separately
 *    calls the existing `PATCH /bookings/:id/cancel` (Phase 2E) — this
 *    module never calls that itself.
 *
 * `isValidBookingTransition` is, as with Bookings/Visits, the SOLE
 * authority on both transitions here — never reimplemented. Replay
 * protection (resolving an already-resolved approval) and sealed-visit
 * immutability both fall out of the exact same mechanism already
 * established in Phase 2F: once a booking/visit has moved on (to
 * `in_progress`, `completed`, `sealed`, or `cancelled`), `resolve()`'s
 * `isValidBookingTransition(booking.status, 'in_progress')` check rejects
 * it, with no separate hand-written "already resolved" or "is it sealed"
 * branch anywhere in this file.
 */
@Injectable()
export class ApprovalsService {
  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App,
    private readonly auditLogService: AuditLogService,
    private readonly bookingsService: BookingsService,
    private readonly visitsService: VisitsService,
  ) {}

  private async getApprovalRecord(approvalId: string): Promise<ApprovalRecord | null> {
    const snapshot = await this.app.firestore().collection('approvals').doc(approvalId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as ApprovalRecord;
  }

  /**
   * `visitId` is the validated `:visitId` route parameter (see
   * ApprovalsController), never client body input. `bookingId`/`customerId`
   * are denormalized from the visit's own authoritative record, never
   * supplied by the caller.
   */
  async requestApproval(actor: AuthenticatedUser, visitId: string, input: RequestApprovalDto): Promise<ApprovalRecord> {
    const visit = await this.visitsService.getVisitRecord(visitId);
    if (!visit) {
      throw new NotFoundException('Visit record not found');
    }

    const booking = await this.bookingsService.getBookingRecord(visit.bookingId);
    if (!booking) {
      throw new NotFoundException('Booking record not found');
    }
    if (!isValidBookingTransition(booking.status, 'approval_required')) {
      throw new ConflictException(`Cannot request approval for a booking in status "${booking.status}"`);
    }

    const firestore = this.app.firestore();
    const docRef = firestore.collection('approvals').doc();
    const requestId = randomUUID();

    const record: ApprovalRecord = {
      approvalId: docRef.id,
      bookingId: visit.bookingId,
      visitId,
      customerId: visit.customerId,
      description: input.description,
      additionalAmount: input.additionalAmount,
      decision: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByStaffId: actor.uid,
    };

    const batch = firestore.batch();
    batch.set(docRef, record);
    this.bookingsService.updateStatusInBatch(batch, visit.bookingId, 'approval_required');
    this.visitsService.updateStatusInBatch(batch, visitId, 'approval_required');
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'approval.request',
      entityType: 'approval',
      entityId: docRef.id,
      after: {
        bookingId: visit.bookingId,
        visitId,
        description: input.description,
        additionalAmount: input.additionalAmount,
      },
      requestId,
    });
    await batch.commit();

    return record;
  }

  /**
   * Records the customer's decision and resumes the visit/booking. Legal
   * only while the approval is still `pending` AND the underlying booking
   * is still `approval_required` — both checked, the latter via the
   * existing state machine (see class doc for why both checks matter and
   * why they are not redundant with each other: `decision` and
   * `BookingStatus` are two different pieces of state that are normally
   * kept in lock-step by this very method, but are checked independently
   * rather than assuming one implies the other).
   */
  async resolveApproval(actor: AuthenticatedUser, approvalId: string, input: ResolveApprovalDto): Promise<void> {
    const approval = await this.getApprovalRecord(approvalId);
    if (!approval) {
      throw new NotFoundException('Approval record not found');
    }
    if (approval.decision !== 'pending') {
      throw new ConflictException(`Cannot resolve an approval already marked "${approval.decision}"`);
    }

    const booking = await this.bookingsService.getBookingRecord(approval.bookingId);
    if (!booking) {
      throw new NotFoundException('Booking record not found');
    }
    if (!isValidBookingTransition(booking.status, 'in_progress')) {
      throw new ConflictException(`Cannot resolve an approval for a booking in status "${booking.status}"`);
    }

    const decision = input.approved ? 'approved' : 'declined';
    const requestId = randomUUID();
    const firestore = this.app.firestore();
    const batch = firestore.batch();
    batch.update(firestore.collection('approvals').doc(approvalId), {
      decision,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedByStaffId: actor.uid,
    });
    this.bookingsService.updateStatusInBatch(batch, approval.bookingId, 'in_progress');
    this.visitsService.updateStatusInBatch(batch, approval.visitId, 'in_progress');
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'approval.resolve',
      entityType: 'approval',
      entityId: approvalId,
      before: { decision: approval.decision },
      after: { decision },
      requestId,
    });
    await batch.commit();
  }
}
