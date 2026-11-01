"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { SUBCOLLECTIONS } from "@autodeck/database";
import { useAdminAuth } from "../lib/auth-context";
import { buildProtectionWork, newInstallDraft, newRemoveDraft, newReplaceDraft, selectTarget, targetableRecords, type DeclarationDraft, type DraftEvent, type Protection, type ProtectionCoverageScope, type ProtectionCosmeticKind, type ProtectionWorkEvent, type ServiceJob } from "@autodeck/core";
import { db, functions } from "../lib/firebase";

const KIND_LABELS: Record<ProtectionCosmeticKind, string> = { ppf: "PPF", ceramic: "Ceramic" };
const SCOPE_LABELS: Record<ProtectionCoverageScope, string> = { full_body: "Full body", full_front: "Full front", high_impact: "High impact" };
/** Same distinguishing label as the studio panel: kind, scope, on-record
 * date, source and unique ref, so staff know WHICH old record they name. */
const recordLabel = (p: Protection) => {
  const kind = p.kind === "ceramic" ? "Ceramic" : p.kind === "ppf" ? "PPF" : "Protection";
  const scope = p.coverage ? (SCOPE_LABELS[p.coverage as ProtectionCoverageScope] ?? p.coverage) : "scope not on record";
  const date = (p.startDate ?? p.createdAt ?? "").slice(0, 10) || "date not on record";
  const source = p.source === "customer" ? "customer entry" : "studio record";
  return `${kind} - ${scope}${p.provider ? ` (${p.provider})` : ""} - ${date} - ${source} - ref ${p.id}`;
};

type OperatorAuth = { uid: string; role: string | null; tenantId: string | null; studioId: string | null };
type FrozenContext = { jobId: string; vehicleId: string; tenantId: string; studioId: string; auth: OperatorAuth | null };
type InvalidReason = "verifying" | "job" | "stage" | "account" | null;

const sameAuth = (a: OperatorAuth | null, b: OperatorAuth | null) =>
  a === b || (a !== null && b !== null && a.uid === b.uid && a.role === b.role && a.tenantId === b.tenantId && a.studioId === b.studioId);

/** Mirrors the backend advanceJobStatus gate (roles studio/admin/superadmin,
 * tenant match, studio-scoped staff pinned to their studio). A signed-out
 * operator, a missing role, or a scope mismatch is NEVER a valid affirmation
 * context - including as the INITIAL context. The backend remains the
 * authority; this only decides what the pane may affirm locally. */
const affirmable = (a: OperatorAuth | null, job: { tenantId: string; studioId: string }): a is OperatorAuth =>
  a !== null &&
  (a.role === "studio" || a.role === "admin" || a.role === "superadmin") &&
  (a.role === "superadmin" || (a.tenantId !== null && a.tenantId === job.tenantId)) &&
  (a.role !== "studio" || (a.studioId !== null && a.studioId === job.studioId));

/** One string naming EVERYTHING a delivery affirmation is bound to: the job
 * scope from the job document (never the caller's claims) AND the verified
 * operator fingerprint (uid + role/tenant/studio claims). Compared
 * synchronously at render time, so a prop or auth change invalidates the
 * open declaration in the SAME render - no effect needs to flush first. */
const contextSig = (job: ServiceJob, auth: OperatorAuth | null): string =>
  [job.id, job.vehicleId, job.tenantId, job.studioId, job.status,
   auth ? `${auth.uid}:${auth.role ?? "-"}:${auth.tenantId ?? "-"}:${auth.studioId ?? "-"}` : "signed-out"].join("|");

/** Admin delivery declaration: the same explicit staff-declared contract as
 * the studio pane - nothing prefilled, targets frozen at selection, late
 * fetches and live-job changes invalidate, confirm guarded in the handler
 * with a same-tick lock and a frozen payload. Shares the ONE builder in
 * @autodeck/core with the studio app. */
