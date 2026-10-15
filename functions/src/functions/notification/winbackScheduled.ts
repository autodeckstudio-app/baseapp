// Weekly, Monday 11:00 IST. onSchedule has no public endpoint. See lib/winback.ts.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { sendWinbackNudges } from "../../lib/winback.js";

export const winbackScheduled = onSchedule(
  { schedule: "0 11 * * 1", timeZone: "Asia/Kolkata", region: "asia-south1" },
  async () => {
    await sendWinbackNudges(getFirestore());
  },
);
