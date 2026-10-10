// Customer search: one pure matcher for name, phone, email and car plate.
// Phone and plate compare on cleaned characters so "+91 70432 96549",
// "070432 96549" and "7043296549" all find the same person.

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** National number: strips a leading 91 country code or 0 trunk prefix when the rest is 10 digits. */
export function nationalDigits(value: string): string {
  const d = phoneDigits(value);
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d;
}

export function normalizePlate(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export interface SearchableCustomer { id: string; name?: string; phone?: string; email?: string }
export interface SearchableVehicle { ownerId: string; registrationNumber?: string }

export function plateIndex(vehicles: SearchableVehicle[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const v of vehicles) {
    const plate = normalizePlate(v.registrationNumber ?? "");
    if (!plate) continue;
    const list = map.get(v.ownerId);
    if (list) list.push(plate); else map.set(v.ownerId, [plate]);
  }
  return map;
}

export function customerMatches(c: SearchableCustomer, rawQuery: string, plates: Map<string, string[]>): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  if ((c.name ?? "").toLowerCase().includes(q)) return true;
  if ((c.email ?? "").toLowerCase().includes(q)) return true;
  const qDigits = phoneDigits(q);
  // Treat as a phone search only when the query is mostly digits (avoids "3" matching plates-in-names noise).
  if (qDigits.length >= 3 && qDigits.length >= q.replace(/[\s+\-()]/g, "").length) {
    const full = phoneDigits(c.phone ?? "");
    const national = nationalDigits(c.phone ?? "");
    const qNational = nationalDigits(q);
    if (full.includes(qDigits) || national.includes(qDigits) || (qNational.length >= 3 && national.includes(qNational))) return true;
  }
  const qPlate = normalizePlate(q);
  if (qPlate.length >= 2) {
    const owned = plates.get(c.id) ?? [];
    if (owned.some((p) => p.includes(qPlate))) return true;
  }
  return false;
}

export function customerIdsForPlate(plate: string, vehicles: SearchableVehicle[]): string[] {
  const target = normalizePlate(plate);
  if (target.length < 4) return [];
  const ids = new Set<string>();
  for (const v of vehicles) if (normalizePlate(v.registrationNumber ?? "").includes(target)) ids.add(v.ownerId);
  return [...ids];
}
