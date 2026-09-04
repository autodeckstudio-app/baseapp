/**
 * Fixture data mirroring the `payments/{id}` Firestore document shape
 * described in `firebase/firestore.rules` and `PaymentsController`
 * (`POST :bookingId/payment-order`, `POST :bookingId/refund`). No revenue
 * aggregation is implied — these are individual records only.
 */
export interface MockPayment {
  paymentId: string;
  bookingId?: string;
  customerPackageId?: string;
  customerId: string;
  amountPaise: number;
  status: 'created' | 'paid' | 'failed' | 'refunded';
  createdAt: string;
}

export const MOCK_PAYMENTS: MockPayment[] = [
  { paymentId: 'pay-1', bookingId: 'bkg-4', customerId: 'cust-3', amountPaise: 120_000, status: 'paid', createdAt: '2026-09-04T15:40:00+05:30' },
  { paymentId: 'pay-2', bookingId: 'bkg-5', customerId: 'cust-1', amountPaise: 50_000, status: 'paid', createdAt: '2026-09-03T12:10:00+05:30' },
  { paymentId: 'pay-3', customerPackageId: 'cp-1', customerId: 'cust-1', amountPaise: 850_000, status: 'paid', createdAt: '2026-08-14T09:15:00+05:30' },
  { paymentId: 'pay-4', bookingId: 'bkg-1', customerId: 'cust-1', amountPaise: 400_000, status: 'created', createdAt: '2026-09-05T09:50:00+05:30' },
];
