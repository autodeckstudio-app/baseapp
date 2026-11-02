import { VISIT_FALLBACK, visitAlso, visitServices, visitTitle } from "../../../lib/visit-services";
import { lastFinishedJob } from "../../../lib/care-due";
import { buildCarePlan } from "../../../lib/care-plan";
import { glassSurface, glassInner, glassOrange } from "../../../lib/glass";
import { FileUploader, DateField, SelectField } from "../../../ui/inputs"; // DateField: calendar-valid date choice, no free-text dates // DateField: calendar-valid date choice, no free-text dates
import { VEHICLE_SIZES } from "../../../lib/vehicle-size";
import { validateDocument, documentReference } from "../../../lib/document-validation";
import { useState, useEffect, useRef, createElement } from "react";
import { Alert, Image, Linking, Platform, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import { doc, getDocFromServer, onSnapshot } from "firebase/firestore"; // getDocFromServer: protection save read-back
import type { VehicleCategory, Invoice, Vehicle, ServiceJob, Protection, Warranty, Booking } from "@autodeck/core";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import { FIRST_STUDIO_ID, segmentLabel } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Chip, Field, Kicker, LinkAction, Loading, Notice, Pane, Plate, Row, Screen, T } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { updateVehicle, archiveVehicle, uploadVehiclePhoto, uploadVehicleRc, removeVehicleImage } from "../../../lib/vehicle-service";
import { metrics } from "../../../lib/metrics";
import { CarHero } from "../../../ui/CarHero";
import { CarThumb } from "../../../ui/CarThumb";
import { listenToJobsForVehicle } from "../../../lib/job-service";
import { isCalendarDate, listenToVehicleProtections, updateMyProtection } from "../../../lib/protection-service";
import { reconcileProtectionReadback, upsertProtection } from "../../../lib/protection-readback";
import { ProtectionSaveFlow } from "../../../lib/protection-save-flow";
import { PROTECTION_KIND_LABELS, protectionChip, protectionChipFor,
  protectionRecordTitle, protectionDetail, isCustomerEditable, isCurrentProtection, protectionLifecycleLabel, sortProtectionHistory } from "../../../lib/protection-display";
import { listenToVehicleWarranties } from "../../../lib/warranty-service";
import { listenToVehiclePapers, listenToCustomerPapers, submitMyPaper, updateMyPaper, deleteMyPaper, daysUntil, resolvePaperEvidenceUrl, type MyPaper, type PaperPhotoPayload } from "../../../lib/paper-service";
import { PAPER_EDIT_ENABLED, VEHICLE_IMAGE_REMOVE_ENABLED } from "../../../lib/backend-features";
import { paperName, numberClash } from "../../../lib/documents";
import { limitRegistrationInput, REG_RAW_MAX } from "../../../lib/registration-input";
import { IconAction } from "../../../ui/IconAction";
import { invoiceHref } from "../../../lib/invoice-display";
import { listenToInvoicesForVehicle } from "../../../lib/invoice-service";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { getMyBookings } from "../../../lib/booking-service";
import { useAuth } from "../../../hooks/useAuth";
import { CarOverview } from "../../../ui/CarOverview";
import { CareTimeline } from "../../../ui/CareTimeline";
import { HistoryVisitRow } from "../../../ui/HistoryVisitRow";
import { buildUpcoming, buildHistory, countLabel, latestVisits, HISTORY_PREVIEW } from "../../../lib/car-timeline";

/** Customer Garage warranty certificates section: hidden per the 2 Nov basket; data/backend unchanged. */
const SHOW_CUSTOMER_WARRANTY_SECTION = false;