export function DeliveryDeclaration({ job, onDelivered, onCancel }: { job: ServiceJob; onDelivered: () => void; onCancel: () => void }) {
  // The VERIFIED operator fingerprint from the admin auth context (server-
  // session-verified claims), not a raw client cache: uid + role/tenant/
  // studio. Undefined while the session is still being verified.
  const { user, claims, loading: authLoading } = useAdminAuth();
  const liveAuth: OperatorAuth | null | undefined = authLoading ? undefined : (user && claims ? { uid: user.uid, role: claims.role ?? null, tenantId: claims.tenantId ?? null, studioId: claims.studioId ?? null } : null);
  const frozen = useRef<FrozenContext | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [protections, setProtections] = useState<Protection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [integrityError, setIntegrityError] = useState(false);
  const [draft, setDraft] = useState<DeclarationDraft>({ choice: null });
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reset, setReset] = useState(0);

  // Live signature, refreshed SYNCHRONOUSLY every render. Async completions
  // compare against this ref, never against a closure captured earlier.
  const authReady = liveAuth !== undefined;
  const liveSig = authReady ? contextSig(job, liveAuth) : null;
  const liveSigRef = useRef(liveSig);
  liveSigRef.current = liveSig;

  // Monotonic invalidation generation: bumped SYNCHRONOUSLY on EVERY signature
  // change, either direction. A signature round-trip (job A -> B -> A) bumps
  // it twice, so a completion started before the detour can never revive -
  // signature equality alone is not enough.
  const prevSigRef = useRef(liveSig);
  const invalidGen = useRef(0);
  if (prevSigRef.current !== liveSig) { prevSigRef.current = liveSig; invalidGen.current += 1; }

  // Freeze the context on the first AFFIRMABLE render: verified session,
  // delivery-capable role, tenant/studio scope matching THIS job. Signed-out
  // or wrong-scope operators never become a frozen valid context.
  if (frozen.current === null && authReady && affirmable(liveAuth, job)) {
    frozen.current = { jobId: job.id, vehicleId: job.vehicleId, tenantId: job.tenantId, studioId: job.studioId, auth: liveAuth };
  }

  const f = frozen.current;
  const invalid: InvalidReason =
    !authReady ? "verifying"
    : !affirmable(liveAuth, job) ? "account"
    : !f ? null
    : (job.id !== f.jobId || job.vehicleId !== f.vehicleId || job.tenantId !== f.tenantId || job.studioId !== f.studioId) ? "job"
    : !sameAuth(liveAuth, f.auth) ? "account"
    : job.status !== "READY_FOR_DELIVERY" ? "stage"
    : null;
  const contextValid = invalid === null;
  const payload = buildProtectionWork(draft, protections);

  const load = useCallback(async (ctx: FrozenContext) => {
    const gen = ++generation.current;
    const startSig = liveSigRef.current;
    setLoading(true); setLoadError(false); setIntegrityError(false);
    try {
      const snap = await getDocs(query(collection(db, SUBCOLLECTIONS.vehicleProtections(ctx.vehicleId)), where("tenantId", "==", ctx.tenantId)));
      if (gen !== generation.current || liveSigRef.current !== startSig) return; // superseded, invalidated, or unmounted
      const records = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Protection);
      if (records.some((r) => r.vehicleId !== ctx.vehicleId)) { setIntegrityError(true); setProtections([]); return; }
      setProtections(records);
    } catch {
      if (gen !== generation.current || liveSigRef.current !== startSig) return;
      setLoadError(true); setProtections([]);
    } finally {
      if (gen === generation.current && liveSigRef.current === startSig) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; };
  }, []);

  // Kick the first records load once auth is verified and the context frozen.
  useEffect(() => {
    if (frozen.current && loading && protections.length === 0 && !loadError && !integrityError) void load(frozen.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, load]);

  // The live job or the operator context moved under the pane: drop what was
  // loaded and any pending-attempt UI. The invalidation path owns these
  // resets - a stale async completion writes NOTHING.
  useEffect(() => {
    if (invalid !== null && invalid !== "verifying") {
      generation.current += 1;
      setLoading(false); setLoadError(false); setIntegrityError(false); setProtections([]); setDraft({ choice: null });
      setPending(false); setSubmitError(null);
    }
  }, [invalid]);

  function reload() {
    if (inFlight.current || !authReady) return; // never re-aim while a commit is in flight or the session is unverified
    if (!affirmable(liveAuth, job)) return; // signed-out / wrong-scope operators cannot re-aim a declaration
    frozen.current = { jobId: job.id, vehicleId: job.vehicleId, tenantId: job.tenantId, studioId: job.studioId, auth: liveAuth };
    setDraft({ choice: null });
    setSubmitError(null);
    setReset((k) => k + 1);
    void load(frozen.current);
  }

  async function confirm() {
    if (inFlight.current) return;
    if (!contextValid || loading || loadError || integrityError || payload === null) return;
    inFlight.current = true;
    setPending(true); setSubmitError(null);
    const ctx = f as FrozenContext;
    const startSig = liveSigRef.current;
    const startGen = invalidGen.current;
    const frozenPayload = payload;
    // The attempt publishes ONLY if the context is still exactly the one that
    // started it, judged against the render-time live signature - so a route,
    // stage or auth change invalidates it even before any effect runs. A
    // dropped completion releases the lock but writes no state; the
    // invalidation effect owns the reset. No automatic retry, no lost-ack
    // readback claim: the operator reloads and looks.
    const stillCurrent = () => mounted.current && liveSigRef.current === startSig && invalidGen.current === startGen;
    try {
      await httpsCallable(functions, "advanceJobStatus")({ jobId: ctx.jobId, protectionWork: frozenPayload });
      if (!stillCurrent()) { inFlight.current = false; return; }
      onDelivered();
    } catch (err) {
      if (!stillCurrent()) { inFlight.current = false; return; }
      setSubmitError(err instanceof Error ? err.message : "Could not mark delivered. Reload the declaration and try again.");
      inFlight.current = false;
      setPending(false);
    }
  }

  const targets = targetableRecords(protections);
  const setEvents = (events: DraftEvent[]) => setDraft({ choice: "work", events });
  const updateEvent = (i: number, ev: DraftEvent) => setDraft((d) => d.choice === "work" ? { choice: "work", events: d.events.map((e, j) => (j === i ? ev : e)) } : d);
  const dis = pending;

  return (
    <div className="ax-delivery" style={{ display: "grid", gap: 8, minWidth: 0 }} key={reset}>
      <p>Mark delivered? This updates the studio, admin and customer tracker.</p>
      {invalid === "verifying" ? (
        <p role="status">Verifying the signed-in account...</p>
      ) : invalid === "job" ? (
        <>
          <p role="alert">This job changed since the declaration was opened. Reload the declaration for the job now on screen before delivering.</p>
          <button className="ax-button" disabled={dis} onClick={reload}>Reload declaration</button>
        </>
      ) : invalid === "account" ? (
        <>
          <p role="alert">The signed-in account or its permissions changed since this declaration was opened - the earlier affirmation belongs to another operator context. Reload the declaration under the current account.</p>
          <button className="ax-button" disabled={dis} onClick={reload}>Reload declaration</button>
        </>
      ) : invalid === "stage" ? (
        <p role="alert">This job is no longer awaiting delivery - it may already have been delivered. Go back and refresh the job.</p>
      ) : loading ? (
        <p role="status">Loading the car's protection records...</p>
      ) : loadError ? (
        <>
          <p role="alert">Could not load the car's protection records. Reload and try again before delivering.</p>
          <button className="ax-button" disabled={dis} onClick={reload}>Reload records</button>
        </>
      ) : integrityError ? (
        <p role="alert">The car's protection records failed an integrity check (a record does not belong to this car). Go back and reopen the job before delivering.</p>
      ) : (
        <>
          <fieldset disabled={dis} style={{ display: "grid", gap: 8, border: "none", padding: 0, margin: 0, minWidth: 0 }}>
            <legend className="ax-label">Protection work on this visit</legend>
            <p>Record exactly the protection work performed on this visit - this becomes the car's protection history. Choose "none" only if no protection work was done.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <label><input type="radio" name="decl-choice" checked={draft.choice === "none"} onChange={() => setDraft({ choice: "none" })} /> No protection work</label>
              <label><input type="radio" name="decl-choice" checked={draft.choice === "work"} onChange={() => setDraft({ choice: "work", events: [] })} /> Record work</label>
            </div>
            {draft.choice === "work" ? (
              <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
                {draft.events.map((ev, i) => (
                  <div key={i} style={{ display: "grid", gap: 4, border: "1px solid var(--ax-border, #444)", padding: 8, minWidth: 0 }}>
                    <p>{ev.action === "install" ? "New install" : ev.action === "replace" ? "Replace (like-for-like)" : "Remove"}</p>
                    {ev.action === "install" ? (
                      <>
                        <label>Type <select aria-label={`Install ${i + 1} type`} value={ev.kind ?? ""} onChange={(e) => updateEvent(i, { ...ev, kind: (e.target.value || null) as ProtectionCosmeticKind | null })}>
                          <option value="">Choose type</option>
                          {(Object.keys(KIND_LABELS) as ProtectionCosmeticKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                        </select></label>
                        <label>Scope <select aria-label={`Install ${i + 1} scope`} value={ev.coverage ?? ""} onChange={(e) => updateEvent(i, { ...ev, coverage: (e.target.value || null) as ProtectionCoverageScope | null })}>
                          <option value="">Choose scope</option>
                          {(Object.keys(SCOPE_LABELS) as ProtectionCoverageScope[]).map((c) => <option key={c} value={c}>{SCOPE_LABELS[c]}</option>)}
                        </select></label>
                      </>
                    ) : (
                      <>
                        {targets.length === 0 ? <p role="alert">No current PPF/ceramic records on this car to {ev.action}.</p> : null}
                        <label style={{ minWidth: 0 }}>Record <select style={{ width: "100%", minWidth: 0, maxWidth: "100%" }} aria-label={`${ev.action === "replace" ? "Replace" : "Remove"} target ${i + 1}`} value={ev.targetProtectionId ?? ""} onChange={(e) => {
                          const t = targets.find((p) => p.id === e.target.value);
                          updateEvent(i, t ? selectTarget(ev, t) : { ...ev, targetProtectionId: null, expectedRevision: null });
                        }}>
                          <option value="">Choose the record</option>
                          {targets.map((p) => <option key={p.id} value={p.id}>{recordLabel(p)}</option>)}
                        </select></label>
                        {ev.action === "replace" && ev.targetProtectionId ? <p>Same type and scope as the record above. Brand and warranty below are for the NEW work - leave blank if not known.</p> : null}
                      </>
                    )}
                    {ev.action !== "remove" ? (
                      <>
                        <label>Brand (optional) <input value={ev.brand} onChange={(e) => updateEvent(i, { ...ev, brand: e.target.value })} /></label>
                        <label>Warranty years <input inputMode="numeric" value={ev.warrantyYears} onChange={(e) => updateEvent(i, { ...ev, warrantyYears: e.target.value })} /></label>
                      </>
                    ) : null}
                    <button className="ax-button" onClick={() => setEvents(draft.choice === "work" ? draft.events.filter((_, j) => j !== i) : [])}>Remove this entry</button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                  <button className="ax-button" onClick={() => setEvents([...draft.events, newInstallDraft()])}>Add install</button>
                  <button className="ax-button" onClick={() => setEvents([...draft.events, newReplaceDraft()])}>Add replace</button>
                  <button className="ax-button" onClick={() => setEvents([...draft.events, newRemoveDraft()])}>Add removal</button>
                </div>
                {payload === null ? <p>Finish each entry to continue - every install needs a type and scope, every replace/removal needs a current record.</p> : null}
              </div>
            ) : null}
          </fieldset>
          <button className="ax-button" disabled={dis} onClick={reload}>Reload records</button>
        </>
      )}
      {submitError ? <p role="alert">{submitError}</p> : null}
      <button className="ax-button" disabled={dis || !contextValid || loading || loadError || integrityError || payload === null} onClick={() => void confirm()}>Confirm mark delivered</button>
      <button className="ax-button" disabled={dis} onClick={onCancel}>Cancel</button>
    </div>
  );
}
