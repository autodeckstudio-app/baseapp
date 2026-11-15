// Display helpers for invoice line items. Older invoices may carry a raw
// "Service <catalogue id>" label from before names were snapshotted; never show an id.

export const GENERIC_SERVICE_LABEL = "Service";

// Catalogue ids are Firestore auto-ids (20 alphanumerics) or short slugs with digits/dashes/underscores.
const LEGACY_ID_LABEL = /^Service\s+[A-Za-z0-9_-]{6,}$/;
const BARE_ID = /^[A-Za-z0-9]{20}$/;

export function displayLineItemName(description: string | null | undefined): string {
  const text = (description ?? "").trim();
  if (!text) return GENERIC_SERVICE_LABEL;
  if (LEGACY_ID_LABEL.test(text) && /\d/.test(text.split(/\s+/)[1] ?? "")) return GENERIC_SERVICE_LABEL;
  if (BARE_ID.test(text) && /\d/.test(text) && /[A-Za-z]/.test(text)) return GENERIC_SERVICE_LABEL;
  return text;
}

const RAW_ID = /\bsvc-[a-z0-9][a-z0-9-]*/i;

function humanizeId(raw: string): string {
  const words = raw.replace(/^svc-/i, "").replace(/^brand-/i, "").split("-").filter(Boolean);
  if (words.length === 0) return "Service";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Customer-facing name for one line. Order: stored snapshot name, catalogue by
 * stored serviceId, catalogue by an id embedded in the description, readable
 * description as written, last resort a humanized id. Never returns a raw id.
 */
export function invoiceServiceLabel(li: {description?: string | null; serviceId?: string | null; serviceName?: string | null}, catalogue: Record<string, string>): string {
  const snap = li.serviceName?.trim();
  if (snap) return snap;
  if (li.serviceId && catalogue[li.serviceId]) return catalogue[li.serviceId] ?? "";
  const desc = (li.description ?? "").trim();
  const m = RAW_ID.exec(desc);
  if (m) {
    const hit = catalogue[m[0]] ?? catalogue[m[0].toLowerCase()];
    if (hit) return hit;
    const rest = desc.replace(RAW_ID, "").replace(/^\s*(service)?\s*[:\-]?\s*/i, "").trim();
    return rest.length > 0 && !/^service$/i.test(rest) ? rest : humanizeId(m[0]);
  }
  return desc || "Service";
}
