/** Pickup and drop helpers for the Studio Pickups page: fee wording, the confirm gate and the agreed-time check. */

export function pickupFeeLabel(feePaise: number | null | undefined, memberMembershipId?: string | null, kind?: string): string {
  if (feePaise === null || feePaise === undefined) return "No price yet - admin sets it";
  if (memberMembershipId) return "Free with membership";
  if (feePaise === 0) return "Free";
  const rupees = feePaise / 100;
  const fmt = (n: number) => `Rs ${Number.isInteger(n) ? n : n.toFixed(2)}`;
  // The stored fee is for the whole request. "Pick up and drop back" is two legs, each an equal share (the server splits it the same way).
  return kind === "both" ? `${fmt(rupees)} total (${fmt(rupees / 2)} each way)` : fmt(rupees);
}

/** A request with no price (the customer sent no pin) waits for admin to price it, so the customer and studio see the same fee. */
export function confirmBlockReason(r: { status: string; feePaise?: number | null }): string | null {
  if (r.status !== "REQUESTED") return null;
  if (r.feePaise === null || r.feePaise === undefined) return "Admin needs to set the pickup price before this can be confirmed.";
  return null;
}

const SHAPE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

/** Agreed times are India studio time. Accepts "YYYY-MM-DD HH:mm" (or with a T), checks it is a real date and not in the past. Returns the string the server expects. */
export function checkAgreedTime(input: string, now: Date = new Date()): { ok: true; value: string } | { ok: false; error: string } {
  const m = SHAPE.exec(input.trim());
  if (!m) return { ok: false, error: "Pick a date and time." };
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const probe = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d || h > 23 || mi > 59) return { ok: false, error: "That date or time does not exist." };
  const at = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+05:30`);
  if (at.getTime() < now.getTime() - 5 * 60_000) return { ok: false, error: "That time is already past (India time)." };
  return { ok: true, value: `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` };
}
