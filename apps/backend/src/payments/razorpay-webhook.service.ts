import { BadRequestException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { FIREBASE_ADMIN_APP } from '../auth/firebase-admin.provider';
import { AuditLogService } from '../audit/audit-log.service';
import type { EnvConfig } from '../config/configuration';
import { verifyRazorpayWebhookSignature } from './razorpay-signature.util';
import type { PaymentRecord, RefundRecord } from './payments.types';

/**
 * Deliberately loose: only the fields each handler actually reads are
 * required. Razorpay's real payloads carry many more fields; validating a
 * fixed exhaustive shape would make this brittle against Razorpay's own
 * additions, which is not this system's concern to police.
 */
const WebhookPayloadSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({ entity: z.object({ id: z.string(), order_id: z.string().optional() }) }).optional(),
    refund: z.object({ entity: z.object({ id: z.string(), payment_id: z.string() }) }).optional(),
  }),
});

type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

/**
 * Razorpay webhook reception: signature verification, payload validation,
 * and idempotent, transactional state reconciliation.
 *
 * Exactly THREE event types are handled — `payment.captured`,
 * `payment.failed`, `refund.processed` — each corresponding directly to a
 * state transition `PaymentRecord`/`RefundRecord` actually needs. Every
 * other Razorpay event (order.paid, payment.authorized,
 * payment.dispute.created, refund.failed, ...) is explicitly NOT handled:
 * `processWebhook` returns a plain 200 acknowledgment for anything else,
 * so Razorpay does not endlessly retry an event this system has no use
 * for — it is deliberately not "arbitrary event support," just a safe,
 * documented no-op.
 *
 * Idempotency: both handlers read the current record status inside a
 * Firestore transaction and no-op if it is already at (or past) the target
 * state — Razorpay explicitly documents that webhooks may be redelivered,
 * and this makes redelivery produce zero additional financial or audit
 * effect, not merely "no error."
 *
 * There is no Firebase-authenticated actor here at all — the caller is
 * Razorpay's server, not a studio user — so audit entries use the sentinel
 * `actorId: 'razorpay-webhook'`, `actorRole: 'system'` rather than any
 * `AuthenticatedUser`.
 */
@Injectable()
export class RazorpayWebhookService {
  private readonly logger = new Logger(RazorpayWebhookService.name);

  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async processWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<{ status: string }> {
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Missing request body');
    }

