/** Readable bay text for the jobs and bookings screens. Uses the studio's bay name; falls back to the old short id form. Never shows a raw generated id. */
export function bayLabel(bayId: string | null | undefined, bays: ReadonlyArray<{ id: string; name: string }>): string | undefined {
  if (!bayId) return undefined;
  const hit = bays.find((b) => b.id === bayId);
  if (hit?.name) return hit.name;
  return /^bay[-_]/i.test(bayId) ? bayId.replace(/^bay[-_]?/i, "") : undefined;
}

/** "Bay wash-1" for short ids, the name as-is when it already says bay ("General Bay 1"). */
export function bayChip(label: string): string {
  return /bay/i.test(label) ? label : `Bay ${label}`;
}

