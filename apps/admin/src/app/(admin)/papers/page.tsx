"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where, documentId } from "firebase/firestore";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import type { PaperVerification, Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { db } from "../../../lib/firebase";
import { listenToPapers, findVehicleByPlate, submitPaper, reviewPaper } from "../../../lib/papers-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { PapersView } from "../../../experience/PapersView";

type StatusFilter = "PENDING" | "VERIFIED" | "REJECTED";

export default function PapersPage() {
  const { claims } = useAdminAuth();
  const [filter, setFilter] = useState<StatusFilter>("PENDING");
  const [papers, setPapers] = useState<PaperVerification[]>([]);
  const [vehiclesById, setVehiclesById] = useState<Map<string, Vehicle>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const studioId = claims?.studioId ?? FIRST_STUDIO_ID;

  useEffect(() => {
    if (!claims) return;
    setLoading(true);
    const unsub = listenToPapers(
      claims.tenantId,
      studioId,
      filter,
      (rows) => { setPapers(rows); setLoading(false); },
      () => { setError("Couldn't load papers."); setLoading(false); },
    );
    return unsub;
  }, [claims, studioId, filter]);

  // Resolve vehicle labels for the visible papers (chunked documentId IN).
  useEffect(() => {
    if (!claims || papers.length === 0) return;
    const missing = [...new Set(papers.map((x) => x.vehicleId))].filter((id) => !vehiclesById.has(id));
    if (missing.length === 0) return;
    (async () => {
      const found = new Map(vehiclesById);
      for (let i = 0; i < missing.length; i += 10) {
        const chunk = missing.slice(i, i + 10);
        const snap = await getDocs(
          query(collection(db, COLLECTIONS.vehicles()), where(documentId(), "in", chunk)),
        );
        for (const d of snap.docs) found.set(d.id, d.data() as Vehicle);
      }
      setVehiclesById(found);
    })().catch(() => {});
  }, [claims, papers, vehiclesById]);

  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(ok);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fail);
    } finally {
      setBusy(false);
    }
  }

  const resolvePlate = useMemo(
    () => async (plate: string) => (claims ? findVehicleByPlate(claims.tenantId, plate) : null),
    [claims],
  );

  return (
    <PapersView
      filter={filter}
      papers={papers}
      vehiclesById={vehiclesById}
      loading={loading}
      busy={busy}
      error={error}
      message={message}
      onFilter={setFilter}
      onResolvePlate={resolvePlate}
      onSubmit={(input) =>
        void run(
          () =>
            submitPaper({
              studioId,
              vehicleId: input.vehicleId,
              kind: input.kind,
              reference: input.reference,
              ...(input.expiresOn ? { expiresOn: input.expiresOn } : {}),
              ...(input.notes ? { notes: input.notes } : {}),
            }),
          "Document registered for verification.",
          "Couldn't register the document.",
        )
      }
      onReview={(paper, decision, reason) =>
        void run(
          () => reviewPaper({ paperId: paper.id, decision, ...(reason ? { rejectionReason: reason } : {}) }),
          decision === "VERIFIED" ? "Marked verified." : "Marked rejected.",
          "Couldn't save the review.",
        )
      }
    />
  );
}
