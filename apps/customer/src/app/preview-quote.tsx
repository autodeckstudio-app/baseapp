// Dev-only: the REAL quote panel driven end to end with sample data, no session and
// no network (?phase=requested|offered to choose the starting state). The mock update
// applies the same phase transitions the server would, so every tap shows the real UI.
import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import type { InspectionAgreement } from "@autodeck/core";
import { Screen, T } from "../ui/kit";
import { CustomerQuotePanel } from "../ui/CustomerQuotePanel";
import { __setQuotePreviewHooks, type CustomerQuote } from "../lib/service-quote";

const TERMS: InspectionAgreement = { version: "sample-terms-v1", feePaise: 0, hoursText: "Walk in Mon-Sat 09:00-21:00 (Asia/Kolkata). Sunday closed. No slot or bay is reserved.", hoursValidUntil: Date.now() + 7 * 864e5 };

const BASE: CustomerQuote = {
  id: "sample-quote",
  studioId: "sample-studio",
  requestedReference: { key: "sample-range", brand: "SAMPLE", name: "Requested reference film", group: "ppf", requestedWork: "Full-body replacement" },
  scope: { serviceId: "sample-offering", coverage: "SAMPLE full-body film · synthetic product" } as CustomerQuote["scope"],
  version: 1,
  phase: "requested",
  offer: { revision: 2, totalPaise: 7500000, workingMinutes: 1440, included: "Full-body film application and preparation", excluded: "Repair of existing damage", termsVersion: "sample-v2" },
  inspection: null,
  findings: null,
  acceptedRevision: null,
  bookingId: null,
};

function applyCommand(q: CustomerQuote, command: { kind: string; decision?: string }): CustomerQuote {
  const next = { ...q, version: q.version + 1 };
  if (command.kind === "request_inspection") return { ...next, phase: "inspection_requested" };
  if (command.kind === "confirm_inspection") return { ...next, phase: "inspection_confirmed", inspection: TERMS };
  if (command.kind === "answer" && command.decision === "inspect") return { ...next, phase: "inspection_requested" };
  if (command.kind === "answer" && command.decision === "accept") return { ...next, phase: "accepted", acceptedRevision: q.offer?.revision ?? null };
  if (command.kind === "answer" && command.decision === "decline") return { ...next, phase: "declined" };
  return next;
}

export default function PreviewQuote() {
  const { phase } = useLocalSearchParams<{ phase?: string }>();
  const [quote, setQuote] = useState<CustomerQuote>({ ...BASE, phase: phase === "offered" ? "offered" : "requested" });
  if (!__DEV__) return null;
  __setQuotePreviewHooks({ terms: async () => TERMS, update: async (q, _op, command) => applyCommand(q, command) });
  return (
    <Screen>
      <T role="caption" tone="secondary">SAMPLE ONLY · preview candidate · not live</T>
      <CustomerQuotePanel quote={quote} onChange={setQuote} />
    </Screen>
  );
}
