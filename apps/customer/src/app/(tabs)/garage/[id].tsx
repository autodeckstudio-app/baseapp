import { useState, useEffect } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import type { Vehicle, ServiceJob, Protection, Warranty, Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Chip, Field, Kicker, Loading, Notice, Pane, Plate, Row, Screen, T } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { updateVehicle, archiveVehicle } from "../../../lib/vehicle-service";
import { listenToJobsForVehicle } from "../../../lib/job-service";
import { listenToVehicleProtections } from "../../../lib/protection-service";
import { listenToVehicleWarranties } from "../../../lib/warranty-service";
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
  { key: "passport", label: "Passport" },
  { key: "protection", label: "Protection" },
  { key: "warranty", label: "Warranty" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auth = useAuth();
  const { colors } = useExperienceTheme();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ make: "", model: "", color: "", odometer: "" });
  const [tab, setTab] = useState<TabKey>("overview");
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [protections, setProtections] = useState<Protection[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [upcomingBooking, setUpcomingBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!id) return;
    const ref = doc(db, COLLECTIONS.vehicles(), id);
    const unsubscribe = onSnapshot(ref, (snap) => {
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

  return (
    <Screen
      header={
        <View style={{ gap: space.breath }}>
          <View style={{ gap: space.hair }}>
            <Kicker tone="accent">Vehicle room</Kicker>
            <T role="title">{vehicle.year} {vehicle.make} {vehicle.model}</T>
            <Plate value={vehicle.registrationNumber} />
          </View>
          <View style={{ flexDirection: "row", gap: space.inset }}>
            {TABS.map((t) => {
              const selected = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setTab(t.key)}
                  style={{ paddingVertical: space.breath, borderBottomWidth: 2, borderBottomColor: selected ? colors.accent : "transparent" }}
                >
                  <T role="label" tone={selected ? "accent" : "tertiary"}>{t.label}</T>
                </Pressable>
              );
            })}
          </View>
        </View>
      }
    >
      {tab === "overview" ? (
        <>
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

          {editing ? (
            <View style={{ gap: space.line }}>
              <Field label="Make" value={form.make} onChangeText={(v) => setForm((p) => ({ ...p, make: v }))} autoCapitalize="words" />
              <Field label="Model" value={form.model} onChangeText={(v) => setForm((p) => ({ ...p, model: v }))} autoCapitalize="words" />
              <Field label="Colour" value={form.color} onChangeText={(v) => setForm((p) => ({ ...p, color: v }))} autoCapitalize="words" />
              <Field label="Odometer (km)" value={form.odometer} onChangeText={(v) => setForm((p) => ({ ...p, odometer: v }))} keyboardType="numeric" />
              <View style={{ gap: space.breath }}>
                <Button label="Save changes" busy={saving} onPress={() => void handleSave()} />
                <Button label="Cancel" kind="quiet" onPress={() => setEditing(false)} />
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
          <Notice title="No service history yet" body="Completed services for this car will appear here." />
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
        protections.length === 0 ? (
          <Notice title="No protections on file" body="Insurance, FastTag, PUC and RC records verified by the studio will appear here." />
        ) : (
          <Pane pad="gap">
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
        )
      ) : null}

      {tab === "warranty" ? (
        warranties.length === 0 ? (
          <Notice title="No warranties yet" body="Warranties are issued automatically when an eligible service is completed." />
        ) : (
          <Pane pad="gap">
            {warranties.map((w, i) => (
              <Row
                key={w.id}
                title={w.warrantyLabel}
                detail={`${w.serviceName} · Issued ${formatDate(w.startDate)}`}
                trailing={<Chip label={w.revokedAt ? "Revoked" : "Active"} tone={w.revokedAt ? "danger" : "premium"} />}
                last={i === warranties.length - 1}
              />
            ))}
          </Pane>
        )
      ) : null}
    </Screen>
  );
}
