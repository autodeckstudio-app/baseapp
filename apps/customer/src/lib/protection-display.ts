import type { Protection } from "@autodeck/core";

export const PROTECTION_KIND_LABELS: Record<string, string> = {
  insurance: "Insurance",
  fasttag: "FastTag",
  puc: "PUC Certificate",
  rc: "Registration Certificate",
  extended_warranty: "Extended Warranty",
  ppf: "Paint Protection Film",
  ceramic: "Ceramic Coating",
  other: "Other",
};

/** Self-declared entries are "Added by you" - AutoDeck has not verified them.
 * A missing source means the record predates source tracking (origin unknown,
 * entered from the admin side) - never presented as AutoDeck-performed work. */
export function isSelfDeclared(p: Protection): boolean {
  return p.source === "customer";
}

/** "Added by you" is ownership-bound: a self-declared record entered by a
 * FORMER owner of this car is never presented to the current owner as
 * "Added by you" (or editable by them) - it stays a neutral "On record". */
export function isOwnSelfDeclared(p: Protection, uid: string | null | undefined): boolean {
  return isSelfDeclared(p) && (uid !== null && uid !== undefined) && p.customerId === uid;
}

/** Lifecycle: absent means "current" (all older records). Superseded and
 * removed records are history: kept, never deleted, excluded from
 * current-state displays, from the add-another gate, and from editing. */
export function isCurrentProtection(p: Protection): boolean {
  return (p.lifecycle ?? "current") === "current";
}

/** A customer may edit only their OWN unverified self-declared entries that
 * are still CURRENT - a superseded or removed record is history and is never
 * editable (the server rejects the write too; the UI must not offer it). */
export function isCustomerEditable(p: Protection, uid: string | null | undefined): boolean {
  return isOwnSelfDeclared(p, uid) && p.status === "unverified" && isCurrentProtection(p);
}

/** Neutral provenance for a history row: how the record ended and when, from
 * the stored lifecycle fields only - never a coverage or quality claim. */
export function protectionLifecycleLabel(p: Protection, formatDate: (iso: string) => string): string | null {
  // Invalid/missing lifecycleAt renders no date at all (never "Invalid Date").
  const valid = typeof p.lifecycleAt === "string" && p.lifecycleAt.length > 0 && !Number.isNaN(Date.parse(p.lifecycleAt));
  const when = valid ? formatDate(p.lifecycleAt as string) : null;
  if (p.lifecycle === "superseded") {
    // "Replaced by newer work" asserts a replace EVENT: only with explicit
    // evidence (the superseding job reference). Legacy superseded rows without
    // it stay neutral - the record does not say why it was superseded.
    const hasReplaceEvidence = typeof p.supersededByJobId === "string" && p.supersededByJobId.length > 0;
    const base = hasReplaceEvidence ? "Replaced by newer work" : "Superseded";
    return when ? `${base} · ${when}` : base;
  }
  if (p.lifecycle === "removed") return when ? `Removed · ${when}` : "Removed";
  return null;
}

/** History ordering: newest end-of-lifecycle first, but only for parseable
 * dates. A missing or invalid lifecycleAt never dominates the order - those
 * rows sort last, in stable input order, so an undated legacy row can never
 * read as the most recent event. */
export function sortProtectionHistory(list: Protection[]): Protection[] {
  const ts = (p: Protection): number | null => {
    const t = typeof p.lifecycleAt === "string" ? Date.parse(p.lifecycleAt) : NaN;
    return Number.isNaN(t) ? null : t;
  };
  return list
    .map((p, i) => ({ p, i, t: ts(p) }))
    .sort((a, b) => {
      if (a.t === null && b.t === null) return a.i - b.i;
      if (a.t === null) return 1;
      if (b.t === null) return -1;
      return b.t - a.t;
    })
    .map(({ p }) => p);
}

/** Verification evidence exists only as a PAIR: a non-empty verifier identity AND a
 * parseable timestamp. A bare status enum, a blank verifier, or a timestamp alone
 * proves nothing - the row stays "On record". */
export function hasVerificationEvidence(p: Protection): boolean {
  if (p.status !== "verified") return false;
  if (typeof p.verifiedBy !== "string" || p.verifiedBy.trim().length === 0) return false;
  if (typeof p.verifiedAt !== "string" || Number.isNaN(Date.parse(p.verifiedAt))) return false;
  return true;
}

/** Chip marker: only what the stored record proves. Self-declared entries (recorded
 * source "customer") are visibly "Added by you". "Record verified" appears only with
 * the verifier+timestamp evidence pair - and it means the RECORD was checked, never
 * issuer-confirmed coverage (the detail line says that explicitly for issuer-backed
 * kinds, naming the actual issuer). A missing source or unverified record is the
 * neutral "On record": history is never assigned a source by absence. The row title
 * names it a record ("Insurance record") so it can never read as the same thing as a
 * customer's checked document ("Document checked"). The two record types stay
 * distinct; nothing merges or supersedes across models. */
export function protectionChip(p: Protection): string {
  if (isSelfDeclared(p)) return "Added by you";
  return hasVerificationEvidence(p) ? "Record verified" : "On record";
}

/** Viewer-aware chip: same as protectionChip, but a self-declared record
 * that belongs to someone else (e.g. a former owner of the car) is never
 * shown to this viewer as "Added by you". */
export function protectionChipFor(p: Protection, uid: string | null | undefined): string {
  if (isSelfDeclared(p)) return isOwnSelfDeclared(p, uid) ? "Added by you" : "On record";
  return hasVerificationEvidence(p) ? "Record verified" : "On record";
}

/** Row title for a protection record in the documents card: the kind named as a RECORD,
 * distinct from a paper row's document title ("Insurance" + "Document checked"). */
export function protectionRecordTitle(p: Protection): string {
  return `${PROTECTION_KIND_LABELS[p.kind] ?? p.kind} record`;
}

/**
 * Display-only warranty text. A year count alone is never turned into an
 * expiry: "5-year warranty" is shown as-is, and a start date is only ever
 * shown as a start, never added to the years.
 */
/** Kinds backed by a third-party issuer, with the issuer named: a verified record is
 * AutoDeck's record check, never the issuer confirming coverage or validity - say so
 * explicitly on the row, with the issuer appropriate to the kind. */
const ISSUER_LABELS: Record<string, string> = {
  insurance: "insurer",
  fasttag: "issuing bank",
  puc: "testing centre",
  rc: "RTO",
  extended_warranty: "warranty provider",
};

export function protectionDetail(p: Protection, formatDate: (iso: string) => string): string {
  const parts: string[] = [];
  if (p.provider) parts.push(p.provider);
  const issuer = ISSUER_LABELS[p.kind];
  if (!isSelfDeclared(p) && hasVerificationEvidence(p) && issuer) {
    parts.push(`Verified as a record only, not ${issuer} confirmation`);
  }
  // Years are never an affirmed or active warranty - not for the customer's own
  // report, and not for a studio record: "Record verified" means the RECORD was
  // checked, never that coverage exists or was issued by the issuer.
  if (p.warrantyYears) parts.push(isSelfDeclared(p) ? `Reported warranty: ${p.warrantyYears} years, not verified` : `Warranty on record: ${p.warrantyYears} years`);
  if (p.startDate) parts.push(`since ${formatDate(p.startDate)}`);
  if (p.expiryDate) parts.push(`Expires ${formatDate(p.expiryDate)}`);
  return parts.join(" · ");
}
