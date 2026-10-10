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
