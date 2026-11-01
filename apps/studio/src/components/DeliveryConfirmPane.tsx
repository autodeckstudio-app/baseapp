import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { colors, spacing, typography, Button } from "@autodeck/ui";
import type { Protection, ProtectionWorkEvent, ServiceJob } from "@autodeck/core";
import { advanceJobStatus, getCurrentProtections, onStaffAuthChanged, type StaffAuth } from "../lib/studio-service";
import { DeliveryDeclarationPanel } from "./DeliveryDeclarationPanel";

type FrozenContext = { jobId: string; vehicleId: string; tenantId: string; studioId: string; auth: StaffAuth | null };
type InvalidReason = "verifying" | "job" | "stage" | "account" | null;

const sameAuth = (a: StaffAuth | null, b: StaffAuth | null) =>
  a === b || (a !== null && b !== null && a.uid === b.uid && a.role === b.role && a.tenantId === b.tenantId && a.studioId === b.studioId);

/** Mirrors the backend advanceJobStatus gate (roles studio/admin/superadmin,
 * tenant match, studio-scoped staff pinned to their studio). A signed-out
 * operator, a missing role, or a scope mismatch is NEVER a valid affirmation
 * context - including as the INITIAL context. The backend remains the
 * authority; this only decides what the pane may affirm locally. */
const affirmable = (a: StaffAuth | null, job: { tenantId: string; studioId: string }): a is StaffAuth =>
  a !== null &&
  (a.role === "studio" || a.role === "admin" || a.role === "superadmin") &&
  (a.role === "superadmin" || (a.tenantId !== null && a.tenantId === job.tenantId)) &&
  (a.role !== "studio" || (a.studioId !== null && a.studioId === job.studioId));

/** One string naming EVERYTHING a delivery affirmation is bound to: the job
 * scope from the job document (never the caller's claims) AND the verified
 * operator fingerprint (uid + role/tenant/studio claims). Compared
 * synchronously at render time, so a prop or auth change invalidates the
 * open declaration in the SAME render - no effect needs to flush first. */
const contextSig = (job: ServiceJob, auth: StaffAuth | null): string =>
  [job.id, job.vehicleId, job.tenantId, job.studioId, job.status,
   auth ? `${auth.uid}:${auth.role ?? "-"}:${auth.tenantId ?? "-"}:${auth.studioId ?? "-"}` : "signed-out"].join("|");

/** The READY_FOR_DELIVERY -> DELIVERED confirm pane: the staff protection-work
 * declaration plus the delivery submit. Integration rules baked in here:
 * - The context (job/car/tenant/studio from the JOB DOCUMENT, plus the
 *   signed-in operator's VERIFIED uid + role/tenant/studio claims) is FROZEN
 *   once auth is known. A late fetch, a live-job update, a token refresh with
 *   new claims or an account switch can never re-aim a declaration: the pane
 *   invalidates, in-flight work is ignored, and only an explicit reload
 *   re-aims it.
 * - Validity is a SYNCHRONOUS render-time comparison against the live
 *   signature (kept in a ref updated during render), so a completion that
 *   resolves after the context moved is dropped even if no effect has run
 *   yet. A dropped completion writes NO state - the invalidation path owns
 *   the reset - it only releases the in-flight lock so a reload can proceed.
 * - Records load once per open, with a visible loading state and an explicit
 *   Reload for re-review. Reload remounts the panel and is locked out while
 *   a submit is in flight.
 * - Confirm guards live in the HANDLER, not only on the button: a ref lock
 *   stops same-tick double presses, the payload is snapshotted before the
 *   call, the panel is uneditable while pending, and a failure stays open
 *   with the backend's honest message. No automatic retry, no lost-ack
 *   readback claim: the operator reloads and looks. */
