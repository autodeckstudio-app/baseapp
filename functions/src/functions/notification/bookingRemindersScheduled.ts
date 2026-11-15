// Every 15 minutes. onSchedule has no public endpoint. See lib/booking-reminders.ts. Dark: not deployed until the owner says go.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { sendBookingReminders } from "../../lib/booking-reminders.js";

export const bookingRemindersScheduled = onSchedule(
  { schedule: "*/15 * * * *", timeZone: "Asia/Kolkata", region: "asia-south1" },
  async () => {
    await sendBookingReminders(getFirestore());
  },
);
