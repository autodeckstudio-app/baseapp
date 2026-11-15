// The private "car story" summary shown at the top of a car's History tab:
// how long the car has been cared for here, how many visits are complete,
// and the protection currently on record. Every fact comes from the car's
// own records; nothing is inferred from service names or invented.
//
// Date provenance: a completed visit is dated only from its sealedAt stamp
// (set when the job was delivered). createdAt is the booking/admin write
// time and is never shown as a visit date.

export type StoryProtection = { title: string; detail: string };

export type CarStory = {
  /** Count of delivered visits. */
  visits: number;
  /** Formatted date of the earliest delivered visit, or null when no delivered job carries a sealedAt stamp. */
  since: string | null;
  /** Current protection records, display-ready. */
  protections: StoryProtection[];
};

export function buildCarStory<J extends { status: string; sealedAt?: string | null }>(
  jobs: J[],
  protections: StoryProtection[],
  formatDate: (iso: string) => string,
): CarStory | null {
  const delivered = jobs.filter((j) => j.status === "DELIVERED");
  const sealed = delivered
    .map((j) => j.sealedAt)
    .filter((s): s is string => typeof s === "string" && s.length > 0 && !Number.isNaN(Date.parse(s)))
    .sort();
  const visits = delivered.length;
  if (visits === 0 && protections.length === 0) return null;
  const first = sealed.length > 0 ? sealed[0] : undefined;
  return { visits, since: first !== undefined ? formatDate(first) : null, protections };
}
