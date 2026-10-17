// A booking row must name what was booked. The live catalogue only lists services on the menu today, so a booking made
// for a service that was later taken off the menu would have no name. Look those up directly, once each.
import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { db } from "./firebase";

const cache = new Map<string, string | null>();

/** Ids that no known name covers yet. */
export function missingNameIds(ids: string[], known: Record<string, string>): string[] {
  return [...new Set(ids)].filter((id) => id && !known[id] && !cache.has(id));
}

export function cachedName(id: string): string | null {
  return cache.get(id) ?? null;
}

export async function loadServiceNames(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all([...new Set(ids)].map(async (id) => {
    if (!id) return;
    if (!cache.has(id)) {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.services(), id));
        const n = snap.exists() ? String((snap.data() as { name?: string }).name ?? "").trim() : "";
        cache.set(id, n || null);
      } catch { return; }
    }
    const n = cache.get(id);
    if (n) out[id] = n;
  }));
  return out;
}
