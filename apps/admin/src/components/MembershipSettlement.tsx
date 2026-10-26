"use client";
import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import type { Booking, ServiceJob } from "@autodeck/core";
import { functions } from "../lib/firebase";
import { MEMBERSHIP_SETTLEMENT_ENABLED } from "../lib/backend-features";
export function MembershipSettlement({
  job,
  booking,
}: {
  job: ServiceJob;
  booking: Booking | null;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  if (!MEMBERSHIP_SETTLEMENT_ENABLED) return null;
  if (
    job.settlementKind === "membership_covered" ||
    !booking?.membershipWashUsed ||
    booking.totalAmount !== 0 ||
    job.totalAmount !== 0 ||
    job.status === "CANCELLED" ||
    ["CANCELLED", "EXPIRED"].includes(booking.status)
  )
    return null;
  return (
    <section className="ax-panel">
      <span className="ax-label">Membership-covered, not yet settled</span>
      <p className="ax-note">
        The server checks the consumed wash and issues the zero-total invoice. This does not record
        money received.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <button
        className="ax-button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(null);
          void httpsCallable(
            functions,
            "settleMembershipCoveredJob",
          )({ jobId: job.id })
            .catch((e) => setError(e instanceof Error ? e.message : "Could not settle this visit."))
            .finally(() => setBusy(false));
        }}
      >
        Settle membership-covered visit
      </button>
    </section>
  );
}
