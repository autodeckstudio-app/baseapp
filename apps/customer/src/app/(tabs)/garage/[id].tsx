import { VISIT_FALLBACK, visitAlso, visitServices, visitTitle } from "../../../lib/visit-services";
import { lastFinishedJob } from "../../../lib/care-due";
import { buildCarePlan } from "../../../lib/care-plan";
import { glassSurface, glassInner, glassOrange } from "../../../lib/glass";
import { FileUploader, DateField, SelectField } from "../../../ui/inputs";
import { VEHICLE_SIZES } from "../../../lib/vehicle-size";
import { validateDocument, documentReference } from "../../../lib/document-validation";
import { useState, useEffect, createElement } from "react";
import { Platform, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import type { VehicleCategory, Invoice, Vehicle, ServiceJob, Protection, Warranty, Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { FIRST_STUDIO_ID, segmentLabel } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Chip, Field, Kicker, LinkAction, Loading, Notice, Pane, Plate, Row, Screen, T } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { updateVehicle, archiveVehicle, uploadVehiclePhoto, uploadVehicleRc } from "../../../lib/vehicle-service";
import { metrics } from "../../../lib/metrics";
import { CarHero } from "../../../ui/CarHero";
import { historyReportHtml, historyRows } from "../../../lib/history-report";
import { STUDIO_INFO } from "../../../lib/studio-info";
import { CarThumb } from "../../../ui/CarThumb";
import { listenToJobsForVehicle } from "../../../lib/job-service";
import { listenToVehicleProtections } from "../../../lib/protection-service";
import { listenToVehicleWarranties } from "../../../lib/warranty-service";
import { listenToVehiclePapers, listenToCustomerPapers, submitMyPaper, updateMyPaper, deleteMyPaper, daysUntil, type MyPaper } from "../../../lib/paper-service";
import { paperName, numberClash, buildDocumentList } from "../../../lib/documents";
import { limitRegistrationInput } from "../../../lib/registration-input";
import { IconAction } from "../../../ui/IconAction";
import { invoiceHref } from "../../../lib/invoice-display";
import { listenToInvoicesForVehicle } from "../../../lib/invoice-service";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { getMyBookings } from "../../../lib/booking-service";
import { useAuth } from "../../../hooks/useAuth";
import { CarOverview } from "../../../ui/CarOverview";
import { CareTimeline } from "../../../ui/CareTimeline";
import { buildUpcoming, buildHistory, countLabel, latestVisits, HISTORY_PREVIEW } from "../../../lib/car-timeline";


const PROTECTION_KIND_LABELS: Record<string, string> = {
  insurance: "Insurance",
  fasttag: "FastTag",
  puc: "PUC Certificate",
  rc: "Registration Certificate",
  extended_warranty: "Extended Warranty",
  other: "Other",
};

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
  const [allPapers, setAllPapers] = useState<MyPaper[]>([]);
  const [docEditing, setDocEditing] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [numberError, setNumberError] = useState<string | null>(null);
  const [docPhoto, setDocPhoto] = useState<{ blob: Blob; contentType: string } | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
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
    setDocPhoto(null); setDocOpen(false); setDocEditing(null); setDocError(null); setNumberError(null);
  }
  function openDocEdit(p: MyPaper) {
    setDocForm({ kind: p.kind, reference: p.reference, title: p.title ?? "", expiresOn: p.expiresOn ?? "" });
    setDocPhoto(null); setDocEditing(p.id); setDocError(null); setNumberError(null); setDocOpen(true); setDeleteId(null);
  }
  function pickDocKind(k: MyPaper["kind"]) {
    // One active RC per car: choosing RC when the car already has one edits that RC.
    const existingRc = k === "RC" ? papers.find((p) => p.kind === "RC") : undefined;
    if (existingRc) { openDocEdit(existingRc); return; }
    setDocEditing(null); setNumberError(null);
    setDocForm((f) => ({ ...f, kind: k }));
  }
  function changeDocReference(v: string) {
    const value = docForm.kind === "RC" ? limitRegistrationInput(v) : v;
    setDocForm((f) => ({ ...f, reference: value }));
    setNumberError(numberClash(allPapers, documentReference(docForm.kind, value), docEditing));
  }
  async function handleSaveDoc() {
    if (!id) return;
    setDocError(null);
    const validationError=validateDocument(docForm.kind,docForm.reference,docForm.expiresOn);
    if(validationError){setDocError(validationError);return;}
    if (docForm.kind === "OTHER" && !docForm.title.trim()) { setDocError("Give this document a name."); return; }
    const clash = numberClash(allPapers, documentReference(docForm.kind, docForm.reference), docEditing);
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
        });
      } else {
        await submitMyPaper({
          studioId: FIRST_STUDIO_ID,
          vehicleId: id,
          kind: docForm.kind,
          reference: documentReference(docForm.kind,docForm.reference),
          ...(docForm.kind === "OTHER" ? { title: docForm.title.trim() } : {}),
          ...(docForm.expiresOn ? { expiresOn: docForm.expiresOn } : {}),
          photo: docPhoto,
        });
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

  const verifiedProtections = protections.filter((p) => p.status === "verified");
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

                  <T role="caption" tone="tertiary">{newPhoto ? "New photo ready. It uploads when you save." : "Choose a JPEG, PNG or WebP to replace the photo."}</T>
                </View>
              ) : null}
              {Platform.OS === "web" ? (
                <View style={{ gap: space.hair }}>
                  <Kicker>RC photo</Kicker>
                  <FileUploader label={vehicle.rcPhotoUrl ? "Replace RC photo" : "Add RC photo"} files={newRc ? [{ blob: newRc.blob, type: newRc.contentType }] : []} onChange={(fs) => { const f = fs[0]; setNewRc(f ? { blob: f.blob, contentType: f.type } : null); }} />
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
            <CareTimeline
              title="Service history"
              count={countLabel(past.length, "visit", "visits")}
              items={latestVisits(past)}
              empty="Service visits and updates for this car will appear here."
              onItem={(it) => { const bid = bookingOf(it.jobId); if (bid) router.push(`/(tabs)/bookings/${bid}`); }}
              renderExtra={(it) => {
                const invoice = invoices.find((x) => x.jobId === it.jobId);
                return invoice ? <LinkAction label={`View invoice ${invoice.invoiceNumber}`} testID={`history-invoice-${invoice.id}`} onPress={() => router.push(invoiceHref(invoice.id))} /> : null;
              }}
            />
            {past.length > HISTORY_PREVIEW ? (
              <Button label={`See all ${past.length} visits`} kind="quiet" testID="history-see-all" onPress={() => router.push({ pathname: "/(tabs)/garage/history", params: { vehicleId: id } })} />
            ) : null}
            {Platform.OS === "web" && jobs.length > 0 ? (
<Button label="Download service history (PDF)" kind="quiet" onPress={() => {
                  const html = historyReportHtml({ studioName: STUDIO_INFO.name, studioAddress: STUDIO_INFO.address, studioPhone: STUDIO_INFO.phone, carTitle: `${vehicle.make} ${vehicle.model}`, plate: vehicle.registrationNumber, generatedOn: formatDate(new Date().toISOString()), rows: historyRows(jobs, (sid) => serviceNames[sid] ?? VISIT_FALLBACK, formatDate, (jid) => invoices.find((x) => x.jobId === jid)?.invoiceNumber ?? null, (j) => visitTitle(visitServices(j, invoices.find((x) => x.jobId === j.id), serviceNames))) });
                  const w = (globalThis as unknown as { open: (u: string, t: string) => { document: { write: (h: string) => void; close: () => void }; focus: () => void; print: () => void } | null }).open("", "_blank");
                  if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); } else setActionError("Allow pop-ups to download the history.");
                }} />
            ) : null}
          </View>
        );
      })()}

      {(() => {
        const items = buildDocumentList({ papers: papers.map((p) => ({ ...p, days: daysUntil(p.expiresOn) })), warranties: activeWarranties.map((w) => ({ label: w.warrantyLabel, endDate: w.endDate, days: daysUntil(w.endDate) })) });
        if (items.length === 0) return null;
        return <CareTimeline title="Documents" count={countLabel(items.length, "item", "items")} items={items} empty="" />;
      })()}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Kicker>Papers</Kicker>
        <T role="caption" tone="tertiary">{countLabel(papers.length + protections.length, "document", "documents")}</T>
      </View>
      {true ? (
        <>
          {papers.length === 0 && protections.length === 0 ? (
            <T role="caption" tone="secondary">No documents yet. Add your RC, insurance or PUC. Clear photos are checked automatically for the plate and expiry. Anything we cannot confirm is kept safely and checked by the studio.</T>
          ) : (
            <Pane pad="gap">
              {papers.map((p, i) => {
                const left = daysUntil(p.expiresOn);
                const expiry = left === null ? null : left < 0 ? "Expired" : left === 0 ? "Expires today" : `${left} day${left === 1 ? "" : "s"} left`;
                return (
                  <Row
                    key={p.id}
                    title={paperName(p)}
                    detail={[p.reference, expiry, p.verificationReason || p.rejectionReason].filter(Boolean).join(" · ")}
                    trailing={<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Chip label={p.status === "VERIFIED" ? (p.verificationMode === "automatic" ? "Auto-approved" : "Verified") : p.status === "REJECTED" ? "Rejected" : "Under studio review"} tone={p.status === "VERIFIED" ? "premium" : "neutral"} /><IconAction kind="edit" label={`Edit ${paperName(p)}`} onPress={() => openDocEdit(p)} /><IconAction kind="delete" label={`Delete ${paperName(p)}`} onPress={() => setDeleteId(p.id)} /></View>}
                    last={i === papers.length - 1 && protections.length === 0}
                  />
                );
              })}
              {protections.map((p, i) => (
                <Row
                  key={p.id}
                  title={PROTECTION_KIND_LABELS[p.kind] ?? p.kind}
                  detail={[p.provider, p.expiryDate !== null ? `Expires ${formatDate(p.expiryDate)}` : null].filter(Boolean).join(" · ") || undefined}
                  trailing={<Chip label={p.status} tone={p.status === "verified" ? "premium" : "neutral"} />}
                  last={i === protections.length - 1}
                />
              ))}
            </Pane>
          )}
          {deleteId ? (
            <Notice title="Delete this document?" body="This removes the document and its photo. Your car and bookings are not affected." action={<View style={{ gap: space.breath }}><Button label="Delete" busy={docBusy} onPress={() => void handleDeleteDoc(deleteId)} /><Button label="Cancel" kind="quiet" onPress={() => setDeleteId(null)} /></View>} />
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
              <Field placeholder={docForm.kind==="RC"?"e.g. MH02AB1234":"Enter number"} label={docForm.kind==="RC"?"Registration number":"Document or policy number"} value={docForm.reference} maxLength={docForm.kind==="RC"?10:120} autoCapitalize={docForm.kind==="RC"?"characters":"none"} error={numberError ?? undefined} onChangeText={changeDocReference} />
              <DateField label="Expiry date (optional)" value={docForm.expiresOn} onChange={(v: string) => setDocForm((f) => ({ ...f, expiresOn: v }))} />
              {Platform.OS === "web" ? (
                <View style={{ gap: space.hair }}>
                  <Kicker>Photo or scan (optional)</Kicker>
                  <FileUploader files={docPhoto?[{blob:docPhoto.blob,type:docPhoto.contentType}]:[]} onChange={fs=>{const f=fs[0];setDocPhoto(f?{blob:f.blob,contentType:f.type}:null);}}/>

                  {docPhoto ? <T role="caption" tone="tertiary">Photo ready.</T> : null}
                </View>
              ) : null}
              {docError ? <Notice title={docEditing ? "Can't save this document" : "Can't add this document"} body={docError} /> : null}
              <Button label={docEditing ? "Save changes" : "Submit for verification"} busy={docBusy} onPress={() => void handleSaveDoc()} />
              <Button label="Cancel" kind="quiet" onPress={resetDocForm} />
            </View>
          ) : (
            <Button label="Add a document" onPress={() => setDocOpen(true)} />
          )}
        </>
      ) : null}

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
            const countdown = w.revokedAt || w.endDate === null ? null : left === null ? null : left < 0 ? `Ended ${formatDate(w.endDate)}` : left === 0 ? "Ends today" : left <= 60 ? `${left} day${left === 1 ? "" : "s"} left` : `${Math.floor(left / 30)} months left`;
            const terms = w.coverageTerms && w.coverageTerms.trim().toLowerCase() !== w.warrantyLabel.trim().toLowerCase() ? w.coverageTerms : null;
            return (
              <Row
                key={w.id}
                title={w.warrantyLabel}
                detail={[w.serviceName, `${formatDate(w.startDate)} to ${w.endDate ? formatDate(w.endDate) : "Lifetime"}`, terms].filter(Boolean).join(" · ")}
                trailing={<Chip label={countdown && state === "Active" ? countdown : state} tone={state === "Active" || state === "Lifetime" ? "premium" : state === "Revoked" ? "danger" : "neutral"} />}
                last={i === warranties.length - 1}
              />
            );
          })}
        </Pane>
      )}
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
