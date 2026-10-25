import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8181";
const db = getFirestore(initializeApp({ projectId: "demo-autodeck" }));
const now = new Date().toISOString();
await db.collection("payments").doc("p4").set({
  id: "p4", tenantId: "automodz", studioId: "s1", targetType: "job", jobId: "job-p4", bookingId: "bk-p4",
  membershipId: null, customerId: "c1", amount: 200000, currency: "INR",
  method: "razorpay_payment_link", status: "completed", razorpayPaymentLinkId: "pl4",
  razorpayPaymentId: "rzp_p4", razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
  manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
  completedAt: now, failedAt: null, cancelledAt: null, refundedAt: null, createdAt: now, updatedAt: now,
});
await db.collection("jobs").doc("job-p4").set({ id: "job-p4", tenantId: "automodz", bookingId: "bk-p4", paymentStatus: "paid" });
await db.collection("bookings").doc("bk-p4").set({ id: "bk-p4", tenantId: "automodz", paymentStatus: "paid" });
await db.collection("refundRequests").doc("rr_p4_1").set({
  tenantId: "automodz", studioId: "s1", paymentId: "p4", jobId: "job-p4", bookingId: "bk-p4",
  amountPaise: 200000, reason: "customer cancellation", status: "reserved", providerRefundId: null,
  projectionNeeded: false, leaseBy: null, leaseAt: null, lastError: null, createdBy: "pixel",
  createdAt: now, updatedAt: now,
});
console.log("seeded reserved request rr_p4_1 (Rs2,000)");
process.exit(0);
