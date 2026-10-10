import { isValidDateOnly, normalizeRcReference } from "../schemas/paper.js";
import type { PaperKind, PaperStatus } from "@autodeck/core";

export interface PaperDecision {
  status: PaperStatus;
  reason: string;
  extractedPlate: string | null;
  extractedExpiry: string | null;
}
const TYPE_WORDS: Record<PaperKind, RegExp> = {
  PUC: /pollution|\bPUC\b|emission/i,
  INSURANCE: /insurance|policy|insurer/i,
  RC: /registration|registering authority|certificate of registration/i,
  FASTAG: /fastag/i,
  OTHER: /$^/,
};
/** Only document text is trusted, never customer-entered expiry/reference. */
export function decidePaper(text: string, confidence: number, kind: PaperKind, vehiclePlate: string, today: string): PaperDecision {
  const pending = (reason: string): PaperDecision => ({ status: "PENDING", reason, extractedPlate: null, extractedExpiry: null });
  if (confidence < 80 || !TYPE_WORDS[kind].test(text)) return pending("The document is unreadable or its type could not be confirmed. Please review the original.");
  const plates = [...new Set((text.toUpperCase().match(/\b[A-Z]{2}[ -]?\d{2}[ -]?[A-Z]{1,3}[ -]?\d{4}\b/g) ?? []).map(normalizeRcReference))];
  if (plates.length !== 1) return pending("A single vehicle plate could not be read confidently.");
  const dates: string[] = [];
  const expiry = /(?:valid\s*(?:up\s*)?to|valid\s*until|validity\s*(?:up\s*)?to|expir(?:y|es|ation)(?:\s*date)?|date\s*of\s*expiry|policy\s*end(?:\s*date)?)\s*[:.-]?\s*(\d{1,4}[./-]\d{1,2}[./-]\d{2,4})/gi;
  for (const match of text.matchAll(expiry)) {
    const parts = (match[1] ?? "").split(/[./-]/);
    const [a = "", b = "", c = ""] = parts;
    // Two-digit years are ambiguous. Indian numeric dates are DD/MM/YYYY.
    const date = a.length === 4 ? `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}` : c.length === 4 ? `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}` : "";
    if (isValidDateOnly(date)) dates.push(date);
  }
  const uniqueDates = [...new Set(dates)];
  const plate = plates[0] ?? "";
  if (plate !== normalizeRcReference(vehiclePlate)) return { status: "REJECTED", reason: `Document plate ${plate} does not match vehicle ${vehiclePlate}.`, extractedPlate: plate, extractedExpiry: uniqueDates[0] ?? null };
  if (uniqueDates.length !== 1) return { ...pending("An unambiguous labelled expiry date could not be read. Please review the original."), extractedPlate: plate };
  const date = uniqueDates[0] ?? "";
  return { status: date < today ? "REJECTED" : "VERIFIED", reason: date < today ? `Document expired on ${date}.` : `Vehicle plate matches and document is valid until ${date}.`, extractedPlate: plate, extractedExpiry: date };
}
