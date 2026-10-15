import type { Service } from "@autodeck/core";

// Warranty labels are per film or product, never per brand. Sources and open points: docs/WARRANTY-CLAIMS.md.
// Anything not listed here and not in the exact table below shows no warranty until it is sourced.
const FILM_WARRANTY: Record<string, string | null> = {
  "garware plus": "5-Year PPF Film Warranty",
  "garware premium": "8-Year PPF Film Warranty",
  "garware protect": "3-Year PPF Film Warranty",
  "garware platinum": null,
  "llumar gloss": "5-Year PPF Film Warranty",
  "llumar matte": "5-Year PPF Film Warranty",
  "llumar platinum": "10-Year PPF Film Warranty",
  "llumar valor": "12-Year PPF Film Warranty",
  "3m series 200": "10-Year PPF Film Warranty",
  "3m series 150": "10-Year PPF Film Warranty",
  "3m series 100": "7-Year PPF Film Warranty",
  "3m series 50": "5-Year PPF Film Warranty",
  "xpel ultimate plus": "10-Year PPF Film Warranty",
  "xpel stealth": "10-Year PPF Film Warranty",
  "kovalent graphene": "7-Year Coating Warranty",
  "kovalent borophene": "9-Year Coating Warranty (registration needed)",
};
// Seeded cards that name a brand and a coverage but not a film, or a coating with no sourced term: blank.
const BLANK_WARRANTY_IDS = new Set([
  "menu-coat-autodeck-1", "menu-coat-autodeck-2", "menu-coat-fireball-1", "menu-coat-fireball-2", "menu-coat-fireball-3",
  "menu-coat-3m-ceramic",
]);
export function applyBrandWarranty(s: Service): Service {
  const k = s.name.toLowerCase();
  if (k in FILM_WARRANTY) return { ...s, warrantyLabel: FILM_WARRANTY[k] ?? null };
  if (BLANK_WARRANTY_IDS.has(s.id) || s.id.startsWith("menu-ppf-")) return { ...s, warrantyLabel: null };
  return s;
}

