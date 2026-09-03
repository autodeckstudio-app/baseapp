import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import { isValidBookingTransition, type BookingStatus } from '@autodeck/domain';
import { FIREBASE_ADMIN_APP } from '../auth/firebase-admin.provider';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { AuditLogService } from '../audit/audit-log.service';
import { BookingsService } from '../bookings/bookings.service';
import type { VisitRecord } from './visits.types';

/**
 * Visit check-in, completion, and sealing.
 *
 * This service exposes exactly three of its OWN mutations, matching exactly
 * three Booking transitions (`booked -> in_progress`, `in_progress ->
 * completed`, `completed -> sealed`) — no others. In particular, neither
 * `checkIn`/`complete`/`seal` ever drives a visit into or out of
 * `approval_required` — mid-visit approval requests are Phase 2G's concern
 * (ApprovalsModule). The one exception is `updateStatusInBatch` below,
 * a generic, validation-free hook (added in Phase 2G, mirroring
 * BookingsService's identical method) that ApprovalsService uses to keep a
 * Visit's `status` mirroring its Booking's `status` when moving into and
 * back out of `approval_required` — this file still contains no
 * `approval_required`-specific logic of its own.
 *
 * `isValidBookingTransition` (the existing domain state machine) is the
 * SOLE authority on every transition here — never reimplemented. Each
 * method reads the underlying Booking's current `status` via
 * `BookingsService.getBookingRecord` and checks the transition against
 * that, then — only if legal — commits the Visit's own status change and
 * the Booking's corresponding status change as one atomic Firestore batch
 * via `BookingsService.updateStatusInBatch`. Sealed-immutability falls out
 * of this for free: `ALLOWED_BOOKING_TRANSITIONS.sealed` is empty, so any
 * further `complete`/`seal` call against an already-sealed booking is
 * rejected by the exact same check, with no separate hand-written
 * "is it sealed" branch anywhere in this file.
 *
 * A booking that gets cancelled (`cancelBooking`, Phase 2E) while a visit
 * is `in_progress` is a known, unhandled edge case: BookingsService has no
 * awareness of Visits and does not check for one before allowing
 * cancellation. Reconciling that cross-module edge case is not required by
 * anything in the approved product-decision record and would mean changing
 * Phase 2E's already-complete, already-tested cancellation behavior, so it
 * is deliberately left alone here rather than guessed at.
 */
@Injectable()
export class VisitsService {
  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App,
    private readonly auditLogService: AuditLogService,
    private readonly bookingsService: BookingsService,
  ) {}

  /** Exposed for ApprovalsService, which must read a visit's current state
   * (and denormalized bookingId/customerId) before requesting or resolving
   * an approval against it — never to let a caller read arbitrary visit
   * data through a side channel. Mirrors BookingsService.getBookingRecord's
   * existing role. Was private through Phase 2F, where nothing outside
   * this service needed it. */
  async getVisitRecord(visitId: string): Promise<VisitRecord | null> {
    const snapshot = await this.app.firestore().collection('visits').doc(visitId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as VisitRecord;
  }

  /**
   * Adds a visit status update to an already-open Firestore `WriteBatch` —
   * mirrors `BookingsService.updateStatusInBatch`'s identical shape. Lets
   * ApprovalsService keep a Visit's `status` mirroring its Booking's
   * `status` (both moving to `approval_required` together, and both moving
   * back to `in_progress` together) as one atomic write, without
   * ApprovalsService ever touching the `visits` collection itself. The
   * caller is responsible for having already validated the transition via
   * `isValidBookingTransition`.
   */
  updateStatusInBatch(batch: FirebaseFirestore.WriteBatch, visitId: string, status: BookingStatus): void {
    batch.update(this.app.firestore().collection('visits').doc(visitId), { status });
  }

  /**
   * Starts a visit for an existing booking — i.e. checks the vehicle in and
   * begins work. `bookingId` is the validated `:bookingId` route parameter
   * (see VisitsController), never client body input (there is no body at
   * all). `customerId`/`vehicleId` are denormalized from the booking's own
   * authoritative record, never supplied by the caller.
   */
  async checkIn(actor: AuthenticatedUser, bookingId: string): Promise<VisitRecord> {
    const booking = await this.bookingsService.getBookingRecord(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking record not found');
    }
    if (!isValidBookingTransition(booking.status, 'in_progress')) {
      throw new ConflictException(`Cannot start a visit for a booking in status "${booking.status}"`);
    }

    const firestore = this.app.firestore();
    const docRef = firestore.collection('visits').doc();
    const requestId = randomUUID();

    const record: VisitRecord = {
      visitId: docRef.id,
      bookingId,
      customerId: booking.customerId,
      vehicleId: booking.vehicleId,
      status: 'in_progress',
      checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
      checkedInByStaffId: actor.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByStaffId: actor.uid,
    };

    const batch = firestore.batch();
    batch.set(docRef, record);
    this.bookingsService.updateStatusInBatch(batch, bookingId, 'in_progress');
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'visit.check_in',
      entityType: 'visit',
      entityId: docRef.id,
      after: { bookingId, status: 'in_progress' },
      requestId,
    });
    await batch.commit();

    return record;
  }

  /** Marks the work for a visit done. Legal only while the underlying
   * booking is `in_progress`. */
  async complete(actor: AuthenticatedUser, visitId: string): Promise<void> {
    const visit = await this.getVisitRecord(visitId);
    if (!visit) {
      throw new NotFoundException('Visit record not found');
    }

    const booking = await this.bookingsService.getBookingRecord(visit.bookingId);
    if (!booking) {
      throw new NotFoundException('Booking record not found');
    }
    if (!isValidBookingTransition(booking.status, 'completed')) {
      throw new ConflictException(`Cannot complete a visit for a booking in status "${booking.status}"`);
    }

    const requestId = randomUUID();
    const firestore = this.app.firestore();
    const batch = firestore.batch();
    batch.update(firestore.collection('visits').doc(visitId), {
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedByStaffId: actor.uid,
    });
    this.bookingsService.updateStatusInBatch(batch, visit.bookingId, 'completed');
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'visit.complete',
      entityType: 'visit',
      entityId: visitId,
      before: { status: visit.status },
      after: { status: 'completed' },
      requestId,
    });
    await batch.commit();
  }

  /** Seals a completed visit, making it permanently immutable. Legal only
   * while the underlying booking is `completed`; rejecting an
   * already-sealed visit falls out of the same check (see class doc). */
  async seal(actor: AuthenticatedUser, visitId: string): Promise<void> {
    const visit = await this.getVisitRecord(visitId);
    if (!visit) {
      throw new NotFoundException('Visit record not found');
    }

    const booking = await this.bookingsService.getBookingRecord(visit.bookingId);
    if (!booking) {
      throw new NotFoundException('Booking record not found');
    }
    if (!isValidBookingTransition(booking.status, 'sealed')) {
      throw new ConflictException(`Cannot seal a visit for a booking in status "${booking.status}"`);
    }

    const requestId = randomUUID();
    const firestore = this.app.firestore();
    const batch = firestore.batch();
    batch.update(firestore.collection('visits').doc(visitId), {
      status: 'sealed',
      sealedAt: admin.firestore.FieldValue.serverTimestamp(),
      sealedByStaffId: actor.uid,
    });
    this.bookingsService.updateStatusInBatch(batch, visit.bookingId, 'sealed');
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'visit.seal',
      entityType: 'visit',
      entityId: visitId,
      before: { status: visit.status },
      after: { status: 'sealed' },
      requestId,
    });
    await batch.commit();
  }
}
