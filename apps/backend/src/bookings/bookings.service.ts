import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import {
  calculateCancellationRefund,
  computePriceSnapshot,
  isValidBookingTransition,
  type BookingStatus,
} from '@autodeck/domain';
import { FIREBASE_ADMIN_APP } from '../auth/firebase-admin.provider';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { AuditLogService } from '../audit/audit-log.service';
import { CustomersService } from '../customers/customers.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { ServicesService } from '../services/services.service';
import type { BookingRecord } from './bookings.types';
import type { CreateBookingDto } from './dto/create-booking.dto';
import type { CancelBookingDto } from './dto/cancel-booking.dto';

/**
 * Booking creation and cancellation. This is the first module that actually
 * calls the pricing/refund/state-machine domain functions — everything here
 * exists specifically so nothing ever has to duplicate that logic:
 * `computePriceSnapshot`, `calculateCancellationRefund`, and
 * `isValidBookingTransition` are imported from `@autodeck/domain` and used
 * exactly as they are, never re-implemented.
 *
 * Price integrity: the ONLY price inputs this service ever reads are
 * `basePrice` values fetched fresh from authoritative `services/{id}`
 * documents via `ServicesService.getServiceRecord`. `CreateBookingDto` has
 * no price-shaped field at all (see create-booking.dto.ts) — there is
 * nothing for a client to override even if it tried.
 *
 * Ownership integrity: `customerId` is always the validated route
 * parameter this method receives, never anything read from the vehicle or
 * the request body. A vehicle is only accepted if its own, authoritative
 * `ownerCustomerId` (fetched via `VehiclesService.getVehicleRecord`) equals
 * that `customerId` — so a vehicle belonging to Customer A can never be
 * booked under Customer B, regardless of what a client claims.
 *
 * Refund boundary (Phase 2E vs 2J, per the approved plan): cancelling a
 * booking here calculates and durably records the refund DECISION
 * (`refundAmount`, `refundReason`) on the booking itself. It never calls
 * Razorpay and never touches the `refunds` Firestore collection — actually
 * paying that money back is Phase 2J's job, once payment integration
 * exists to execute it against. There is no partial/pending refund
 * lifecycle invented here beyond that single stored decision.
 */
