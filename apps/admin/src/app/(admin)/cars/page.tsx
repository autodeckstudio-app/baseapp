"use client";

import { useCallback, useEffect, useState } from "react";
import type { CarLead } from "@autodeck/core";
import { listAllListings, listLeads, reviewListing, saveListing, setLeadStatus, uploadListingPhoto, type AdminListing } from "../../../lib/carsale-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { CarsView } from "../../../experience/CarsView";

export default function CarsPage() {
  const { claims } = useAdminAuth();
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [leads, setLeads] = useState<CarLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([listAllListings(), listLeads()]);
      setListings(a); setLeads(b);
    } catch { setError("Couldn't load cars."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (claims) void load(); }, [claims, load]);

  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    setBusy(true); setError(null); setMessage(null);
    try { await action(); setMessage(ok); await load(); }
    catch (err) { setError(err instanceof Error && err.message ? err.message : fail); }
    finally { setBusy(false); }
  }

  return (
    <CarsView
      listings={listings}
      leads={leads}
      loading={loading}
      busy={busy}
      error={error}
      message={message}
      onSave={(input, files) => void run(async () => {
        const added = await Promise.all(files.map((f) => uploadListingPhoto(f)));
        await saveListing({ ...input, photoPaths: [...input.photoPaths, ...added] });
      }, "Car saved.", "Couldn't save the car.")}
      onReview={(l, d, reason) => void run(() => reviewListing(l.id, d, reason), d === "approve" ? "Approved. It is live for 60 days." : "Rejected. The seller can see the reason.", "Couldn't review the car.")}
      onLead={(l, s) => void run(() => setLeadStatus(l.id, s), "Updated.", "Couldn't update.")}
    />
  );
}