export function DeliveryConfirmPane({ job, onDelivered, onCancel }: { job: ServiceJob; onDelivered: () => void; onCancel: () => void }) {
  const [auth, setAuth] = useState<StaffAuth | null | undefined>(undefined); // undefined = not verified yet
  const frozen = useRef<FrozenContext | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [protections, setProtections] = useState<Protection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [integrityError, setIntegrityError] = useState(false);
  const [payload, setPayload] = useState<ProtectionWorkEvent[] | null>(null);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [panelReset, setPanelReset] = useState(0);

  // Live signature, refreshed SYNCHRONOUSLY every render. Async completions
  // compare against this ref, never against a closure captured earlier.
  const authReady = auth !== undefined;
  const liveSig = authReady ? contextSig(job, auth ?? null) : null;
  const liveSigRef = useRef(liveSig);
  liveSigRef.current = liveSig;

  // Monotonic invalidation generation: bumped SYNCHRONOUSLY on EVERY signature
  // change, either direction. A signature round-trip (job A -> B -> A) bumps
  // it twice, so a completion started before the detour can never revive -
  // signature equality alone is not enough.
  const prevSigRef = useRef(liveSig);
  const invalidGen = useRef(0);
  if (prevSigRef.current !== liveSig) { prevSigRef.current = liveSig; invalidGen.current += 1; }

  // Token-epoch contract: ANY auth-listener event after the context froze -
  // including one that resolves back to the SAME verified identity - retires
  // the frozen affirmation. There is no implicit same-claims restoration:
  // the operator must explicitly reload/reaffirm under the new token epoch.
  const reaffirmNeeded = useRef(false);
  const prevAuthRef = useRef(auth);
  if (prevAuthRef.current !== auth) {
    if (frozen.current !== null) reaffirmNeeded.current = true;
    prevAuthRef.current = auth;
  }

  // Freeze the context on the first AFFIRMABLE render: verified sign-in,
  // delivery-capable role, tenant/studio scope matching THIS job. Signed-out
  // or wrong-scope operators never become a frozen valid context.
  if (frozen.current === null && authReady && affirmable(auth ?? null, job)) {
    frozen.current = { jobId: job.id, vehicleId: job.vehicleId, tenantId: job.tenantId, studioId: job.studioId, auth: auth ?? null };
  }

  const f = frozen.current;
  const invalid: InvalidReason =
    !authReady ? "verifying"
    : !affirmable(auth ?? null, job) ? "account"
    : reaffirmNeeded.current ? "account"
    : !f ? null
    : (job.id !== f.jobId || job.vehicleId !== f.vehicleId || job.tenantId !== f.tenantId || job.studioId !== f.studioId) ? "job"
    : !sameAuth(auth ?? null, f.auth) ? "account"
    : job.status !== "READY_FOR_DELIVERY" ? "stage"
    : null;
  const contextValid = invalid === null;

  const load = useCallback(async (ctx: FrozenContext) => {
    const gen = ++generation.current;
    const startSig = liveSigRef.current;
    const startGen = invalidGen.current; // synchronous invalidation must also void this load
    setLoading(true); setLoadError(false); setIntegrityError(false);
    const superseded = () => gen !== generation.current || liveSigRef.current !== startSig || invalidGen.current !== startGen;
    try {
      const records = await getCurrentProtections(ctx.vehicleId, ctx.tenantId);
      if (superseded()) return; // superseded, invalidated, or unmounted
      // Integrity: every record must belong to the car this pane is about.
      if (records.some((r) => r.vehicleId !== ctx.vehicleId)) { setIntegrityError(true); setProtections([]); return; }
      setProtections(records);
    } catch {
      if (superseded()) return;
      setLoadError(true); setProtections([]);
    } finally {
      if (!superseded()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // ONE ordered source: the listener itself. It emits `undefined`
    // (verifying) synchronously on every token event and resolves latest-only
    // - no independent seed can publish an identity while a newer token is
    // still being verified.
    const unsubAuth = onStaffAuthChanged(setAuth);
    return () => { mounted.current = false; generation.current += 1; unsubAuth(); };
  }, []);

  // Kick the first records load once auth is verified and the context frozen.
  useEffect(() => {
    if (frozen.current && loading && protections.length === 0 && !loadError && !integrityError) void load(frozen.current);
  }, [authReady, load]);

  // The live job or the operator context moved under the pane (route change,
  // listener update, token refresh with new claims, account switch): drop
  // what was loaded and any pending-attempt UI. The invalidation path owns
  // these resets - a stale async completion writes NOTHING.
  useEffect(() => {
    if (invalid !== null) {
      // Resets run on EVERY invalid state, including "verifying": a token
      // event that never resolves must not leave a stuck pending submit or a
      // retained draft - the reaffirm contract above owns re-aiming. The
      // loading flag is left alone while verifying: it belongs to the
      // initial-load lifecycle, and reload() re-arms it explicitly.
      generation.current += 1;
      if (invalid !== "verifying") setLoading(false);
      setLoadError(false); setIntegrityError(false); setProtections([]); setPayload(null);
      setPending(false); setSubmitError(null);
    }
  }, [invalid]);

  function reload() {
    if (inFlight.current || !authReady) return; // never re-aim while a commit is in flight or the account is unverified
    if (!affirmable(auth ?? null, job)) return; // signed-out / wrong-scope operators cannot re-aim a declaration
    reaffirmNeeded.current = false; // explicit reaffirm under the current token epoch
    frozen.current = { jobId: job.id, vehicleId: job.vehicleId, tenantId: job.tenantId, studioId: job.studioId, auth: auth ?? null };
    setPayload(null);
    setSubmitError(null);
    setPanelReset((k) => k + 1); // fresh panel: selections from before the reload do not survive
    void load(frozen.current);
  }

  async function confirm() {
    if (inFlight.current) return; // same-tick double press: the second press is ignored
    if (!contextValid || loading || loadError || integrityError || payload === null) return;
    inFlight.current = true;
    setPending(true); setSubmitError(null);
    const ctx = f as FrozenContext;
    const startSig = liveSigRef.current;
    const startGen = invalidGen.current;
    const frozenPayload = payload; // immutable snapshot: panel edits during the call cannot leak in
    // The attempt publishes ONLY if the context is still exactly the one that
    // started it: same render-time signature AND same invalidation generation
    // (a signature round-trip cannot revive it), judged synchronously - so a
    // route, stage or auth change invalidates even before any effect runs. A
    // dropped completion releases the lock but writes no state; the
    // invalidation effect owns the reset.
    const stillCurrent = () => mounted.current && liveSigRef.current === startSig && invalidGen.current === startGen;
    try {
      await advanceJobStatus(ctx.jobId, undefined, undefined, frozenPayload);
      if (!stillCurrent()) { inFlight.current = false; return; }
      onDelivered(); // the pane closes; the lock intentionally stays held
    } catch (err) {
      if (!stillCurrent()) { inFlight.current = false; return; }
      setSubmitError(err instanceof Error ? err.message : "Could not mark delivered. Reload the declaration and try again.");
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.textPrimary }}>Mark delivered? This updates the studio floor and customer tracker.</Text>
      {invalid === "verifying" ? (
        <Text style={{ ...typography.caption, color: colors.textMuted }}>Verifying the signed-in account...</Text>
      ) : invalid === "job" ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...typography.caption, color: colors.error }}>This job changed since the declaration was opened. Reload the declaration for the job now on screen before delivering.</Text>
          <Button label="Reload declaration" variant="secondary" fullWidth={false} disabled={pending} onPress={reload} />
        </View>
      ) : invalid === "account" ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...typography.caption, color: colors.error }}>The signed-in account or its permissions changed since this declaration was opened (or no delivery-permitted account is signed in for this studio) - the earlier affirmation belongs to another operator context. Reload the declaration under the current account.</Text>
          <Button label="Reload declaration" variant="secondary" fullWidth={false} disabled={pending} onPress={reload} />
        </View>
      ) : invalid === "stage" ? (
        <Text style={{ ...typography.caption, color: colors.error }}>This job is no longer awaiting delivery - it may already have been delivered. Go back and refresh the job.</Text>
      ) : loading ? (
        <Text style={{ ...typography.caption, color: colors.textMuted }}>Loading the car's protection records...</Text>
      ) : loadError ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...typography.caption, color: colors.error }}>Could not load the car's protection records. Reload and try again before delivering.</Text>
          <Button label="Reload records" variant="secondary" fullWidth={false} disabled={pending} onPress={reload} />
        </View>
      ) : integrityError ? (
        <Text accessibilityRole="alert" style={{ ...typography.caption, color: colors.error }}>The car's protection records failed an integrity check (a record does not belong to this car). Go back and reopen the job before delivering.</Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <DeliveryDeclarationPanel key={`${f?.jobId ?? "job"}-${panelReset}`} protections={protections} disabled={pending} onValidChange={setPayload} />
          <Button label="Reload records" variant="ghost" fullWidth={false} disabled={pending} onPress={reload} />
        </View>
      )}
      {submitError ? <Text accessibilityRole="alert" style={{ ...typography.caption, color: colors.error }}>{submitError}</Text> : null}
      <Button label="Confirm mark delivered" variant="secondary" disabled={!contextValid || loading || loadError || integrityError || payload === null || pending} loading={pending} onPress={() => void confirm()} />
      <Button label="Cancel" variant="ghost" disabled={pending} onPress={onCancel} />
    </View>
  );
}
