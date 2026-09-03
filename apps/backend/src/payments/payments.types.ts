/**
 * The `payments/{id}` Firestore document shape. Scoped ONLY to a Booking's
 * advance payment in this phase — Package purchase payment collection is
 * NOT wired here (see payments.service.ts's class doc for why).
 *
 * `paymentId` is always the OWNING BOOKING'S id (a deterministic 1:1
 * document, not a random UUID) — this is what makes order-creation
 * idempotent: `Firestore.DocumentReference#create()` fails if a payment
 * already exists for a booking, so at most one Razorpay order is ever
 * created per booking, even under concurrent requests.
 *
 * `razorpayPaymentId` is only ever set by the verified `payment.captured`/
 * `payment.failed` webhook handler — never by any client-facing endpoint,
 * and never trusted if a client tried to supply one.
 */
export interface PaymentRecord {
  paymentId: string; // = bookingId
  bookingId: string;
  customerId: string; // denormalized from the booking, required by the existing payments/{id} Firestore rule's ownership read-check
  amount: number; // integer, paise — the booking's own frozen priceSnapshot.advanceAmount, never recomputed here
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  status: 'created' | 'captured' | 'failed' | 'refunded';
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  createdByStaffId: string;
  capturedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  failedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  refundedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
}

/**
 * The `refunds/{id}` Firestore document shape.
 *
 * `refundId` is likewise always the owning BOOKING'S id (deterministic,
 * `.create()`-guarded) — the same idempotency mechanism as `PaymentRecord`,
 * preventing a booking from ever being refunded twice even under
 * concurrent "process refund" requests or webhook redelivery.
 *
 * `amount` is always `BookingRecord.refundAmount`, read directly from the
 * existing Phase 2E `calculateCancellationRefund` decision already stored
 * on the booking at cancellation time — never a client-supplied value, and
 * never recomputed by a new policy here.
 */
export interface RefundRecord {
  refundId: string; // = bookingId
  bookingId: string;
  paymentId: string;
  amount: number; // integer, paise — copied verbatim from BookingRecord.refundAmount
  razorpayRefundId?: string;
  status: 'processing' | 'processed' | 'failed';
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  createdByStaffId: string;
  processedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  failedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  failureReason?: string;
}
