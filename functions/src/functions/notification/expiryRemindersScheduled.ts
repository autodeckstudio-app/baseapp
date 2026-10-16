// Daily 09:00 IST. onSchedule has no public endpoint. See lib/expiry-reminders.ts.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { sendExpiryReminders } from "../../lib/expiry-reminders.js";
import { sendMembershipReminders } from "../../lib/membership-reminders.js";

export const expiryRemindersScheduled = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Asia/Kolkata", region: "asia-south1" },
  async () => {
    await sendExpiryReminders(getFirestore());
    await sendMembershipReminders(getFirestore());
  },
);
