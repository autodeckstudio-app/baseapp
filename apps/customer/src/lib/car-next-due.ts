// The one thing on a car that runs out soonest: a document expiry or a warranty end. Pure.
export type DueItem = { label: string; date: string; days: number };

/** Soonest expiry still ahead (or already past, most overdue first is NOT shown here: past items are handled as "needs attention"). Dates are YYYY-MM-DD or ISO. */
export function nextDue(items: { label: string; date: string | null | undefined }[], today: string): DueItem | null {
  const t = Date.parse(`${today}T00:00:00Z`);
  const out: DueItem[] = [];
  for (const i of items) {
    if (!i.date) continue;
    const d = Date.parse(`${i.date.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(d)) continue;
    const days = Math.round((d - t) / 86_400_000);
    if (days >= 0) out.push({ label: i.label, date: i.date.slice(0, 10), days });
  }
  out.sort((a, b) => a.days - b.days);
  return out[0] ?? null;
}

export function dueLine(d: DueItem): string {
  return d.days === 0 ? "Today" : d.days === 1 ? "Tomorrow" : `In ${d.days} days`;
}
