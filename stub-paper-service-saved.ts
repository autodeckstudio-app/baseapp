// Fixture transport for the saved-photo usability captures: one VERIFIED
// insurance document WITH a saved photo; the resolver serves the local
// fixture image. updateMyPaper records calls on window for the capture log.
const paper = {
  id: "p1", tenantId: "t", studioId: "s", vehicleId: "v1", customerId: "me", kind: "INSURANCE",
  reference: "POL-1", title: null, issuedOn: null, expiresOn: "2030-01-01", status: "VERIFIED",
  verificationMode: "automatic", verificationReason: null, reviewedBy: "staff", reviewedAt: "2026-10-01T10:00:00.000Z",
  rejectionReason: null, evidenceUrl: "photo-fixture.png", evidencePath: "papers/p1/photo.png",
  submittedBy: "customer", submissionId: null, supersededAt: null,
  createdAt: "2026-01-04T00:00:00.000Z", updatedAt: "2026-01-04T00:00:00.000Z",
};
export const listenToVehiclePapers = (_v: string, _t: string, _c: string, onData: (l: unknown[]) => void) => { onData([paper]); return () => {}; };
export const listenToCustomerPapers = (_t: string, _c: string, onData: (l: unknown[]) => void) => { onData([paper]); return () => {}; };
export const submitMyPaper = async () => {};
export const updateMyPaper = async (input: unknown) => { (window as unknown as { __updateCalls: unknown[] }).__updateCalls.push(input); };
export const deleteMyPaper = async () => {};
export const resolvePaperEvidenceUrl = async () => ({ url: "photo-fixture.png", failure: null });
export const daysUntil = (iso: string | null) => {
  if (!iso) return null;
  return Math.ceil((new Date(iso + "T00:00:00Z").getTime() - Date.now()) / 86400000);
};
(window as unknown as { __updateCalls: unknown[] }).__updateCalls = [];