function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auth = useAuth();

  const [feedError,setFeedError] = useState<string|null>(null);
  const [retryTick,setRetryTick] = useState(0);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newRc, setNewRc] = useState<{ blob: Blob; contentType: string } | null>(null);
  const [newPhoto, setNewPhoto] = useState<{ blob: Blob; contentType: string; previewUrl: string } | null>(null);
  useEffect(()=>()=>{if(newPhoto?.previewUrl)URL.revokeObjectURL(newPhoto.previewUrl);},[newPhoto]);
  const [form, setForm] = useState<{ make: string; model: string; color: string; odometer: string; category: VehicleCategory | "" }>({ make: "", model: "", color: "", odometer: "", category: "" });
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [serviceCats, setServiceCats] = useState<Record<string, string>>({});
  const [protections, setProtections] = useState<Protection[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [papers, setPapers] = useState<MyPaper[]>([]);
  const [docForm, setDocForm] = useState({ kind: "INSURANCE" as MyPaper["kind"], reference: "", title: "", expiresOn: "" });
  // One operation id per add-document form session: kept across failed saves so a retry is
  // provably the same submission (the server replays it), regenerated on close/success.
  const [docSubmissionId, setDocSubmissionId] = useState(() => Crypto.randomUUID());
  // Self-reported PPF/ceramic ADD UI removed (Gauri 2 Nov 15:48 confirmed basket, item 11;
  // Meet 16:25 "Accept gauris changes"). Existing reported records stay editable; saved
  // records, backend rules and Staff/Admin surfaces are unchanged. The editor is edit-only.
  const [protEdit, setProtEdit] = useState<null | { mode: "edit"; protection: Protection; ctx: string }>(null);
  // Generation guard for the protection save + read-back: a response from an
  // older attempt, a closed editor or a different car must never publish
  // over the current target. Bumped on every save attempt and editor change.
  const protSaveSeq = useRef(0);
  // The protection save orchestration: every publication (busy, error,
  // editor close, list change) is validity-gated by the flow, so a late
  // response from an older attempt, a closed editor, a different car, an
  // auth change or an unmounted screen can never publish. Invalidated on
  // editor open/cancel and route/auth change; disposed on unmount.
  const protFlow = useRef<ProtectionSaveFlow | null>(null);
  if (protFlow.current === null) {
    protFlow.current = new ProtectionSaveFlow((e) => {
      if (e.type === "busy") setProtBusy(e.value);
      else if (e.type === "closeEditor") setProtEdit(null);
      else if (e.type === "error") setActionError(e.message);
      else if (e.type === "upsert") setProtections((prev) => upsertProtection(prev, e.targetId, e.protection));
      else if (e.type === "remove") setProtections((prev) => prev.filter((x) => x.id !== e.targetId));
    });
  }
  // Editor context is bound to car + identity: a route change OR a
  // ready-to-ready account change (uid/tenant) invalidates in-flight work
  // and closes the editor, which belongs to the previous context. This runs
  // SYNCHRONOUSLY during render (the adjust-state-during-render pattern):
  // a passive effect would leave a window where an old attempt publishes or
  // an old editor saves into the new context.

  // Unmount: nothing may publish ever again. revive() pairs with dispose()
  // so StrictMode's probe cleanup does not leave the flow permanently dead.
  useEffect(() => {
    protFlow.current?.revive();
    return () => protFlow.current?.dispose();
  }, []);
  const [protForm, setProtForm] = useState({ brand: "", years: "", applied: "", notes: "" });
  const [protBusy, setProtBusy] = useState(false);
  const authKey = auth.status === "ready" ? `${auth.user.uid}:${auth.claims.tenantId}` : auth.status;
  const contextKey = `${id}:${authKey}`;
  const ctxRef = useRef(contextKey);
  if (ctxRef.current !== contextKey) {
    ctxRef.current = contextKey;
    protFlow.current?.invalidate();
    if (protEdit !== null) setProtEdit(null);
    if (protBusy) setProtBusy(false);
  }
  const [allPapers, setAllPapers] = useState<MyPaper[]>([]);
  const [docEditing, setDocEditing] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState<"cover" | "rc" | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [numberError, setNumberError] = useState<string | null>(null);
  const [docPhoto, setDocPhoto] = useState<PaperPhotoPayload | null>(null);
  const [currentDocImageUrl, setCurrentDocImageUrl] = useState<string | null>(null);
  const [removeDocPhoto, setRemoveDocPhoto] = useState(false);
  const [confirmRemoveDocPhoto, setConfirmRemoveDocPhoto] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docNotice, setDocNotice] = useState<string | null>(null); // post-save note shown outside the form
  const [upcomingBooking, setUpcomingBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!id) {setLoading(false);return;}
    setFeedError(null);
    const ref = doc(db, COLLECTIONS.vehicles(), id);
    setVehicle(null); setLoading(true);
    const unsubscribe = onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
      if (snap.metadata.fromCache) return;
      if (snap.exists()) {
        const v = snap.data() as Vehicle;
        setVehicle(v);
        setForm({
          make: v.make,
          model: v.model,
          color: v.color,
          odometer: v.odometer?.toString() ?? "",
          category: (v.category ?? "") as VehicleCategory | "",
        });
      }
      setLoading(false);
    },()=>{setFeedError("Could not load this car. Check your connection and try again.");setLoading(false);});
    return unsubscribe;
  }, [id,retryTick]);

  // Invoices live in service history: one listener per car, matched to jobs by jobId.
  useEffect(() => {
    if (!id || auth.status !== "ready") return undefined;
    return listenToInvoicesForVehicle(id, auth.claims.tenantId, auth.user.uid, setInvoices, () => undefined);
  }, [id, auth.status, retryTick]);

  useEffect(() => {
    if (!id || auth.status !== "ready") return undefined;
    return listenToJobsForVehicle(id, auth.claims.tenantId, auth.user.uid, setJobs, ()=>setFeedError("Could not load some car records. Check your connection and retry."));
  }, [id, auth.status,retryTick]);

  useEffect(() => {
    if (!id || auth.status !== "ready") return undefined;
    return listenToVehicleProtections(id, auth.claims.tenantId, auth.user.uid, setProtections, ()=>setFeedError("Could not load some car records. Check your connection and retry."));
  }, [id, auth.status,retryTick]);

  useEffect(() => {
    if (!id || auth.status !== "ready") return undefined;
    return listenToVehiclePapers(id, auth.claims.tenantId, auth.user.uid, setPapers, ()=>setFeedError("Could not load some car records. Check your connection and retry."));
  }, [id, auth.status,retryTick]);

  useEffect(() => {
    if (auth.status !== "ready") return undefined;
    return listenToCustomerPapers(auth.claims.tenantId, auth.user.uid, setAllPapers, () => undefined);
  }, [auth.status, retryTick]);

  function resetDocForm() {
    setDocForm({ kind: "INSURANCE", reference: "", title: "", expiresOn: "" });
    setDocPhoto(null); setDocOpen(false); setDocEditing(null); setDocError(null); setNumberError(null); setCurrentDocImageUrl(null); setRemoveDocPhoto(false); setConfirmRemoveDocPhoto(false);
  }
  function openDocEdit(p: MyPaper) {
    setDocForm({ kind: p.kind, reference: p.reference, title: p.title ?? "", expiresOn: p.expiresOn ?? "" });
    setDocPhoto(null); setDocEditing(p.id); setDocError(null); setNumberError(null); setDocOpen(true); setDeleteId(null);
    setCurrentDocImageUrl(null); setRemoveDocPhoto(false); setConfirmRemoveDocPhoto(false);
    // Resolve the saved photo so the edit form can show it with Remove/Replace controls.
    if (p.evidenceUrl || p.evidencePath) {
      void resolvePaperEvidenceUrl(p).then((r) => setCurrentDocImageUrl(r.url ?? null)).catch(() => setCurrentDocImageUrl(null));
    }
  }
  async function openDocPhoto(p: MyPaper) {
    setActionError(null);
    const show = (msg: string) => { if (Platform.OS === "web") setActionError(`${paperName(p)}: ${msg}`); else Alert.alert(paperName(p), msg); };
    try {
      const r = await resolvePaperEvidenceUrl(p);
      if (!r.url) {
        show(r.failure === "permission"
          ? "You don't have access to this document photo. Sign in again, then try."
          : "The photo could not be opened - check your connection, then try again.");
        return;
      }
      await Linking.openURL(r.url);
    } catch {
      show("The photo could not be opened - check your connection, then try again.");
    }
  }
  function pickDocKind(k: MyPaper["kind"]) {
    // One active RC per car: choosing RC when the car already has one edits that RC.
    // The edit path needs updateMyPaper, so while document editing is not released we
    // refuse the second RC instead of opening a form whose save would fail.
    const existingRc = k === "RC" ? papers.find((p) => p.kind === "RC") : undefined;
    if (existingRc) {
      if (PAPER_EDIT_ENABLED) { openDocEdit(existingRc); return; }
      setDocError("This car already has an RC on file. Editing documents is not available yet.");
      return;
    }
    setDocEditing(null); setNumberError(null);
    setDocForm((f) => ({ ...f, kind: k }));
  }
  function changeDocReference(v: string) {
    const value = docForm.kind === "RC" ? limitRegistrationInput(v) : v;
    setDocForm((f) => ({ ...f, reference: value }));
    setNumberError(numberClash(allPapers, documentReference(docForm.kind, value), docEditing, docEditing ? null : docSubmissionId));
  }
  async function handleSaveDoc() {
    if (!id) return;
    setDocError(null);
    const validationError=validateDocument(docForm.kind,docForm.reference,docForm.expiresOn);
    if(validationError){setDocError(validationError);return;}
    if (docForm.kind === "OTHER" && !docForm.title.trim()) { setDocError("Give this document a name."); return; }
    const clash = numberClash(allPapers, documentReference(docForm.kind, docForm.reference), docEditing, docEditing ? null : docSubmissionId);
    if (clash) { setNumberError(clash); return; }
    setDocBusy(true);
    try {
      if (docEditing) {
        await updateMyPaper({
          paperId: docEditing,
          reference: documentReference(docForm.kind, docForm.reference),
          ...(docForm.kind === "OTHER" ? { title: docForm.title.trim() } : {}),
          expiresOn: docForm.expiresOn ? docForm.expiresOn : null,
          photo: docPhoto,
          ...(removeDocPhoto && !docPhoto ? { removePhoto: true } : {}),
        });
      } else {
        const outcome = await submitMyPaper({
          studioId: FIRST_STUDIO_ID,
          vehicleId: id,
          kind: docForm.kind,
          reference: documentReference(docForm.kind,docForm.reference),
          ...(docForm.kind === "OTHER" ? { title: docForm.title.trim() } : {}),
          ...(docForm.expiresOn ? { expiresOn: docForm.expiresOn } : {}),
          photo: docPhoto,
          submissionId: docSubmissionId,
        });
        // A replayed save means the ORIGINAL attempt already went through. If the owner had
        // picked a new photo on this retry, it was NOT uploaded - say so explicitly instead
        // of silently discarding it. The saved record stays authoritative; the form closes.
        // The record may also have been EDITED since (a staged replacement is the current
        // evidence) - the copy must not claim the original photo is still the one on file.
        if (outcome.replayed && docPhoto && !outcome.photoUploaded) {
          resetDocForm();
          setDocNotice("Your earlier save went through. The photo you just picked was not uploaded. Check the saved document under Documents.");
          return;
        }
      }
      resetDocForm();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setDocError(/already saved/i.test(msg) ? "This number is already saved on one of your documents." : msg || "Could not save the document.");
    } finally {
      setDocBusy(false);
    }
  }
  async function handleDeleteDoc(paperId: string) {
    setDocBusy(true); setDocError(null);
    try { await deleteMyPaper(paperId); setDeleteId(null); }
    catch { setDocError("Could not delete that document. Try again."); }
    finally { setDocBusy(false); }
  }

  useEffect(() => {
    if (!id || auth.status !== "ready") return undefined;
    return listenToVehicleWarranties(id, auth.claims.tenantId, auth.user.uid, setWarranties, ()=>setFeedError("Could not load some car records. Check your connection and retry."));
  }, [id, auth.status,retryTick]);

  useEffect(() => {
    void getServiceCatalogue()
      .then((services) => {
        const map: Record<string, string> = {};
        const cats: Record<string, string> = {};
        for (const s of services) { map[s.id] = s.name; cats[s.id] = s.category; }
        setServiceNames(map);
        setServiceCats(cats);
      })
      .catch(()=>setFeedError("Could not load some car records. Check your connection and retry."));
  }, [retryTick]);

  useEffect(() => {
    if (!id || auth.status !== "ready") return;
    void getMyBookings(auth.user.uid, auth.claims.tenantId)
      .then((bookings) => {
        const upcoming = bookings
          .filter((b) => b.vehicleId === id && (b.status === "PENDING" || b.status === "CONFIRMED" || b.status === "ACTIVE"))
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
        setUpcomingBooking(upcoming[0] ?? null);
      })
      .catch(()=>setFeedError("Could not load some car records. Check your connection and retry."));
  }, [id, auth.status,retryTick]);

  const [typePick, setTypePick] = useState<VehicleCategory | "">("");
  const [typeSaving, setTypeSaving] = useState(false);
  async function saveType() {
    if (!id || !typePick) return;
    setTypeSaving(true);
    setActionError(null);
    try { await updateVehicle({ vehicleId: id, category: typePick }); }
    catch (e) { setActionError(e instanceof Error ? e.message : "The car type could not be saved. Try again."); }
    finally { setTypeSaving(false); }
  }

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setActionError(null);
    try {
      const odometerNum = form.odometer ? parseInt(form.odometer, 10) : null;
      await updateVehicle({
        vehicleId: id,
        ...(form.make.trim() ? { make: form.make.trim() } : {}),
        ...(form.model.trim() ? { model: form.model.trim() } : {}),
        ...(form.color.trim() ? { color: form.color.trim() } : {}),
        ...(odometerNum !== null ? { odometer: odometerNum } : {}),
        ...(form.category && form.category !== vehicle?.category ? { category: form.category } : {}),
      });
      if (newPhoto) {
        try {
          await uploadVehiclePhoto(id, newPhoto.blob, newPhoto.contentType);
        } catch (e) {
          setActionError(e instanceof Error ? e.message : "The photo could not be uploaded. Your other changes are saved.");
          setNewPhoto(null);
          return;
        }
        setNewPhoto(null);
      }
      if (newRc) {
        try {
          await uploadVehicleRc(id, newRc.blob, newRc.contentType);
        } catch (e) {
          setActionError(e instanceof Error ? e.message : "The RC photo could not be uploaded. Your other changes are saved.");
          setNewRc(null);
          return;
        }
        setNewRc(null);
      }
      setEditing(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveConfirmed() {
    if (!id) return;
    setActionError(null);
    try {
      await archiveVehicle(id);
      router.back();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove.");
    }
  }

  if (feedError) return <Screen><Notice title="Car records unavailable" body={feedError} action={<Button label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>} /></Screen>;
  if (loading) return <Loading label="Opening the room" />;
  if (!vehicle) return <Screen><Notice title="Vehicle not found" body="It may have been removed from your garage. Its service history and invoices are still kept." action={<Button label="View service history" onPress={() => router.push({ pathname: "/(tabs)/garage/history", params: { vehicleId: id } })} />} /></Screen>;

  // Current vs history: superseded/removed records are kept as history
  // (never deleted) but are excluded from every current-state display, the
  // add-another gate, and editing - a removed kind can be reported again.
  const currentProtections = protections.filter(isCurrentProtection);
  const historyProtections = sortProtectionHistory(protections.filter((p) => !isCurrentProtection(p)));
  const verifiedProtections = currentProtections.filter((p) => p.status === "verified");
  // Self-declared cosmetic protection: offer Add only for a kind with no
  // CURRENT record yet. Mock preview hides these (no backend behind the buttons).
  const reportedProtections = currentProtections.filter((p) => p.source === "customer");
  const documentProtections = currentProtections.filter((p) => p.source !== "customer");
  function openProtectionEdit(pr: Protection) {
    setProtForm({
      brand: pr.provider ?? "",
      years: pr.warrantyYears ? String(pr.warrantyYears) : "",
      applied: pr.startDate ?? "",
      notes: pr.notes ?? "",
    });
    protFlow.current?.invalidate();
    setProtBusy(false);
    setProtEdit({ mode: "edit", protection: pr, ctx: contextKey });
  }

  async function saveProtectionForm() {
    if (!protEdit || protBusy || !vehicle || auth.status !== "ready") return;
    // The editor belongs to the car + identity it was opened under; a save
    // from a stale editor (context changed before render-time invalidation
    // ran) never reaches the network.
    if (protEdit.ctx !== contextKey) return;
    // The editor belongs to the car + identity it was opened under; a save
    // from a stale editor (context changed before render-time invalidation
    // ran) never reaches the network.
    if (protEdit.ctx !== contextKey) return;
    const years = protForm.years.trim();
    const applied = protForm.applied.trim();
    if (years !== "" && (!/^\d+$/.test(years) || Number(years) < 1 || Number(years) > 50)) {
      setActionError("Warranty years must be a whole number between 1 and 50, or left empty.");
      return;
    }
    if (applied !== "" && !isCalendarDate(applied)) {
      setActionError("Dates must be a real calendar date in YYYY-MM-DD, or left empty.");
      return;
    }
    setActionError(null);
    const editTarget = protEdit.protection;
    const vid = vehicle.id;
    const uid = auth.user.uid;
    const tenantId = auth.claims.tenantId;
    await protFlow.current?.run({
      mode: "edit",
      target: editTarget,
      vehicleId: vid,
      uid,
      tenantId,
      fetch: async () => {
        // Bound to THIS attempt's captured car and target: a late read-back
        // can never read a different car's path after a route change.
        const snap = await getDocFromServer(doc(db, SUBCOLLECTIONS.vehicleProtections(vid), editTarget!.id));
        return { exists: snap.exists(), data: snap.data() as Record<string, unknown> | undefined, snapId: snap.id };
      },
      // Read live at every gate: between a context-changing render and any
      // effect, this blocks an old attempt from publishing into the new car
      // or account.
      contextCurrent: () => ctxRef.current === contextKey,
      save: async () => {
        {
          await updateMyProtection({
            vehicleId: vid,
            protectionId: editTarget.id,
            expectedRevision: editTarget.revision ?? null,
            ...((editTarget.revision === null || editTarget.revision === undefined) ? { legacyBaseUpdatedAt: editTarget.updatedAt } : {}),
            provider: protForm.brand.trim() === "" ? null : protForm.brand.trim(),
            warrantyYears: years === "" ? null : Number(years),
            startDate: applied === "" ? null : applied,
            notes: protForm.notes.trim() === "" ? null : protForm.notes.trim(),
          });
        }
      },
    });
  }
  const activeWarranties = warranties.filter((w) => w.revokedAt === null);
  const mostRecentJob = lastFinishedJob(jobs);
  // Document and warranty expiry now live in the single Documents list; only the service nudge stays here.
  const reminders: string[] = [];
  if (mostRecentJob && upcomingBooking === null) {
    const since = Math.floor((Date.now() - new Date(mostRecentJob.sealedAt ?? mostRecentJob.createdAt).getTime()) / 86400000);
    if (since >= 45) reminders.push(`Last service was ${since} days ago. Time for a wash or check-up.`);
  }

  const due = null;

  return (
    <Screen
      header={
        <View style={{ gap: space.breath }}>
          <CarHero
            photo={newPhoto ? createElement("img", { src: newPhoto.previewUrl, alt: "New car photo", style: { width: "100%", height: metrics.heroTall, objectFit: "cover", display: "block" } }) : <CarThumb car={vehicle} height={vehicle.photoUrl ? metrics.heroTall : metrics.heroCompact} radius={0} />}
            title={`${vehicle.make} ${vehicle.model}`}
            plate={vehicle.registrationNumber}
            facts={[
              { label: "Year", value: String(vehicle.year ?? "-") },
              { label: "Colour", value: vehicle.color ? vehicle.color.charAt(0).toUpperCase() + vehicle.color.slice(1) : "-" },
              ...(vehicle.category ? [{ label: "Type", value: segmentLabel(vehicle.category) ?? "" }] : []),
              ...(vehicle.odometer !== null && vehicle.odometer !== undefined ? [{ label: "Odometer", value: `${vehicle.odometer.toLocaleString("en-IN")} km` }] : []),
              ...(verifiedProtections.length > 0 ? [{ label: "Protection", value: `${verifiedProtections.length} on file` }] : []),
            ]}
            compact={!vehicle.photoUrl && !newPhoto}
            next={upcomingBooking ? { title: `${formatDate(upcomingBooking.scheduledDate)} at ${upcomingBooking.scheduledTime}`, detail: upcomingBooking.membershipDiscountApplied ? "Membership benefit applies" : "Upcoming booking" } : null}
            onNext={upcomingBooking ? () => router.push(`/(tabs)/bookings/${upcomingBooking.id}`) : undefined}
            onBook={() => router.push("/(tabs)/catalogue")}
          />
        </View>
      }
    >
      {!vehicle.category ? (
        <Pane pad="inset">
          <View style={{ gap: space.line }}>
            <Kicker>Add car type</Kicker>
            <T role="caption" tone="secondary">Saved once with this car. Prices and booking use it from now on.</T>
            <SelectField label="Car type" value={typePick} placeholder="Choose type" options={VEHICLE_SIZES} onChange={(v) => setTypePick(v as VehicleCategory)} />
            <Button label="Save car type" busy={typeSaving} disabled={!typePick} onPress={() => void saveType()} />
          </View>
        </Pane>
      ) : null}
      {true ? (
        <>
          <CarOverview
            due={due}
            last={mostRecentJob ? { title: visitTitle(visitServices(mostRecentJob, invoices.find((x) => x.jobId === mostRecentJob.id), serviceNames)), detail: formatDate(mostRecentJob.sealedAt ?? mostRecentJob.createdAt), status: mostRecentJob.status.replace(/_/g, " ") } : null}
            reminders={reminders}
          />

          {vehicle && editing ? (
            <View style={{ borderRadius: 16, overflow: "hidden" }}>
              {newPhoto ? (
                createElement("img", { src: newPhoto.previewUrl, alt: "New car photo", style: { width: "100%", height: 200, objectFit: "cover", display: "block" } })
              ) : (
                <CarThumb car={vehicle} height={200} radius={0} />
              )}
            </View>
          ) : null}

          {editing ? (
            <View style={{ gap: space.line }}>
              {Platform.OS === "web" ? (
                <View style={{ gap: space.hair }}>
                  <Kicker>Car photo</Kicker>
                  <FileUploader label={vehicle.photoUrl ? "Replace car photo" : "Add car photo"} files={newPhoto?[{blob:newPhoto.blob,type:newPhoto.contentType}]:[]} onChange={fs=>{const f=fs[0];setNewPhoto(f?{blob:f.blob,contentType:f.type,previewUrl:URL.createObjectURL(f.blob)}:null);}}/>

                  {VEHICLE_IMAGE_REMOVE_ENABLED && vehicle.photoUrl && !newPhoto ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><IconAction kind="delete" label="Remove car photo" onPress={() => setRemoveImage("cover")} /><T role="caption" tone="tertiary">Remove the saved car photo</T></View> : null}
                  <T role="caption" tone="tertiary">{newPhoto ? "New photo ready. It uploads when you save." : "Choose a JPEG, PNG or WebP to replace the photo."}</T>
                </View>
              ) : null}
              {Platform.OS === "web" ? (
                <View style={{ gap: space.hair }}>
                  <Kicker>RC photo</Kicker>
                  <FileUploader label={vehicle.rcPhotoUrl ? "Replace RC photo" : "Add RC photo"} files={newRc ? [{ blob: newRc.blob, type: newRc.contentType }] : []} onChange={(fs) => { const f = fs[0]; setNewRc(f ? { blob: f.blob, contentType: f.type } : null); }} />
                  {VEHICLE_IMAGE_REMOVE_ENABLED && vehicle.rcPhotoUrl && !newRc ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><IconAction kind="delete" label="Remove RC photo" onPress={() => setRemoveImage("rc")} /><T role="caption" tone="tertiary">Remove the saved RC photo</T></View> : null}
                  <T role="caption" tone="tertiary">{newRc ? "RC photo ready. It uploads when you save." : vehicle.rcPhotoUrl ? "An RC photo is on file. Choose a JPEG, PNG or WebP to replace it." : "Add a clear photo of the registration certificate (JPEG, PNG or WebP)."}</T>
                </View>
              ) : null}
              <Field label="Make" value={form.make} onChangeText={(v) => setForm((p) => ({ ...p, make: v }))} autoCapitalize="words" />
              <Field label="Model" value={form.model} onChangeText={(v) => setForm((p) => ({ ...p, model: v }))} autoCapitalize="words" />
              <Field label="Colour" value={form.color} onChangeText={(v) => setForm((p) => ({ ...p, color: v }))} autoCapitalize="words" />
              <SelectField label="Car type" value={form.category} placeholder="Choose type" options={VEHICLE_SIZES} onChange={(v) => setForm((p) => ({ ...p, category: v as VehicleCategory }))} />
              <Field label="Odometer (km)" value={form.odometer} onChangeText={(v) => setForm((p) => ({ ...p, odometer: v }))} keyboardType="numeric" />
              <View style={{ gap: space.breath }}>
                <Button label="Save changes" busy={saving} onPress={() => void handleSave()} />
                <Button label="Cancel" kind="quiet" onPress={() => { setNewPhoto(null); setNewRc(null); setEditing(false); }} />
              </View>
            </View>
          ) : null}

          {removeImage ? (
            <Notice title="Remove this image?" body="Only the image is removed. Your car, its documents and bookings are not affected." action={<View style={{ gap: space.breath }}><Button label="Remove" busy={removeBusy} onPress={() => { setRemoveBusy(true); removeVehicleImage(vehicle.id, removeImage).then(() => setRemoveImage(null)).catch(() => setActionError("Could not remove the image. Nothing was changed. Try again.")).finally(() => setRemoveBusy(false)); }} /><Button label="Keep it" kind="quiet" onPress={() => setRemoveImage(null)} /></View>} />
          ) : null}
          {actionError ? <Notice title="Could not complete that" body={actionError} /> : null}

        </>
      ) : null}

      {(() => {
        const svc: Record<string, { id: string; name: string; category: string }> = {};
        for (const j of jobs) if (serviceNames[j.serviceId]) svc[j.serviceId] = { id: j.serviceId, name: serviceNames[j.serviceId]!, category: serviceCats[j.serviceId] ?? "" };
        const plan = buildCarePlan({ jobs, services: svc, warranties: activeWarranties.map((w) => ({ label: w.warrantyLabel, endDate: w.endDate })) });
        const upcoming = buildUpcoming({ plan: { ...plan, warranties: [] }, papers: [] });
        if (upcoming.length === 0) return null;
        return <CareTimeline title="Service due" count={countLabel(upcoming.length, "item", "items")} items={upcoming} empty="Nothing due yet. The care plan starts once the studio finishes a service on this car." />;
      })()}

      {(() => {
        const past = buildHistory(jobs.map((j) => ({ id: j.id, title: visitTitle(visitServices(j, invoices.find((x) => x.jobId === j.id), serviceNames)), also: [visitAlso(visitServices(j, invoices.find((x) => x.jobId === j.id), serviceNames))].filter(Boolean).join(" "), at: j.sealedAt ?? j.createdAt, status: j.status })));
        const bookingOf = (jobId?: string) => jobs.find((j) => j.id === jobId)?.bookingId;
        return (
          <View style={{ gap: space.gap }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <T role="label" tone="tertiary">Service history</T>
              <T role="caption" tone="tertiary">{countLabel(past.length, "visit", "visits")}</T>
            </View>
            {past.length === 0 ? <T role="caption" tone="secondary">Service visits and updates for this car will appear here.</T> : (
                <View>
                  {latestVisits(past).map((it, n) => {
                    const bid = bookingOf(it.jobId);
                    const invoice = invoices.find((x) => x.jobId === it.jobId);
                    return (
                      <HistoryVisitRow
                        key={it.jobId ?? n}
                        at={new Date(it.at).toISOString()}
                        title={it.title}
                        caption={it.sub}
                        status={it.pill ?? ""}
                        first={n === 0}
                        onPress={bid ? () => router.push(`/(tabs)/bookings/${bid}`) : undefined}
                        extra={invoice ? <LinkAction label={`View invoice ${invoice.invoiceNumber}`} testID={`history-invoice-${invoice.id}`} onPress={() => router.push(invoiceHref(invoice.id))} /> : null}
                      />
                    );
                  })}
                </View>
              )}
            {past.length > HISTORY_PREVIEW ? (
              <Button label={`See all ${past.length} visits`} kind="quiet" testID="history-see-all" onPress={() => router.push({ pathname: "/(tabs)/garage/history", params: { vehicleId: id } })} />
            ) : null}
          </View>
        );
      })()}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Kicker>Documents</Kicker>
        <T role="caption" tone="tertiary">{countLabel(papers.length + documentProtections.length, "document", "documents")}</T>
      </View>
      {true ? (
        <>
          {papers.length === 0 && documentProtections.length === 0 ? (
            <T role="caption" tone="secondary">No documents yet. Add your RC, insurance or PUC. We try to read the plate and expiry. Unclear details need studio review.</T>
          ) : (
            <Pane pad="gap">
              {papers.map((p, i) => {
                const left = daysUntil(p.expiresOn);
                const expiry = left === null ? null : left < 0 ? "Expired" : left === 0 ? "Expires today" : `${left} day${left === 1 ? "" : "s"} left`;
                return (
                  <Row
                    key={p.id}
                    title={paperName(p)}
                    detail={[p.status === "VERIFIED" ? (p.verificationMode === "automatic" ? "Document auto-checked" : "Document checked") : p.status === "REJECTED" ? "Document rejected" : "Document under studio review", p.reference, expiry, p.verificationReason || p.rejectionReason].filter(Boolean).join(" · ")}
                    onPress={p.evidenceUrl || p.evidencePath ? () => void openDocPhoto(p) : undefined}
                    trailing={PAPER_EDIT_ENABLED ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><IconAction kind="edit" label={`Edit ${paperName(p)}`} onPress={() => openDocEdit(p)} /><IconAction kind="delete" label={`Delete ${paperName(p)}`} onPress={() => setDeleteId(p.id)} /></View> : null}
                    last={i === papers.length - 1 && documentProtections.length === 0}
                  />
                );
              })}
              {documentProtections.map((p, i) => (
                <Row
                  key={p.id}
                  title={protectionRecordTitle(p)}
                  detail={protectionDetail(p, formatDate) || undefined}
                  trailing={<Chip label={protectionChip(p)} tone={p.status === "verified" ? "premium" : "neutral"} />}
                  last={i === documentProtections.length - 1}
                />
              ))}
            </Pane>
          )}
          {reportedProtections.length > 0 ? (
            <View style={{ gap: space.breath }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Kicker>Reported by you</Kicker>
                <T role="caption" tone="tertiary">Not verified by AutoDeck</T>
              </View>
              {reportedProtections.length > 0 ? (
                <Pane pad="gap">
                  {reportedProtections.map((p, i) => (
                    <Row
                      key={p.id}
                      title={PROTECTION_KIND_LABELS[p.kind] ?? p.kind}
                      detail={protectionDetail(p, formatDate) || undefined}
                      trailing={
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Chip label={protectionChipFor(p, auth.status === "ready" ? auth.user.uid : null)} tone="neutral" />
                          {isCustomerEditable(p, auth.status === "ready" ? auth.user.uid : null) ? <IconAction kind="edit" label={`Edit ${PROTECTION_KIND_LABELS[p.kind] ?? p.kind}`} onPress={() => openProtectionEdit(p)} /> : null}
                        </View>
                      }
                      last={i === reportedProtections.length - 1}
                    />
                  ))}
                </Pane>
              ) : null}
            </View>
          ) : null}
          {historyProtections.length > 0 ? (
            <View style={{ gap: space.breath }}>
              <Kicker>Protection history</Kicker>
              <Pane pad="gap">
                {historyProtections.map((p, i) => (
                  <Row
                    key={p.id}
                    title={protectionRecordTitle(p)}
                    detail={[protectionDetail(p, formatDate), protectionLifecycleLabel(p, formatDate)].filter(Boolean).join(" · ") || undefined}
                    trailing={<Chip label="Past record" tone="neutral" />}
                    last={i === historyProtections.length - 1}
                  />
                ))}
              </Pane>
              <LinkAction label="View service history" onPress={() => router.push({ pathname: "/(tabs)/garage/history", params: { vehicleId: id } })} />
            </View>
          ) : null}
          {protEdit ? (
            <Pane pad="gap">
              <T role="label" tone="tertiary">{`Edit ${PROTECTION_KIND_LABELS[protEdit.protection.kind] ?? protEdit.protection.kind}`}</T>
              <T role="caption" tone="secondary">Marked as added by you - AutoDeck has not verified it. Warranty years alone do not create an expiry date.</T>
              <View pointerEvents={protBusy ? "none" : "auto"} accessibilityState={{ busy: protBusy }} style={protBusy ? { opacity: 0.6 } : undefined}>
                {/* Handlers are guarded too: pointer-events alone does not
                    stop keyboard input on an already-focused field or a
                    programmatic change while the save is in flight. (Writer lineage 0110/0113 restored.) */}
                <Field label="Brand or installer" placeholder="e.g. Garware, LLumar" value={protForm.brand} onChangeText={(v: string) => { if (!protBusy) setProtForm((f) => ({ ...f, brand: v })); }} maxLength={200} editable={!protBusy} />
                <Field label="Warranty (years, optional)" placeholder="e.g. 5" value={protForm.years} onChangeText={(v: string) => { if (!protBusy) setProtForm((f) => ({ ...f, years: v })); }} keyboardType="numeric" maxLength={2} editable={!protBusy} />
                <DateField label="Applied on (optional)" value={protForm.applied} onChange={(v: string) => { if (!protBusy) setProtForm((f) => ({ ...f, applied: v })); }} max={new Date().toISOString().slice(0, 10)} disabled={protBusy} />
                <Field label="Notes (optional)" placeholder="e.g. full body except roof" value={protForm.notes} onChangeText={(v: string) => { if (!protBusy) setProtForm((f) => ({ ...f, notes: v })); }} maxLength={1000} editable={!protBusy} />
              </View>
              <View style={{ flexDirection: "row", gap: space.breath }}>
                <Button label="Save" busy={protBusy} onPress={() => void saveProtectionForm()} />
                <Button label="Cancel" kind="quiet" onPress={() => { protFlow.current?.invalidate(); setProtEdit(null); }} />
              </View>
            </Pane>
          ) : null}
          {deleteId ? (
            <Notice title="Delete this document?" body={`${(() => { const t = papers.find((x) => x.id === deleteId); return t ? `${paperName(t)}${t.reference ? ` · ${t.reference}` : ""}. ` : ""; })()}The document and its photo will no longer be available in the garage. Your car and bookings are not affected.`} action={<View style={{ gap: space.breath }}><Button label="Delete" busy={docBusy} onPress={() => void handleDeleteDoc(deleteId)} /><Button label="Cancel" kind="quiet" onPress={() => setDeleteId(null)} /></View>} />
          ) : null}
          {docOpen ? (
            <View style={{ gap: space.breath }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.hair }}>
                {(["RC", "INSURANCE", "PUC", "OTHER"] as const).map((k) => (
                  <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: docForm.kind === k }} onPress={() => pickDocKind(k)}>
                    <Chip label={k === "OTHER" ? "Other" : k === "RC" ? "RC" : k === "PUC" ? "PUC" : "Insurance"} tone={docForm.kind === k ? "premium" : "neutral"} />
                  </Pressable>
                ))}
              </View>
              {docForm.kind === "OTHER" ? <Field label="Document name" placeholder="e.g. Warranty card" value={docForm.title} maxLength={80} onChangeText={(v: string) => setDocForm((f) => ({ ...f, title: v }))} /> : null}
              <Field placeholder={docForm.kind==="RC"?"e.g. MH02AB1234":"Enter number"} label={docForm.kind==="RC"?"Registration number":"Document or policy number"} value={docForm.reference} maxLength={docForm.kind==="RC"?REG_RAW_MAX:120} autoCapitalize={docForm.kind==="RC"?"characters":"none"} error={numberError ?? undefined} onChangeText={changeDocReference} />
              <DateField label="Expiry date (optional)" value={docForm.expiresOn} onChange={(v: string) => setDocForm((f) => ({ ...f, expiresOn: v }))} />
              {docEditing && !docPhoto && currentDocImageUrl && !removeDocPhoto ? (
                <View style={{ gap: space.hair }}>
                  <Image source={{ uri: currentDocImageUrl }} style={{ width: "100%", height: 180, borderRadius: 12 }} accessibilityLabel="Saved document photo" />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <IconAction kind="delete" label="Remove saved photo" onPress={() => setConfirmRemoveDocPhoto(true)} />
                    <T role="caption" tone="tertiary">Remove the saved photo from this document</T>
                  </View>
                </View>
              ) : null}
              {docEditing && removeDocPhoto ? <T role="caption" tone="tertiary">The saved photo is removed when you save. Pick a new image to replace it instead.</T> : null}
              {confirmRemoveDocPhoto ? (
                <Notice title="Remove this photo?" body="The photo is removed from this document when you save. The document and its details stay." action={<View style={{ gap: space.breath }}><Button label="Remove photo" onPress={() => { setRemoveDocPhoto(true); setConfirmRemoveDocPhoto(false); }} /><Button label="Keep it" kind="quiet" onPress={() => setConfirmRemoveDocPhoto(false)} /></View>} />
              ) : null}
              <View style={{ gap: space.hair }}>
                <Kicker>Photo or scan (optional)</Kicker>
                <FileUploader files={docPhoto&&"blob"in docPhoto&&docPhoto.blob?[{blob:docPhoto.blob,type:docPhoto.contentType??docPhoto.blob.type}]:[]} onChange={fs=>{const f=fs[0];if(f)setRemoveDocPhoto(false);setDocPhoto(f?{blob:f.blob,contentType:f.type}:null);}} nativeEnabled onNativeChange={nf=>{const f=nf[0];if(f)setRemoveDocPhoto(false);setDocPhoto(f?{bytes:f.bytes,contentType:f.type}:null);}}/>
                {docPhoto ? <T role="caption" tone="tertiary">Photo selected - it uploads when you save.</T> : null}
              </View>
              {docError ? <Notice title={/^Saved, but the photo did not upload/.test(docError) ? "Photo did not upload" : docEditing ? "Can't save this document" : "Can't add this document"} body={docError} /> : null}
              <Button label={docEditing ? "Save changes" : "Submit for verification"} busy={docBusy} onPress={() => void handleSaveDoc()} />
              <Button label="Cancel" kind="quiet" onPress={resetDocForm} />
            </View>
          ) : (
            <Button label="Add a document" onPress={() => { setDocNotice(null); setDocOpen(true); }} />
          )}
          {docNotice ? <Notice title="Saved" body={docNotice} action={<Button label="OK" kind="quiet" onPress={() => setDocNotice(null)} />} /> : null}
        </>
      ) : null}

      {/* Customer Garage warranty UI hidden for now (Gauri 2 Nov 15:45:51 "remove warranty
          thing for now form UI", confirmed basket; Meet 16:25 "Accept gauris changes").
          Records, issuance, backend rules and Staff/Admin surfaces are unchanged; the
          listener above still feeds the care plan. Flip to restore the section. */}
      {SHOW_CUSTOMER_WARRANTY_SECTION ? (<>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Kicker>Warranty</Kicker>
        <T role="caption" tone="tertiary">{warranties.length === 0 ? "None yet" : countLabel(warranties.length, "certificate", "certificates")}</T>
      </View>
      {warranties.length === 0 ? (
        <T role="caption" tone="secondary">Warranties are issued automatically when an eligible service is completed.</T>
      ) : (
        <Pane pad="gap">
          {warranties.map((w, i) => {
            const left = daysUntil(w.endDate);
            const state = w.revokedAt ? "Revoked" : w.endDate === null ? "Lifetime" : left !== null && left < 0 ? "Expired" : "Active";
            const safeDate = (iso?: string | null) => { if (!iso) return null; const t = Date.parse(iso); return Number.isNaN(t) ? null : formatDate(iso); };
            const start = safeDate(w.startDate), end = safeDate(w.endDate);
            const range = start && (end || w.endDate === null) ? `${start} to ${end ?? "Lifetime"}` : (end ?? null);
            const countdown = w.revokedAt || w.endDate === null ? null : left === null ? null : left < 0 ? (end ? `Ended ${end}` : "Expired") : left === 0 ? "Ends today" : left <= 60 ? `${left} day${left === 1 ? "" : "s"} left` : `${Math.floor(left / 30)} months left`;
            const terms = w.coverageTerms && w.coverageTerms.trim().toLowerCase() !== w.warrantyLabel.trim().toLowerCase() ? w.coverageTerms : null;
            return (
              <Row
                key={w.id}
                title={w.warrantyLabel}
                detail={[w.serviceName, range, terms].filter(Boolean).join(" · ")}
                trailing={<Chip label={countdown && state === "Active" ? countdown : state} tone={state === "Active" || state === "Lifetime" ? "premium" : state === "Revoked" ? "danger" : "neutral"} />}
                last={i === warranties.length - 1}
              />
            );
          })}
        </Pane>
      )}
      </>) : null}
      {!editing ? (
        <View style={{ gap: space.breath }}>
          <Button label="Edit vehicle" kind="quiet" onPress={() => setEditing(true)} />
          {confirmingArchive ? (
            <Notice
              title="Remove from your garage?"
              body="Service history stays on record."
              action={
                <View style={{ gap: space.breath }}>
                  <Button label="Yes, remove" kind="danger" onPress={() => void handleArchiveConfirmed()} />
                  <Button label="Keep it" kind="quiet" onPress={() => setConfirmingArchive(false)} />
                </View>
              }
            />
          ) : (
            <Button label="Remove from garage" kind="danger" onPress={() => setConfirmingArchive(true)} />
          )}
        </View>
      ) : null}

    </Screen>
  );
}