    const webhookSecret = this.configService.get('RAZORPAY_WEBHOOK_SECRET', { infer: true });
    if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
      // Deliberately generic: never reveal *why* verification failed (bad
      // signature vs. missing header vs. secret mismatch) — same fail-closed,
      // non-distinguishing posture as FirebaseAuthGuard's rejected tokens.
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Malformed webhook payload: invalid JSON');
    }

    const result = WebhookPayloadSchema.safeParse(parsedJson);
    if (!result.success) {
      throw new BadRequestException('Malformed webhook payload: unexpected shape');
    }
    const payload = result.data;

    switch (payload.event) {
      case 'payment.captured':
        return this.handlePaymentCaptured(payload);
      case 'payment.failed':
        return this.handlePaymentFailed(payload);
      case 'refund.processed':
        return this.handleRefundProcessed(payload);
      default:
        this.logger.log(`Ignoring unsupported Razorpay webhook event: "${payload.event}"`);
        return { status: 'ignored' };
    }
  }

  private async handlePaymentCaptured(payload: WebhookPayload): Promise<{ status: string }> {
    const entity = payload.payload.payment?.entity;
    if (!entity?.order_id) {
      throw new BadRequestException('Malformed payment.captured payload: missing payment/order id');
    }

    const firestore = this.app.firestore();
    const requestId = randomUUID();

    return firestore.runTransaction(async (transaction) => {
      const querySnapshot = await transaction.get(
        firestore.collection('payments').where('razorpayOrderId', '==', entity.order_id).limit(1),
      );
      if (querySnapshot.empty) {
        this.logger.warn(`payment.captured received for unrecognized order "${entity.order_id}"`);
        return { status: 'ignored' };
      }

      const paymentDoc = querySnapshot.docs[0]!;
      const payment = paymentDoc.data() as PaymentRecord;
      if (payment.status === 'captured') {
        return { status: 'duplicate' };
      }

      transaction.update(paymentDoc.ref, {
        status: 'captured',
        razorpayPaymentId: entity.id,
        capturedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      this.auditLogService.recordInTransaction(transaction, {
        actorId: 'razorpay-webhook',
        actorRole: 'system',
        action: 'payment.captured',
        entityType: 'payment',
        entityId: payment.paymentId,
        before: { status: payment.status },
        after: { status: 'captured', razorpayPaymentId: entity.id },
        requestId,
      });
      return { status: 'processed' };
    });
  }

  private async handlePaymentFailed(payload: WebhookPayload): Promise<{ status: string }> {
    const entity = payload.payload.payment?.entity;
    if (!entity?.order_id) {
      throw new BadRequestException('Malformed payment.failed payload: missing payment/order id');
    }

    const firestore = this.app.firestore();
    const requestId = randomUUID();

    return firestore.runTransaction(async (transaction) => {
      const querySnapshot = await transaction.get(
        firestore.collection('payments').where('razorpayOrderId', '==', entity.order_id).limit(1),
      );
      if (querySnapshot.empty) {
        this.logger.warn(`payment.failed received for unrecognized order "${entity.order_id}"`);
        return { status: 'ignored' };
      }

      const paymentDoc = querySnapshot.docs[0]!;
      const payment = paymentDoc.data() as PaymentRecord;
      if (payment.status === 'failed' || payment.status === 'captured') {
        return { status: 'duplicate' }; // already reconciled either way — never overwrite a captured payment
      }

      transaction.update(paymentDoc.ref, {
        status: 'failed',
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      this.auditLogService.recordInTransaction(transaction, {
        actorId: 'razorpay-webhook',
        actorRole: 'system',
        action: 'payment.failed',
        entityType: 'payment',
        entityId: payment.paymentId,
        before: { status: payment.status },
        after: { status: 'failed' },
        requestId,
      });
      return { status: 'processed' };
    });
  }

  private async handleRefundProcessed(payload: WebhookPayload): Promise<{ status: string }> {
    const entity = payload.payload.refund?.entity;
    if (!entity) {
      throw new BadRequestException('Malformed refund.processed payload: missing refund id');
    }

    const firestore = this.app.firestore();
    const requestId = randomUUID();

    return firestore.runTransaction(async (transaction) => {
      const querySnapshot = await transaction.get(
        firestore.collection('refunds').where('razorpayRefundId', '==', entity.id).limit(1),
      );
      if (querySnapshot.empty) {
        // Known limitation (documented in the Phase 2J report): if this
        // webhook is delivered before PaymentsService.processRefund's own
        // synchronous write of `razorpayRefundId` completes, there is
        // nothing to match yet. Safe to ignore — Razorpay's dashboard
        // remains authoritative, and this is not a financial-effect gap
        // (the refund itself already happened at Razorpay regardless).
        this.logger.warn(`refund.processed received for unrecognized refund "${entity.id}"`);
        return { status: 'ignored' };
      }

      const refundDoc = querySnapshot.docs[0]!;
      const refund = refundDoc.data() as RefundRecord;
      if (refund.status === 'processed') {
        return { status: 'duplicate' };
      }

      transaction.update(refundDoc.ref, {
        status: 'processed',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      this.auditLogService.recordInTransaction(transaction, {
        actorId: 'razorpay-webhook',
        actorRole: 'system',
        action: 'refund.processed',
        entityType: 'refund',
        entityId: refund.refundId,
        before: { status: refund.status },
        after: { status: 'processed' },
        requestId,
      });
      return { status: 'processed' };
    });
  }
}
