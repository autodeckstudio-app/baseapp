import { useState, useEffect, createElement } from "react";
import { Platform, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import type { Vehicle, ServiceJob, Protection, Warranty, Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Chip, Field, Kicker, Loading, Notice, Pane, Plate, Row, Screen, T } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { updateVehicle, archiveVehicle, uploadVehiclePhoto } from "../../../lib/vehicle-service";
import { CarThumb } from "../../../ui/CarThumb";
import { listenToJobsForVehicle } from "../../../lib/job-service";
import { listenToVehicleProtections } from "../../../lib/protection-service";
import { listenToVehicleWarranties } from "../../../lib/warranty-service";
import { listenToVehiclePapers, submitMyPaper, daysUntil, type MyPaper } from "../../../lib/paper-service";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { getMyBookings } from "../../../lib/booking-service";
import { useAuth } from "../../../hooks/useAuth";

type TabKey = "overview" | "passport" | "protection" | "warranty";

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

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPhoto, setNewPhoto] = useState<{ blob: Blob; contentType: string; previewUrl: string } | null>(null);
  const [form, setForm] = useState({ make: "", model: "", color: "", odometer: "" });
  const [tab, setTab] = useState<TabKey>("overview");
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
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
    if (!id) return;
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
    });
    return unsubscribe;
  }, [id]);

  useEffect(() => {
    if (!id || auth.status !== "ready") return undefined;
    return listenToJobsForVehicle(id, auth.claims.tenantId, auth.user.uid, setJobs, () => undefined);
  }, [id, auth.status]);

  useEffect(() => {
    if (!id || auth.status !== "ready") return undefined;
    return listenToVehicleProtections(id, auth.claims.tenantId, auth.user.uid, setProtections, () => undefined);
  }, [id, auth.status]);

  useEffect(() => {
    if (!id || auth.status !== "ready") return undefined;
    return listenToVehiclePapers(id, auth.claims.tenantId, auth.user.uid, setPapers, () => undefined);
  }, [id, auth.status]);

  async function handleAddDoc() {
    if (!id) return;
    setDocError(null);
    if (!docForm.reference.trim()) { setDocError("Enter the document or policy number."); return; }
    if (docForm.expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(docForm.expiresOn)) { setDocError("Use the expiry date as YYYY-MM-DD."); return; }
    setDocBusy(true);
    try {
      await submitMyPaper({
        studioId: FIRST_STUDIO_ID,
        vehicleId: id,
        kind: docForm.kind,
        reference: docForm.reference.trim(),
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
    return listenToVehicleWarranties(id, auth.claims.tenantId, auth.user.uid, setWarranties, () => undefined);
  }, [id, auth.status]);

  useEffect(() => {
    void getServiceCatalogue()
      .then((services) => {
        const map: Record<string, string> = {};
        for (const s of services) map[s.id] = s.name;
        setServiceNames(map);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!id || auth.status !== "ready") return;
    void getMyBookings(auth.user.uid, auth.claims.tenantId)
      .then((bookings) => {
        const upcoming = bookings
          .filter((b) => b.vehicleId === id && (b.status === "PENDING" || b.status === "CONFIRMED" || b.status === "ACTIVE"))
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
        setUpcomingBooking(upcoming[0] ?? null);
      })
      .catch(() => undefined);
  }, [id, auth.status]);

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

  if (loading) return <Loading label="Opening the room" />;
  if (!vehicle) return <Screen><Notice title="Vehicle not found" body="It may have been removed from your garage." /></Screen>;

  const verifiedProtections = protections.filter((p) => p.status === "verified");
  const activeWarranties = warranties.filter((w) => w.revokedAt === null);
  const mostRecentJob = jobs[0] ?? null;
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
          <View style={{ borderRadius: 30, overflow: "hidden", backgroundColor: "#121214", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
            {newPhoto ? (
              createElement("img", { src: newPhoto.previewUrl, alt: "New car photo", style: { width: "100%", height: 250, objectFit: "cover", display: "block" } })
            ) : (
              <CarThumb car={vehicle} height={250} radius={0} />
            )}
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 250, ...({ backgroundImage: "linear-gradient(180deg, rgba(5,5,6,0.35) 0%, rgba(5,5,6,0) 35%, rgba(5,5,6,0.9) 100%)" } as object) }} />
            <View style={{ position: "absolute", left: 18, right: 18, bottom: 16, gap: 6 }}>
              <T role="label" tone="accent">Vehicle room</T>
              <T role="title" style={{ color: "#FFFFFF" }} numberOfLines={1}>{vehicle.year} {vehicle.make} {vehicle.model}</T>
              <View style={{ alignSelf: "flex-start" }}><Plate value={vehicle.registrationNumber} /></View>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, padding: 4, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
            {TABS.map((t) => {
              const selected = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setTab(t.key)}
                  style={{ flexBasis: "48%", flexGrow: 1, alignItems: "center", paddingVertical: 12, borderRadius: 16, backgroundColor: selected ? "#F59A45" : "transparent" }}
                >
                  <T role="label" tone={selected ? "onAccent" : "secondary"}>{t.label}</T>
                </Pressable>
              );
            })}
          </View>
        </View>
      }
    >
      {tab === "overview" ? (
        <>
          {reminders.length > 0 ? (
            <Pane pad="inset">
              <View style={{ gap: space.breath }}>
                <Kicker tone="accent">Reminders</Kicker>
                {reminders.map((r) => (
                  <T key={r} role="body">{r}</T>
                ))}
              </View>
            </Pane>
          ) : null}
          <View style={{ flexDirection: "row", gap: space.line }}>
            <View style={{ flex: 1 }}>
              <Pane pad="inset">
                <View style={{ gap: space.hair }}>
                  <Kicker>Protection</Kicker>
                  {verifiedProtections.length > 0 ? (
                    <Chip label={`${verifiedProtections.length} verified`} tone="premium" />
                  ) : (
                    <T role="caption" tone="tertiary">None on file</T>
                  )}
                </View>
              </Pane>
            </View>
            <View style={{ flex: 1 }}>
              <Pane pad="inset">
                <View style={{ gap: space.hair }}>
                  <Kicker>Warranty</Kicker>
                  {activeWarranties.length > 0 ? (
                    <Chip label={`${activeWarranties.length} active`} tone="premium" />
                  ) : (
                    <T role="caption" tone="tertiary">None active</T>
                  )}
                </View>
              </Pane>
            </View>
          </View>

          <View style={{ gap: space.line }}>
            <Kicker>Recent service</Kicker>
            <Pane pad="gap">
              {mostRecentJob ? (
                <Row
                  title={serviceNames[mostRecentJob.serviceId] ?? "Service"}
                  detail={formatDate(mostRecentJob.sealedAt ?? mostRecentJob.createdAt)}
                  trailing={<Chip label={mostRecentJob.status.replace(/_/g, " ")} />}
                  last
                />
              ) : (
                <T tone="tertiary">No service history yet</T>
              )}
            </Pane>
          </View>

          <View style={{ gap: space.line }}>
            <Kicker>Upcoming booking</Kicker>
            <Pane pad="gap">
              {upcomingBooking ? (
                <>
                  <Row
                    title={`${formatDate(upcomingBooking.scheduledDate)} at ${upcomingBooking.scheduledTime}`}
                    onPress={() => router.push(`/(tabs)/bookings/${upcomingBooking.id}`)}
                    last
                  />
                  {upcomingBooking.membershipDiscountApplied ? (
                    <T role="caption" tone="accent">Membership benefit applies to this booking</T>
                  ) : null}
                </>
              ) : (
                <T tone="tertiary">No upcoming booking</T>
              )}
            </Pane>
          </View>

          {vehicle && editing ? (
            <View style={{ borderRadius: 20, overflow: "hidden" }}>
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
                  {createElement("input", {
                    type: "file",
                    accept: "image/jpeg,image/png,image/webp",
                    onChange: (e: { target: { files: unknown } }) => {
                      const files = e.target.files as { item: (i: number) => { type?: string } | null } | null;
                      const f = files?.item(0) ?? null;
                      if (f && f.type && ["image/jpeg", "image/png", "image/webp"].includes(f.type)) setNewPhoto({ blob: f as unknown as Blob, contentType: f.type, previewUrl: URL.createObjectURL(f as unknown as Blob) });
                      else setNewPhoto(null);
                    },
                  })}
                  <T role="caption" tone="tertiary">{newPhoto ? "New photo ready. It uploads when you save." : "Choose a JPEG, PNG or WebP to replace the photo."}</T>
                </View>
              ) : null}
              <Field label="Make" value={form.make} onChangeText={(v) => setForm((p) => ({ ...p, make: v }))} autoCapitalize="words" />
              <Field label="Model" value={form.model} onChangeText={(v) => setForm((p) => ({ ...p, model: v }))} autoCapitalize="words" />
              <Field label="Colour" value={form.color} onChangeText={(v) => setForm((p) => ({ ...p, color: v }))} autoCapitalize="words" />
              <Field label="Odometer (km)" value={form.odometer} onChangeText={(v) => setForm((p) => ({ ...p, odometer: v }))} keyboardType="numeric" />
              <View style={{ gap: space.breath }}>
                <Button label="Save changes" busy={saving} onPress={() => void handleSave()} />
                <Button label="Cancel" kind="quiet" onPress={() => { setNewPhoto(null); setEditing(false); }} />
              </View>
            </View>
          ) : (
            <Pane pad="gap">
              <Row title="Colour" detail={vehicle.color} />
              {vehicle.odometer !== null ? (
                <Row title="Odometer" detail={`${vehicle.odometer?.toLocaleString("en-IN")} km`} last />
              ) : <Row title="" detail="" last />}
            </Pane>
          )}

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

      {tab === "passport" ? (
        jobs.length === 0 ? (
          <Notice title="No service history yet" body="Service visits and updates for this car will appear here." />
        ) : (
          <Pane pad="gap">
            {jobs.map((job, i) => (
              <Row
                key={job.id}
                title={serviceNames[job.serviceId] ?? "Service"}
                detail={formatDate(job.sealedAt ?? job.createdAt)}
                trailing={<Chip label={job.status.replace(/_/g, " ")} />}
                onPress={job.bookingId ? () => router.push(`/(tabs)/bookings/${job.bookingId}`) : undefined}
                last={i === jobs.length - 1}
              />
            ))}
          </Pane>
        )
      ) : null}

      {tab === "protection" ? (
        <>
          {papers.length === 0 && protections.length === 0 ? (
            <Notice title="No documents yet" body="Add your RC, insurance, PUC or FASTag. The studio checks each one and marks it verified." />
          ) : (
            <Pane pad="gap">
              {papers.map((p, i) => {
                const left = daysUntil(p.expiresOn);
                const expiry = left === null ? null : left < 0 ? "Expired" : left === 0 ? "Expires today" : `${left} day${left === 1 ? "" : "s"} left`;
                return (
                  <Row
                    key={p.id}
                    title={PROTECTION_KIND_LABELS[p.kind.toLowerCase()] ?? p.kind}
                    detail={[p.reference, expiry].filter(Boolean).join(" · ")}
                    trailing={<Chip label={p.status === "VERIFIED" ? "Verified" : p.status === "REJECTED" ? "Rejected" : "Pending"} tone={p.status === "VERIFIED" ? "premium" : "neutral"} />}
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
                {(["RC", "INSURANCE", "PUC", "FASTAG", "OTHER"] as const).map((k) => (
                  <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: docForm.kind === k }} onPress={() => setDocForm((f) => ({ ...f, kind: k }))}>
                    <Chip label={k === "FASTAG" ? "FASTag" : k === "OTHER" ? "Other" : k === "RC" ? "RC" : k === "PUC" ? "PUC" : "Insurance"} tone={docForm.kind === k ? "premium" : "neutral"} />
                  </Pressable>
                ))}
              </View>
              <Field label="Document or policy number" value={docForm.reference} onChangeText={(v: string) => setDocForm((f) => ({ ...f, reference: v }))} />
              <Field label="Expiry date (YYYY-MM-DD, optional)" value={docForm.expiresOn} onChangeText={(v: string) => setDocForm((f) => ({ ...f, expiresOn: v }))} />
              {Platform.OS === "web" ? (
                <View style={{ gap: space.hair }}>
                  <Kicker>Photo or scan (optional)</Kicker>
                  {createElement("input", {
                    type: "file",
                    accept: "image/jpeg,image/png,image/webp",
                    onChange: (e: { target: { files: unknown } }) => {
                      const files = e.target.files as { item: (i: number) => { type?: string } | null } | null;
                      const f = files?.item(0) ?? null;
                      if (f && f.type && ["image/jpeg", "image/png", "image/webp"].includes(f.type)) setDocPhoto({ blob: f as unknown as Blob, contentType: f.type });
                      else setDocPhoto(null);
                    },
                  })}
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
                    {w.coverageTerms ? <T role="caption" tone="secondary">{w.coverageTerms}</T> : null}
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
