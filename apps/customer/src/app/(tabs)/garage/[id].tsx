import { glassSurface, glassInner, glassOrange } from "../../../lib/glass";
import { FileUploader, DateField } from "../../../ui/inputs";
import { validateDocument, documentReference } from "../../../lib/document-validation";
import { useState, useEffect, createElement } from "react";
import { Platform, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import type { Invoice, Vehicle, ServiceJob, Protection, Warranty, Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Chip, Field, Kicker, Loading, Notice, Pane, Plate, Row, Screen, T } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { updateVehicle, archiveVehicle, uploadVehiclePhoto, uploadVehicleRc } from "../../../lib/vehicle-service";
import { metrics } from "../../../lib/metrics";
import { CarHero } from "../../../ui/CarHero";
import { CarThumb } from "../../../ui/CarThumb";
import { listenToJobsForVehicle } from "../../../lib/job-service";
import { listenToVehicleProtections } from "../../../lib/protection-service";
import { listenToVehicleWarranties } from "../../../lib/warranty-service";
import { listenToVehiclePapers, submitMyPaper, daysUntil, type MyPaper } from "../../../lib/paper-service";
import { invoiceHref } from "../../../lib/invoice-display";
import { listenToInvoicesForVehicle } from "../../../lib/invoice-service";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { getMyBookings } from "../../../lib/booking-service";
import { useAuth } from "../../../hooks/useAuth";
import { CarOverview, TabPills } from "../../../ui/CarOverview";
import { CareMap, type CareDone } from "../../../ui/CareMap";

type TabKey = "overview" | "care" | "passport" | "protection" | "warranty";

const PROTECTION_KIND_LABELS: Record<string, string> = {
  insurance: "Insurance",
  fasttag: "FastTag",
  puc: "PUC Certificate",
  rc: "Registration Certificate",
  extended_warranty: "Extended Warranty",
  other: "Other",
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "care", label: "Care map" },
  { key: "passport", label: "Service history" },
  { key: "protection", label: "Documents" },
  { key: "warranty", label: "Warranty" },
];

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
  const [form, setForm] = useState({ make: "", model: "", color: "", odometer: "" });
  const [tab, setTab] = useState<TabKey>("overview");
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [serviceCats, setServiceCats] = useState<Record<string, string>>({});
  const [protections, setProtections] = useState<Protection[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [papers, setPapers] = useState<MyPaper[]>([]);
  const [docForm, setDocForm] = useState({ kind: "INSURANCE" as MyPaper["kind"], reference: "", expiresOn: "" });
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

  async function handleAddDoc() {
    if (!id) return;
    setDocError(null);
    const validationError=validateDocument(docForm.kind,docForm.reference,docForm.expiresOn);
    if(validationError){setDocError(validationError);return;}
    setDocBusy(true);
    try {
      await submitMyPaper({
        studioId: FIRST_STUDIO_ID,
        vehicleId: id,
        kind: docForm.kind,
        reference: documentReference(docForm.kind,docForm.reference),
        ...(docForm.expiresOn ? { expiresOn: docForm.expiresOn } : {}),
        photo: docPhoto,
      });
      setDocForm({ kind: "INSURANCE", reference: "", expiresOn: "" });
      setDocPhoto(null);
      setDocOpen(false);
    } catch (e) {
      setDocError(e instanceof Error ? e.message : "Could not add the document.");
    } finally {
      setDocBusy(false);
    }
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
  const mostRecentJob = jobs[0] ?? null;
  const careDone: CareDone = { ppf: null, coating: null, tint: null };
  for (const j of jobs) {
    if (j.status !== "DELIVERED" && j.status !== "READY_FOR_DELIVERY" && j.status !== "QUALITY_CHECK") continue;
    const c = serviceCats[j.serviceId];
    const when = j.sealedAt ?? j.createdAt;
    if (c === "ppf" && (!careDone.ppf || when > careDone.ppf)) careDone.ppf = when;
    if ((c === "ceramic" || c === "coating") && (!careDone.coating || when > careDone.coating)) careDone.coating = when;
    if (c === "tinting" && (!careDone.tint || when > careDone.tint)) careDone.tint = when;
  }
  const reminders: string[] = [];
  for (const p of papers) {
    const left = daysUntil(p.expiresOn);
    const name = PROTECTION_KIND_LABELS[p.kind.toLowerCase()] ?? p.kind;
    if (left !== null && left < 0) reminders.push(`${name} expired. Upload the renewed copy in Documents.`);
    else if (left !== null && left <= 30) reminders.push(`${name} expires in ${left} day${left === 1 ? "" : "s"}.`);
  }
  for (const w of activeWarranties) {
    const left = daysUntil(w.endDate);
    if (left !== null && left >= 0 && left <= 60) reminders.push(`${w.warrantyLabel} ends in ${left} day${left === 1 ? "" : "s"}.`);
  }
  if (mostRecentJob && upcomingBooking === null) {
    const since = Math.floor((Date.now() - new Date(mostRecentJob.sealedAt ?? mostRecentJob.createdAt).getTime()) / 86400000);
    if (since >= 45) reminders.push(`Last service was ${since} days ago. Time for a wash or check-up.`);
  }

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
              ...(vehicle.category ? [{ label: "Type", value: vehicle.category.charAt(0).toUpperCase() + vehicle.category.slice(1) }] : []),
              ...(verifiedProtections.length > 0 ? [{ label: "Protection", value: `${verifiedProtections.length} on file` }] : []),
            ]}
            compact={!vehicle.photoUrl && !newPhoto}
            onBook={() => router.push("/(tabs)/catalogue")}
          />
          <TabPills tabs={TABS} value={tab} onChange={setTab} />
        </View>
      }
    >
      {tab === "overview" ? (
        <>
          <CarOverview
            protections={verifiedProtections.length}
            warranties={activeWarranties.length}
            next={upcomingBooking ? { title: `${formatDate(upcomingBooking.scheduledDate)} at ${upcomingBooking.scheduledTime}`, detail: "Upcoming booking", note: upcomingBooking.membershipDiscountApplied ? "Membership benefit applies" : undefined, onPress: () => router.push(`/(tabs)/bookings/${upcomingBooking.id}`) } : null}
            last={mostRecentJob ? { title: serviceNames[mostRecentJob.serviceId] ?? "Studio visit", detail: formatDate(mostRecentJob.sealedAt ?? mostRecentJob.createdAt), status: mostRecentJob.status.replace(/_/g, " ") } : null}
            reminders={reminders}
            details={[
              { label: "Make", value: vehicle.make },
              { label: "Model", value: vehicle.model },
              { label: "Registration", value: vehicle.registrationNumber },
              ...(vehicle.odometer !== null && vehicle.odometer !== undefined ? [{ label: "Odometer", value: `${vehicle.odometer.toLocaleString("en-IN")} km` }] : []),
            ]}
            onBook={() => router.push("/(tabs)/catalogue")}
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
                  <FileUploader files={newPhoto?[{blob:newPhoto.blob,type:newPhoto.contentType}]:[]} onChange={fs=>{const f=fs[0];setNewPhoto(f?{blob:f.blob,contentType:f.type,previewUrl:URL.createObjectURL(f.blob)}:null);}}/>

                  <T role="caption" tone="tertiary">{newPhoto ? "New photo ready. It uploads when you save." : "Choose a JPEG, PNG or WebP to replace the photo."}</T>
                </View>
              ) : null}
              {Platform.OS === "web" ? (
                <View style={{ gap: space.hair }}>
                  <Kicker>RC photo</Kicker>
                  <FileUploader files={newRc ? [{ blob: newRc.blob, type: newRc.contentType }] : []} onChange={(fs) => { const f = fs[0]; setNewRc(f ? { blob: f.blob, contentType: f.type } : null); }} />
                  <T role="caption" tone="tertiary">{newRc ? "RC photo ready. It uploads when you save." : vehicle.rcPhotoUrl ? "An RC photo is on file. Choose a JPEG, PNG or WebP to replace it." : "Add a clear photo of the registration certificate (JPEG, PNG or WebP)."}</T>
                </View>
              ) : null}
              <Field label="Make" value={form.make} onChangeText={(v) => setForm((p) => ({ ...p, make: v }))} autoCapitalize="words" />
              <Field label="Model" value={form.model} onChangeText={(v) => setForm((p) => ({ ...p, model: v }))} autoCapitalize="words" />
              <Field label="Colour" value={form.color} onChangeText={(v) => setForm((p) => ({ ...p, color: v }))} autoCapitalize="words" />
              <Field label="Odometer (km)" value={form.odometer} onChangeText={(v) => setForm((p) => ({ ...p, odometer: v }))} keyboardType="numeric" />
              <View style={{ gap: space.breath }}>
                <Button label="Save changes" busy={saving} onPress={() => void handleSave()} />
                <Button label="Cancel" kind="quiet" onPress={() => { setNewPhoto(null); setNewRc(null); setEditing(false); }} />
              </View>
            </View>
          ) : null}

          {actionError ? <Notice title="Something went wrong" body={actionError} /> : null}

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
        </>
      ) : null}

      {tab === "care" ? <CareMap done={careDone} category={vehicle.category ?? null} make={vehicle.make} model={vehicle.model} colour={vehicle.color ?? null} onBook={(cat) => router.push({ pathname: "/(tabs)/catalogue", params: { cat } })} /> : null}
      {tab === "passport" ? (
        jobs.length === 0 ? (
          <Notice title="No service history yet" body="Service visits and updates for this car will appear here." />
        ) : (
          <Pane pad="gap">
            {jobs.map((job, i) => {
              const invoice = invoices.find((x) => x.jobId === job.id);
              return (
                <View key={job.id}>
                  <Row
                    title={serviceNames[job.serviceId] ?? "Studio visit"}
                    detail={formatDate(job.sealedAt ?? job.createdAt)}
                    trailing={<Chip label={job.status.replace(/_/g, " ")} />}
                    onPress={job.bookingId ? () => router.push(`/(tabs)/bookings/${job.bookingId}`) : undefined}
                    last={i === jobs.length - 1 && !invoice}
                  />
                  {invoice ? (
                    <View style={{ paddingBottom: space.line }}>
                      <Button
                        label={`View invoice ${invoice.invoiceNumber}`}
                        kind="quiet"
                        testID={`history-invoice-${invoice.id}`}
                        onPress={() => router.push(invoiceHref(invoice.id))}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Pane>
        )
      ) : null}

      {tab === "protection" ? (
        <>
          {papers.length === 0 && protections.length === 0 ? (
            <Notice title="No documents yet" body="Add your RC, insurance or PUC. Clear photos are checked automatically for the vehicle plate and expiry. Anything we cannot confirm is kept safely and checked by the studio." />
          ) : (
            <Pane pad="gap">
              {papers.map((p, i) => {
                const left = daysUntil(p.expiresOn);
                const expiry = left === null ? null : left < 0 ? "Expired" : left === 0 ? "Expires today" : `${left} day${left === 1 ? "" : "s"} left`;
                return (
                  <Row
                    key={p.id}
                    title={PROTECTION_KIND_LABELS[p.kind.toLowerCase()] ?? p.kind}
                    detail={[p.reference, expiry, p.verificationReason || p.rejectionReason].filter(Boolean).join(" · ")}
                    trailing={<Chip label={p.status === "VERIFIED" ? (p.verificationMode === "automatic" ? "Auto-approved" : "Verified") : p.status === "REJECTED" ? "Rejected" : "Under studio review"} tone={p.status === "VERIFIED" ? "premium" : "neutral"} />}
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
          {docOpen ? (
            <View style={{ gap: space.breath }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.hair }}>
                {(["RC", "INSURANCE", "PUC", "OTHER"] as const).map((k) => (
                  <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: docForm.kind === k }} onPress={() => setDocForm((f) => ({ ...f, kind: k }))}>
                    <Chip label={k === "OTHER" ? "Other" : k === "RC" ? "RC" : k === "PUC" ? "PUC" : "Insurance"} tone={docForm.kind === k ? "premium" : "neutral"} />
                  </Pressable>
                ))}
              </View>
              <Field placeholder={docForm.kind==="RC"?"e.g. MH02AB1234":"Enter number"} label={docForm.kind==="RC"?"Registration number":"Document or policy number"} value={docForm.reference} onChangeText={(v: string) => setDocForm((f) => ({ ...f, reference: v }))} />
              <DateField label="Expiry date (optional)" value={docForm.expiresOn} onChange={(v: string) => setDocForm((f) => ({ ...f, expiresOn: v }))} />
              {Platform.OS === "web" ? (
                <View style={{ gap: space.hair }}>
                  <Kicker>Photo or scan (optional)</Kicker>
                  <FileUploader files={docPhoto?[{blob:docPhoto.blob,type:docPhoto.contentType}]:[]} onChange={fs=>{const f=fs[0];setDocPhoto(f?{blob:f.blob,contentType:f.type}:null);}}/>

                  {docPhoto ? <T role="caption" tone="tertiary">Photo ready.</T> : null}
                </View>
              ) : null}
              {docError ? <Notice title="Can't add this document" body={docError} /> : null}
              <Button label="Submit for verification" busy={docBusy} onPress={() => void handleAddDoc()} />
              <Button label="Cancel" kind="quiet" onPress={() => { setDocOpen(false); setDocError(null); }} />
            </View>
          ) : (
            <Button label="Add a document" onPress={() => setDocOpen(true)} />
          )}
        </>
      ) : null}

      {tab === "warranty" ? (
        warranties.length === 0 ? (
          <Notice title="No warranties yet" body="Warranties are issued automatically when an eligible service is completed." />
        ) : (
          <View style={{ gap: space.breath }}>
            {warranties.map((w) => {
              const left = daysUntil(w.endDate);
              const state = w.revokedAt ? "Revoked" : w.endDate === null ? "Lifetime" : left !== null && left < 0 ? "Expired" : "Active";
              const countdown = w.revokedAt || w.endDate === null ? null : left === null ? null : left < 0 ? `Ended ${formatDate(w.endDate)}` : left === 0 ? "Ends today" : left <= 60 ? `${left} day${left === 1 ? "" : "s"} left` : `${Math.floor(left / 30)} months left`;
              return (
                <Pane key={w.id} pad="inset">
                  <View style={{ gap: space.breath }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space.breath }}>
                      <View style={{ flex: 1, gap: space.hair }}>
                        <Kicker tone="accent">Warranty certificate</Kicker>
                        <T role="heading">{w.warrantyLabel}</T>
                        <T role="caption" tone="secondary">{w.serviceName}</T>
                      </View>
                      <Chip label={state} tone={state === "Active" || state === "Lifetime" ? "premium" : state === "Revoked" ? "danger" : "neutral"} />
                    </View>
                    <Row title="Vehicle" detail={`${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}`} />
                    <Row title="Starts" detail={formatDate(w.startDate)} />
                    <Row title="Valid until" detail={w.endDate ? formatDate(w.endDate) : "Lifetime"} trailing={countdown ? <Chip label={countdown} /> : undefined} last={!w.coverageTerms} />
                    {w.coverageTerms && w.coverageTerms.trim().toLowerCase() !== w.warrantyLabel.trim().toLowerCase() ? <T role="caption" tone="secondary">{w.coverageTerms}</T> : null}
                  </View>
                </Pane>
              );
            })}
          </View>
        )
      ) : null}
    </Screen>
  );
}
