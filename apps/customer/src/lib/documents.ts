// Pure helpers for the car Documents section. No Firebase here so they can be tested directly.
import type { TimelineItem } from "./car-timeline";

export type DocLike = { id: string; kind: string; reference: string; title?: string | null; expiresOn: string | null; supersededAt?: string | null; submissionId?: string | null };

const KIND_LABELS: Record<string, string> = { RC: "Registration Certificate", INSURANCE: "Insurance", PUC: "PUC Certificate", FASTAG: "FastTag", OTHER: "Other" };

/** Row title: an OTHER document shows the name the customer gave it. Older ones without a name still render as "Other". */
export function paperName(p: Pick<DocLike, "kind" | "title">): string {
  if (p.kind === "OTHER" && p.title && p.title.trim()) return p.title.trim();
  return KIND_LABELS[p.kind] ?? p.kind;
}

/** Same rule as the server: case-insensitive, spaces ignored. */
export function numberKey(reference: string): string { return reference.replace(/\s+/g, "").toUpperCase(); }

/** Inline error text when this number is already on another of the customer's documents (any car). Editing a document never flags itself. */
/**
 * exceptSubmissionId: the add-form's own operation id. The record a lost-acknowledged earlier
 * save of THIS form left behind carries the same id - it is this submission, not a clash, and
 * the server replays it. Any OTHER record holding the number (older orphan, different document)
 * still blocks with this message; the server then decides exactly (replay vs duplicate).
 */
/**
 * Display precedence between the two document models on the car detail Documents card.
 * A Paper is the customer-owned, evidence-backed record (photo, checks, review). A legacy
 * Protection of a document kind (insurance/rc/puc/fasttag) is an AutoDeck-entered record from
 * before customer uploads existed. When an active Paper of a kind exists, the Protection of
 * the matching kind is the same real-world policy (or a stale older one): rendering both
 * would show one policy as two rows with two different truth claims, so the Paper row wins
 * and the Protection row is hidden - the record itself is untouched and reappears if the
 * Paper is removed. Kinds with no Paper counterpart (extended_warranty, other) always render.
 */
export const PAPER_TO_PROTECTION_KIND: Record<string, string> = { RC: "rc", INSURANCE: "insurance", PUC: "puc", FASTAG: "fasttag" };

export function numberClash(all: DocLike[], reference: string, exceptId?: string | null, exceptSubmissionId?: string | null): string | null {
  const key = numberKey(reference);
  if (!key) return null;
  return all.some((p) => p.id !== exceptId && !(exceptSubmissionId && p.submissionId === exceptSubmissionId) && !p.supersededAt && numberKey(p.reference ?? "") === key) ? "This number is already saved on one of your documents." : null;
}

export function daysLeftLabel(days: number): string {
  return days < 0 ? "Expired" : days === 0 ? "Expires today" : `${days} day${days === 1 ? "" : "s"} left`;
}

/** The one expiry list: documents and warranties with a date, soonest first. Each row is a name plus a days-left badge. */
export function buildDocumentList(i: { papers: Array<DocLike & { days: number | null }>; warranties: Array<{ label: string; endDate: string | null; days: number | null }> }): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const p of i.papers) {
    if (p.supersededAt || !p.expiresOn || p.days === null) continue;
    const at = Date.parse(`${p.expiresOn}T00:00:00+05:30`);
    out.push({ key: `paper-${p.id}`, when: "", title: paperName(p), sub: "", soon: p.days <= 30, pill: daysLeftLabel(p.days), at } as TimelineItem);
  }
  i.warranties.forEach((w, n) => {
    if (w.days === null || !w.endDate) return;
    const at = Date.parse(w.endDate);
    out.push({ key: `warranty-${n}`, when: "", title: w.label, sub: "", soon: w.days <= 60, pill: daysLeftLabel(w.days), at } as TimelineItem);
  });
  return out.sort((a, b) => a.at - b.at);
}
