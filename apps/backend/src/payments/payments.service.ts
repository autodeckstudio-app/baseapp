import { ConflictException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import type Razorpay from 'razorpay';
import { FIREBASE_ADMIN_APP } from '../auth/firebase-admin.provider';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { AuditLogService } from '../audit/audit-log.service';
import { BookingsService } from '../bookings/bookings.service';
import { RAZORPAY_CLIENT } from './razorpay.provider';
import type { PaymentRecord, RefundRecord } from './payments.types';

/**
 * Booking advance-payment order creation and refund processing — the two
 * staff/manager-facing, Firebase-authenticated halves of Phase 2J. Webhook
 * *reception* (the third half) lives in `razorpay-webhook.service.ts`,
 * which has an entirely different trust model (no Firebase actor at all)
 * and deliberately never shares code with this file beyond the Firestore
 * record shapes.
 *
 * Scope boundary: this only wires Bookings' advance payment. Packages'
 * "100% upfront" payment (§E.2: "Packages and bookings sharing one
 * underlying payment-gateway integration") is NOT implemented here —
 * doing so would mean adding new logic that reads from
 * CustomerPackagesService beyond a minimal compatibility change, which is
 * out of Phase 2J's explicit boundary ("do not reopen Phase 2H"). Flagged
 * as a known limitation, not silently dropped.
 *
 * Idempotency for BOTH mutations here uses the same pattern: the Firestore
 * document ID is deterministically the booking's own ID, and the initial
 * write uses `DocumentReference#create()`, which fails if a document
 * already exists at that path. This means at most one Razorpay API call
 * (order creation, or refund) is ever made per booking, even under
 * concurrent requests — the "claim" (the `.create()` call) always happens
 * BEFORE the external API call, never after, so two racing requests can
 * never both reach Razorpay.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App,
    @Inject(RAZORPAY_CLIENT) private readonly razorpay: Razorpay,
    private readonly auditLogService: AuditLogService,
    private readonly bookingsService: BookingsService,
  ) {}

  async getPaymentRecord(bookingId: string): Promise<PaymentRecord | null> {
    const snapshot = await this.app.firestore().collection('payments').doc(bookingId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as PaymentRecord;
  }

  async getRefundRecord(bookingId: string): Promise<RefundRecord | null> {
    const snapshot = await this.app.firestore().collection('refunds').doc(bookingId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as RefundRecord;
  }

  /**
   * Creates a Razorpay order for a booking's advance payment. The amount is
   * always `booking.priceSnapshot.advanceAmount` — the exact, frozen value
   * `computePriceSnapshot` decided at booking-creation time (Phase 2E);
   * never a client-supplied amount, and never recomputed here.
   */
  async createPaymentOrder(actor: AuthenticatedUser, bookingId: string): Promise<PaymentRecord> {
    const booking = await this.bookingsService.getBookingRecord(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking record not found');
    }
    if (!booking.priceSnapshot.advanceRequired) {
      throw new ConflictException('This booking does not require an advance payment');
    }

    const firestore = this.app.firestore();
    const paymentRef = firestore.collection('payments').doc(bookingId);
    const requestId = randomUUID();

    const claim: Omit<PaymentRecord, 'razorpayOrderId'> = {
      paymentId: bookingId,
      bookingId,
      customerId: booking.customerId,
      amount: booking.priceSnapshot.advanceAmount,
      status: 'created',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByStaffId: actor.uid,
    };

    try {
      // The atomic idempotency guard: fails if a payment already exists
      // for this booking, before any Razorpay call is ever made.
      await paymentRef.create(claim);
    } catch {
      throw new ConflictException('A payment order already exists for this booking');
    }

    let razorpayOrderId: string;
    try {
      const order = await this.razorpay.orders.create({
        amount: booking.priceSnapshot.advanceAmount,
        currency: 'INR',
        receipt: bookingId,
        notes: { bookingId },
      });
      razorpayOrderId = order.id;
    } catch {
      // Release the claim so a legitimate retry can succeed — the failure
      // was Razorpay's/the network's, not a duplicate-request conflict.
      await paymentRef.delete();
      throw new InternalServerErrorException('Failed to create the Razorpay order');
    }

    await paymentRef.update({ razorpayOrderId });
    await this.auditLogService.record({
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'payment.order_create',
      entityType: 'payment',
      entityId: bookingId,
      after: { bookingId, amount: booking.priceSnapshot.advanceAmount, razorpayOrderId },
      requestId,
    });

    return { ...claim, razorpayOrderId };
  }

  /**
   * Processes the refund already decided by Phase 2E's
   * `BookingsService.cancelBooking` (via `calculateCancellationRefund`) —
   * this method never calculates a refund amount itself, only reads
   * `booking.refundAmount` and executes it against Razorpay.
   */
  async processRefund(actor: AuthenticatedUser, bookingId: string): Promise<RefundRecord> {
    const booking = await this.bookingsService.getBookingRecord(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking record not found');
    }
    if (booking.status !== 'cancelled') {
      throw new ConflictException(`Cannot refund a booking in status "${booking.status}"`);
    }
    if (!booking.refundAmount || booking.refundAmount <= 0) {
      throw new ConflictException('No refund is owed for this booking');
    }

    const payment = await this.getPaymentRecord(bookingId);
    if (!payment) {
      throw new NotFoundException('No payment found for this booking');
    }
    if (payment.status !== 'captured') {
      throw new ConflictException(`Cannot refund a payment in status "${payment.status}"`);
    }

    const firestore = this.app.firestore();
    const refundRef = firestore.collection('refunds').doc(bookingId);
    const requestId = randomUUID();

    const claim: Omit<RefundRecord, 'razorpayRefundId'> = {
      refundId: bookingId,
      bookingId,
      paymentId: payment.paymentId,
      amount: booking.refundAmount,
      status: 'processing',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByStaffId: actor.uid,
    };

    try {
      await refundRef.create(claim);
    } catch {
      const existing = await this.getRefundRecord(bookingId);
      if (existing?.status === 'processing') {
        throw new ConflictException('A refund for this booking is already being processed');
      }
      throw new ConflictException('A refund for this booking has already been processed');
    }

    let razorpayRefund: { id: string; status: string };
    try {
      razorpayRefund = await this.razorpay.payments.refund(payment.razorpayPaymentId as string, {
        amount: booking.refundAmount,
      });
    } catch {
      await refundRef.update({
        status: 'failed',
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        failureReason: 'Razorpay refund API call failed',
      });
      await this.auditLogService.record({
        actorId: actor.uid,
        actorRole: actor.role,
        action: 'refund.failed',
        entityType: 'refund',
        entityId: bookingId,
        after: { bookingId, reason: 'razorpay_api_error' },
        requestId,
      });
      throw new InternalServerErrorException('Failed to process the refund with Razorpay');
    }

    const finalStatus: RefundRecord['status'] = razorpayRefund.status === 'processed' ? 'processed' : 'processing';

    const batch = firestore.batch();
    batch.update(refundRef, {
      status: finalStatus,
      razorpayRefundId: razorpayRefund.id,
      ...(finalStatus === 'processed' ? { processedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    });
    batch.update(firestore.collection('payments').doc(payment.paymentId), {
      status: 'refunded',
      refundedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'refund.process',
      entityType: 'refund',
      entityId: bookingId,
      after: { bookingId, amount: booking.refundAmount, razorpayRefundId: razorpayRefund.id, status: finalStatus },
      requestId,
    });
    await batch.commit();

    return { ...claim, razorpayRefundId: razorpayRefund.id, status: finalStatus };
  }
}
