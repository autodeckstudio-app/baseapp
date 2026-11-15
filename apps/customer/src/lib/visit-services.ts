// What a visit was for. The invoice line items are the record of what was actually done (the booked service plus any approved
// extra work), so they come first. Then the catalogue name of the booked service. Never a vague "Studio visit" when a name is known.
export const VISIT_FALLBACK = "Service visit";

type Line = { description?: string; serviceName?: string; total?: number };
const FEE = /^(pickup|drop) fee$/i;

/** Distinct service names for a visit, booked service first. */
export function visitServices(job: { serviceId: string }, invoice: { lineItems?: Line[] } | null | undefined, catalogue: Record<string, string>): string[] {
  const out: string[] = [];
  const add = (n?: string | null) => { const t = (n ?? "").trim(); if (t && !FEE.test(t) && !out.includes(t)) out.push(t); };
  for (const li of invoice?.lineItems ?? []) add(li.serviceName ?? li.description);
  if (out.length === 0) add(catalogue[job.serviceId]);
  return out;
}

/** One line for a list row: "Quick wash", "Quick wash + 1 more", "Quick wash + 2 more". */
export function visitTitle(names: string[]): string {
  if (names.length === 0) return VISIT_FALLBACK;
  if (names.length === 1) return names[0]!;
  return `${names[0]} + ${names.length - 1} more`;
}

/** The full list, whenever the title is shortened to "first + N more". */
export function visitAlso(names: string[]): string | null {
  return names.length > 1 ? names.join(", ") : null;
}
