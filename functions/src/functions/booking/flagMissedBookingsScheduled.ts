// Hourly: flags bookings whose slot passed without the car arriving, once each.
// onSchedule has no public endpoint. See lib/missed-bookings.ts.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { flagMissedBookings } from "../../lib/missed-bookings.js";

export const flagMissedBookingsScheduled = onSchedule(
  { schedule: "30 * * * *", timeZone: "Asia/Kolkata", region: "asia-south1" },
  async () => {
    await flagMissedBookings(getFirestore());
  },
);
