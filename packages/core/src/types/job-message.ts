/** One text message in the chat on a job, between the customer and the studio. Text only. */
export interface JobMessage {
  id: string;
  tenantId: string;
  studioId: string;
  jobId: string;
  customerId: string;
  sender: "customer" | "studio";
  /** Studio first name shown to the customer. Null for customer messages. */
  senderName: string | null;
  text: string;
  createdAt: string; // ISO
}

export const JOB_MESSAGE_MAX = 500;
/** The chat stays open this long after delivery, then closes. */
export const JOB_CHAT_DAYS_AFTER_DELIVERY = 7;

/** Chat is open on a live or recently delivered job. Cancelled and not-yet-arrived jobs have no chat. */
export function canMessageJob(job: { status: string; sealedAt?: string | null; updatedAt?: string | null }, now: number): boolean {
  if (job.status === "CANCELLED" || job.status === "PENDING_VEHICLE" || job.status === "STANDBY") return false;
  if (job.status !== "DELIVERED") return true;
  const t = Date.parse(job.sealedAt ?? job.updatedAt ?? "");
  return !Number.isNaN(t) && now - t <= JOB_CHAT_DAYS_AFTER_DELIVERY * 86_400_000;
}

/** Trim and validate a message body. Returns the clean text or an error. */
export function cleanJobMessage(raw: string): { ok: true; text: string } | { ok: false; error: string } {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, error: "Write a message." };
  if (text.length > JOB_MESSAGE_MAX) return { ok: false, error: `Keep it under ${JOB_MESSAGE_MAX} characters.` };
  return { ok: true, text };
}
