"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { useLabels } from "../../../lib/use-labels";
import { listenToTenantVehicles } from "../../../lib/customers-service";
import type { Vehicle, Protection, ProtectionStatus } from "@autodeck/core";
import { VehiclesView, KIND_LABEL, type ProtectionDraft, type CorrectionDraft } from "../../../experience/VehiclesView";
import { studioToday } from "../../../lib/format";
import { useAdminAuth } from "../../../lib/auth-context";
import {
  findVehicleByRegistration,
  getVehicleProtections,
  createProtection,
  updateProtection,
} from "../../../lib/protection-service";
import { getVehiclePapers } from "../../../lib/papers-service";
import type { PaperVerification } from "@autodeck/core";

export default function VehicleLookupPage() {
  const { user, claims, loading: authLoading } = useAdminAuth();
  // Every piece of loaded data is tagged with the authority that produced
  // it. Display derives through the tag: an authority change makes
  // already-loaded cars, papers, documents and fleet INVISIBLE synchronously
  // - a new click under the new authority can never act on old-authority
  // data.
  const [vehicleS, setVehicleS] = useState<{ gen: number; v: Vehicle | null } | null>(null);
  const [protectionsS, setProtectionsS] = useState<{ gen: number; rows: Protection[] }>({ gen: -1, rows: [] });
  const [documentsS, setDocumentsS] = useState<{ gen: number; rows: PaperVerification[] }>({ gen: -1, rows: [] });
  const [fleetS, setFleetS] = useState<{ gen: number; rows: Vehicle[] }>({ gen: -1, rows: [] });
  const [loading, setLoading] = useState(false);
  // Banners are generation-tagged too: an error/status produced under a
  // previous authority generation is never shown under the new one.
  const [errorS, setErrorS] = useState<{ gen: number; msg: string | null }>({ gen: -1, msg: null });
  const [statusS, setStatusS] = useState<{ gen: number; msg: string | null }>({ gen: -1, msg: null });
  const setError = (msg: string | null) => setErrorS({ gen: authGenRef.current, msg });
  const setStatus = (msg: string | null) => setStatusS({ gen: authGenRef.current, msg });
  const router = useRouter();
  // Ordered, current-only publication: every navigation/search bumps the
  // epoch and every async result publishes only while its epoch is still the
  // live one. A late result for car A can never land in car B's view, and an
  // unmounted page publishes nothing.
  const epochRef = useRef(0);
  // Setup sets true, cleanup retires the epoch AND drops mounted: a
  // StrictMode replay re-arms instead of staying permanently disabled.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    // mountedRef alone drops post-unmount deliveries. The selection epoch is
    // NOT bumped here: StrictMode's setup->cleanup->setup replay must re-arm
    // with the same epoch, and a real route change creates a fresh instance.
    return () => { mountedRef.current = false; };
  }, []);
  // Authority fingerprint of the session, mirrored synchronously: anything
  // captured under an old account (search results, refreshes, fleet events,
  // save acks) refuses to publish once the authority moved on.
  // The loading flag is part of the fingerprint: while auth is verifying,
  // nothing is affirmable - no arm, no handler, no publish from before the
  // verification survives it.
  const authFp = `${user?.uid ?? ""}|${claims?.tenantId ?? ""}|${claims?.studioId ?? ""}|${claims?.role ?? ""}|${authLoading ? "verifying" : "ready"}`;
  const authFpRef = useRef(authFp);
  // Monotonic authority generation: bumped on EVERY verification/account/
  // scope event and NEVER recycled. A ready->verifying->ready round trip (or
  // A/B/A accounts) mints a new generation, so data produced under the old
  // one stays dead - a fresh read is required before anything is shown or
  // armed again.
  const authGenRef = useRef(0);
  if (authFpRef.current !== authFp) { authFpRef.current = authFp; authGenRef.current += 1; epochRef.current += 1; }
  // Scope-derived display: only data tagged with the CURRENT generation shows.
  const gen = authGenRef.current;
  // Captured by VALUE at render so a retained callback keeps the selection
  // epoch it was created under (reading the ref inside the closure would be
  // a live read and could never refuse a stale selection).
  const selectionEpoch = epochRef.current;
  const error = errorS.gen === gen ? errorS.msg : null;
  const status = statusS.gen === gen ? statusS.msg : null;
  const vehicle = vehicleS && vehicleS.gen === gen ? vehicleS.v : null;
  const protections = protectionsS.gen === gen ? protectionsS.rows : [];
  const documents = documentsS.gen === gen ? documentsS.rows : [];
  const fleet = fleetS.gen === gen ? fleetS.rows : [];
  const vehicleRef = useRef(vehicle);
  vehicleRef.current = vehicle;
  useEffect(() => {
    if (!claims || authLoading) return undefined;
    const g = authGenRef.current;
    // Per-subscription lease: killed BEFORE unsubscribe so a late callback
    // from THIS subscription can never publish after re-setup (StrictMode
    // replay or account switch) - the generation alone stays unchanged
    // across a replay, so the lease flag is the load-bearing check there.
    let alive = true;
    const unsub = listenToTenantVehicles(claims.tenantId, (vs) => {
      if (alive && mountedRef.current && authGenRef.current === g) setFleetS({ gen: g, rows: vs });
    }, () => undefined);
    return () => { alive = false; unsub(); };
  }, [claims, authFp, authLoading, user]);
  const ownerNames = useLabels(COLLECTIONS.customers(), [...fleet.map((v) => v.ownerId), vehicle?.ownerId ?? ""], (d) => (d as Customer).name || (d as Customer).phone || "Customer");
  // Current-only publish: live epoch, same authority GENERATION, mounted.
  const publishable = (ep: number, g: number) => ep === epochRef.current && mountedRef.current && authGenRef.current === g;

  // Entry guard for any retained callback (fleet row pick, search submit):
  // validate the SOURCE generation captured when the callback was created
  // against the latest affirmable state - never mint a current-generation
  // origin for an old selection.
  function invocationAllowed(srcGen: number): boolean {
    return mountedRef.current && !authLoading && !!user && !!claims && srcGen === authGenRef.current;
  }

  async function pick(v: Vehicle, srcGen: number, srcEp: number) {
    if (!invocationAllowed(srcGen) || srcEp !== epochRef.current || v.tenantId !== claims!.tenantId) return;
    const ep = ++epochRef.current;
    const g = authGenRef.current;
    setError(null); setStatus(null); setVehicleS({ gen: g, v });
    // The read scope changes NOW: never show the previous car's papers under
    // this one while the load is in flight.
    setProtectionsS({ gen: g, rows: [] }); setDocumentsS({ gen: g, rows: [] });
    try { await refreshProtections(v.id, ep, g); } catch { if (publishable(ep, g)) setError("Couldn't load this car's papers."); }
  }

  async function refreshProtections(vehicleId: string, ep: number, g: number) {
    const [prots, docs] = await Promise.all([getVehicleProtections(claims!.tenantId, vehicleId), getVehiclePapers(claims!.tenantId, vehicleId)]);
    if (!publishable(ep, g)) return; // stale read or moved-on authority: drop it
    setProtectionsS({ gen: g, rows: prots });
    setDocumentsS({ gen: g, rows: docs });
  }

  async function handleSearch(plate: string, srcGen: number, srcEp: number) {
    if (!invocationAllowed(srcGen) || srcEp !== epochRef.current || !plate.trim()) return;
    const ep = ++epochRef.current;
    const g = authGenRef.current;
    setError(null);
    setStatus(null);
    setLoading(true);
    setProtectionsS({ gen: g, rows: [] });
    setDocumentsS({ gen: g, rows: [] });
    try {
      const found = await findVehicleByRegistration(claims!.tenantId, plate.trim());
      if (!publishable(ep, g)) return; // a newer search or authority owns the view
      setVehicleS({ gen: g, v: found });
      if (found) {
        await refreshProtections(found.id, ep, g);
      } else {
        setProtectionsS({ gen: g, rows: [] });
        setDocumentsS({ gen: g, rows: [] });
        setError(`No car with plate ${plate.trim()} is on file.`);
      }
    } catch {
      if (publishable(ep, g)) setError("Search failed. Check your connection and try again.");
    } finally {
      if (publishable(ep, g)) setLoading(false);
    }
  }

  async function handleAddProtection(form: ProtectionDraft) {
    if (!vehicle) return; // vehicle itself is generation-scoped state
    const ep = epochRef.current;
    const g = authGenRef.current;
    const vehicleId = vehicle.id;
    setError(null);
    setStatus(null);
    try {
      await createProtection({
        vehicleId,
        kind: form.kind,
        provider: form.provider || undefined,
        policyNumber: form.policyNumber || undefined,
        startDate: form.startDate || undefined,
        expiryDate: form.expiryDate || undefined,
        notes: form.notes || undefined,
      });
      if (!publishable(ep, g)) return; // saved, but the view moved on - no ghost confirmation
      setStatus(`${KIND_LABEL[form.kind]} saved.`);
      await refreshProtections(vehicleId, ep, g);
    } catch {
      if (publishable(ep, g)) setError("Couldn't save that. Try again.");
    }
  }

  // Shared staleness binding for every correction path: a REAL revision
  // (0 included) goes as expectedRevision; a legacy record with NO revision
  // field elects base 0 AND names the exact reviewed record by its updatedAt
  // string fingerprint, so a concurrent unversioned change fails closed.
  function revisionBinding(p: Protection) {
    const legacyMissing = p.revision === undefined || p.revision === null;
    return {
      expectedRevision: legacyMissing ? 0 : (p.revision as number),
      legacyBaseUpdatedAt: legacyMissing && typeof p.updatedAt === "string" ? p.updatedAt : undefined,
    };
  }

  // The correction targets the FROZEN viewed car and record handed up by the
  // form - never ambient state - so an A->B->A navigation can never retarget
  // it onto a different car's record.
  // Invocation identity the view captured when the form was ARMED: the full
  // target fingerprint (car id|tenant|owner) + session authority + selection
  // generation. A retained callback can only pass if everything still matches
  // the LATEST affirmable state - not the current fingerprint read as new
  // authorization.
  function expectedInvocationFp(v: Vehicle | null) {
    return v ? `${v.id}|${v.tenantId}|${v.ownerId}|${authFpRef.current}#${authGenRef.current}|${epochRef.current}` : "";
  }

  async function handleCorrection(target: Vehicle, prot: Protection, form: CorrectionDraft, armedFp: string) {
    // Boundary guard: a retained/stale invocation must no-op. Auth must be
    // affirmable NOW (not verifying), the frozen target must FULLY equal the
    // live viewed car (id, tenant AND owner), the record must belong to that
    // car and its declaring customer must be the car's current owner, and the
    // captured arm fingerprint must equal the current invocation identity.
    if (!claims || !user || authLoading || !mountedRef.current) return;
    const live = vehicleRef.current;
    if (!live || live.id !== target.id || live.tenantId !== target.tenantId || live.ownerId !== target.ownerId) return;
    if (prot.vehicleId !== target.id || prot.tenantId !== claims.tenantId || prot.customerId !== live.ownerId) return;
    if (!armedFp || armedFp !== expectedInvocationFp(live)) return;
    const ep = epochRef.current;
    const g = authGenRef.current;
    setError(null);
    setStatus(null);
    try {
      await updateProtection({
        vehicleId: target.id, protectionId: prot.id,
        ...revisionBinding(prot),
        provider: form.provider,
        policyNumber: form.policyNumber,
        startDate: form.startDate,
        expiryDate: form.expiryDate,
        notes: form.notes,
        warrantyYears: form.warrantyYears,
        coverage: form.coverage,
      });
      if (!publishable(ep, g)) return;
      setStatus("Correction saved.");
      await refreshProtections(target.id, ep, g);
    } catch {
      // failed-precondition covers several distinct truths (the record moved,
      // the car was archived or changed hands, the legacy fingerprint didn't
      // match) and the refresh itself can fail - say what we know, no more.
      if (!publishable(ep, g)) return;
      await refreshProtections(target.id, ep, g).catch(() => undefined);
      if (publishable(ep, g)) setError("Couldn't save that correction. Refresh the car's papers, review the record, and try again.");
    }
  }

  // Shared staleness binding for every correction path: a REAL revision
  // (0 included) goes as expectedRevision; a legacy record with NO revision
  // field elects base 0 AND names the exact reviewed record by its updatedAt
  // string fingerprint, so a concurrent unversioned change fails closed.
  async function handleStatusChange(target: Vehicle, p: Protection, nextStatus: ProtectionStatus, capturedFp: string) {
    if (!claims || !user || authLoading || !mountedRef.current) return;
    const live = vehicleRef.current;
    if (!live || live.id !== target.id || live.tenantId !== target.tenantId || live.ownerId !== target.ownerId) return;
    if (p.vehicleId !== target.id || p.tenantId !== claims.tenantId || p.customerId !== live.ownerId) return;
    if (!capturedFp || capturedFp !== expectedInvocationFp(live)) return;
    const ep = epochRef.current;
    const g = authGenRef.current;
    setError(null);
    try {
      await updateProtection({
        vehicleId: target.id, protectionId: p.id,
        ...revisionBinding(p),
        status: nextStatus,
      });
      if (!publishable(ep, g)) return;
      await refreshProtections(target.id, ep, g);
    } catch {
      if (publishable(ep, g)) setError("Couldn't update that record.");
    }
  }

  return (
    <VehiclesView
      today={studioToday()}
      searching={loading}
      fleet={fleet}
      ownerNames={ownerNames}
      onPick={(v) => void pick(v, gen, selectionEpoch)}
      onOpenOwner={(id) => router.push(`/customers/${id}`)}
      vehicle={vehicle}
      protections={protections}
      documents={documents}
      error={error}
      message={status}
      onSearch={(plate) => void handleSearch(plate, gen, selectionEpoch)}
      onAdd={(draft) => void handleAddProtection(draft)}
      authorityKey={`${authFp}#${gen}`}
      selectionKey={String(epochRef.current)}
      onStatus={(v, prot, next, fp) => void handleStatusChange(v, prot, next, fp)}
      onCorrect={(v, prot, draft, fp) => void handleCorrection(v, prot, draft, fp)}
    />
  );
}
