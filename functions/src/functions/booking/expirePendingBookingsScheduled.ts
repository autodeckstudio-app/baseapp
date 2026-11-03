// Every 5 minutes: release online-payment bookings whose 15-minute hold ended unpaid.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { sweepExpiredBookingHolds } from "../../lib/booking-hold.js";

export const expirePendingBookingsScheduled = onSchedule(
  { schedule: "*/5 * * * *", timeZone: "Asia/Kolkata", region: "asia-south1", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] },
  async () => {
    await sweepExpiredBookingHolds(getFirestore());
  },
);