@Injectable()
export class BookingsService {
  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App,
    private readonly auditLogService: AuditLogService,
    private readonly customersService: CustomersService,
    private readonly vehiclesService: VehiclesService,
    private readonly servicesService: ServicesService,
  ) {}

  /** Exposed for VisitsService, which must read a booking's current status
   * before validating and driving its own transitions (check-in/complete/
   * seal) — never to let a caller read arbitrary booking data through a
   * side channel. Mirrors CustomersService.getCustomerRecord's existing
   * role. Was private through Phase 2E, where nothing outside this service
   * needed it. */
  async getBookingRecord(bookingId: string): Promise<BookingRecord | null> {
    const snapshot = await this.app.firestore().collection('bookings').doc(bookingId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as BookingRecord;
  }

  /**
   * Adds a booking status update to an already-open Firestore `WriteBatch`
   * — mirrors `AuditLogService.recordInBatch`'s existing shape. This is
   * what lets VisitsService commit a visit's own status change and its
   * booking's corresponding status change as one atomic write, while
   * `bookings` stays the only collection BookingsService itself ever
   * writes to directly (VisitsService never touches `bookings` itself).
   * The caller is responsible for having already validated the transition
   * via `isValidBookingTransition` — this method does not re-check it, the
   * same division of responsibility `recordInBatch` already has for audit
   * entries.
   */
  updateStatusInBatch(batch: FirebaseFirestore.WriteBatch, bookingId: string, status: BookingStatus): void {
    batch.update(this.app.firestore().collection('bookings').doc(bookingId), { status });
  }

  /**
   * `customerId` is the validated `:customerId` route parameter (see
   * BookingsController) — never read from `input`, which has no such
   * field. Every referenced entity (customer, vehicle, each service) is
   * re-read from Firestore here and confirmed to exist before anything is
   * written; none of it is trusted from the client beyond the IDs used to
   * look each one up.
   */
  async createBooking(actor: AuthenticatedUser, customerId: string, input: CreateBookingDto): Promise<BookingRecord> {
    const customer = await this.customersService.getCustomerRecord(customerId);
    if (!customer) {
      throw new NotFoundException('Customer record not found');
    }

    const vehicle = await this.vehiclesService.getVehicleRecord(input.vehicleId);
    if (!vehicle) {
      throw new NotFoundException('Vehicle record not found');
    }
    if (vehicle.ownerCustomerId !== customerId) {
      // A vehicle belonging to a different customer must never be
      // bookable here, regardless of what the client claims — ownership is
      // always read from the vehicle's own authoritative record, never
      // from anything the client submits.
      throw new BadRequestException('Vehicle does not belong to the specified customer');
    }

    const services = await Promise.all(
      input.serviceIds.map((serviceId) => this.servicesService.getServiceRecord(serviceId)),
    );
    const missingIndex = services.findIndex((service) => service === null);
    if (missingIndex !== -1) {
      throw new NotFoundException(`Service record not found: ${input.serviceIds[missingIndex]}`);
    }
    // `services` is now known to contain no nulls (validated above); the
    // non-null assertion below reflects that, not an unchecked assumption.
    const priceSnapshot = computePriceSnapshot(
      services.map((service) => ({ serviceId: service!.serviceId, basePrice: service!.basePrice })),
    );

    const firestore = this.app.firestore();
    const docRef = firestore.collection('bookings').doc();
    const requestId = randomUUID();

    const record: BookingRecord = {
      bookingId: docRef.id,
      customerId,
      vehicleId: input.vehicleId,
      serviceIds: input.serviceIds,
      priceSnapshot,
      status: 'booked',
      // CreateBookingSchema declares `z.coerce.date()`, but the
      // pre-existing global ZodValidationPipe defect (see
      // customers.e2e-spec.ts / services.e2e-spec.ts) means
      // that coercion never actually runs on a real HTTP request, so
      // `input.scheduledAt` can arrive here as the raw JSON string rather
      // than an already-coerced Date. Re-wrapping in `new Date(...)` is
      // idempotent for an actual Date (as every unit test passes directly)
      // and correctly parses the string Express/JSON.parse otherwise leaves
      // it as. This is a defensive fix inside Phase 2E's own new code, not
      // a change to the shared pipe itself.
      scheduledAt: admin.firestore.Timestamp.fromDate(new Date(input.scheduledAt)),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByStaffId: actor.uid,
    };

    const batch = firestore.batch();
    batch.set(docRef, record);
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'booking.create',
      entityType: 'booking',
      entityId: docRef.id,
      after: {
        customerId,
        vehicleId: input.vehicleId,
        serviceIds: input.serviceIds,
        total: priceSnapshot.total,
        advanceAmount: priceSnapshot.advanceAmount,
      },
      requestId,
    });
    await batch.commit();

    return record;
  }

  /**
   * The only state transition Phase 2E implements. `isValidBookingTransition`
   * (the existing domain state machine) is the sole authority on whether
   * `status -> 'cancelled'` is legal from the booking's current status — it
   * is never reimplemented or second-guessed here. Transitions into
   * `in_progress`/`approval_required`/`completed`/`sealed` are Visits'/
   * Approvals' concern (Phase 2F/2G) and are not exposed by any endpoint in
   * this module.
   */
  async cancelBooking(actor: AuthenticatedUser, bookingId: string, input: CancelBookingDto): Promise<void> {
    const existing = await this.getBookingRecord(bookingId);
    if (!existing) {
      throw new NotFoundException('Booking record not found');
    }

    if (!isValidBookingTransition(existing.status, 'cancelled')) {
      throw new ConflictException(`Cannot cancel a booking in status "${existing.status}"`);
    }

    const refundDecision = calculateCancellationRefund({
      advanceAmount: existing.priceSnapshot.advanceAmount,
      scheduledAt: existing.scheduledAt.toDate(),
      now: new Date(),
      initiatedBy: input.initiatedBy,
    });

    const requestId = randomUUID();
    const firestore = this.app.firestore();
    const batch = firestore.batch();
    batch.update(firestore.collection('bookings').doc(bookingId), {
      status: 'cancelled',
      refundAmount: refundDecision.refundAmount,
      refundReason: refundDecision.reason,
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancelledByStaffId: actor.uid,
    });
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'booking.cancel',
      entityType: 'booking',
      entityId: bookingId,
      before: { status: existing.status },
      after: {
        status: 'cancelled',
        refundAmount: refundDecision.refundAmount,
        refundReason: refundDecision.reason,
        initiatedBy: input.initiatedBy,
      },
      requestId,
    });
    await batch.commit();
  }
}
