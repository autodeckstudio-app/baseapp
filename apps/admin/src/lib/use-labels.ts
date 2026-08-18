"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Resolves a set of document IDs in a given collection to a display label,
 * caching results across re-renders. Used to turn raw customerId/vehicleId/
 * serviceId references into readable names on dense admin tables without a
 * dedicated Cloud Function — these are simple get()s the admin role is
 * already allowed to make directly.
 */
export function useLabels(collectionName: string, ids: string[], extract: (data: unknown) => string) {
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    const missing = Array.from(new Set(ids)).filter((id) => id && !(id in labels));
    if (missing.length === 0) return;
    let cancelled = false;
    void Promise.all(
      missing.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, collectionName, id));
          return [id, snap.exists() ? extract(snap.data()) : id] as const;
        } catch {
          return [id, id] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setLabels((prev) => {
        const next = { ...prev };
        for (const [id, label] of entries) next[id] = label;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [collectionName, ids, labels]);

  return labels;
}
