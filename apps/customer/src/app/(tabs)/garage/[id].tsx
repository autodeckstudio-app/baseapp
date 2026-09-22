import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import type { Vehicle, ServiceJob, Protection, Warranty, Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { projectVisitTimeline } from "@autodeck/experience";
import {
  colors,
  spacing,
  radius,
  typography,
  TextInput,
  Button,
  ListRow,
  Divider,
  Tabs,
  StatusBadge,
  statusTone,
  EmptyState,
  LoadingState,
  ErrorState,
  formatDateShort,
} from "@autodeck/ui";
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

function Section({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }}>
      {children}
    </View>
  );
}

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auth = useAuth();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ make: "", model: "", color: "", odometer: "" });
  const [tab, setTab] = useState<TabKey>("overview");

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
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  function handleArchive() {
    Alert.alert("Remove Vehicle", "Remove this vehicle from your garage?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          if (!id) return;
          try {
            await archiveVehicle(id);
            router.back();
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Failed to remove.");
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingState />;
  if (!vehicle) return <ErrorState title="Vehicle not found" />;

  const verifiedProtections = protections.filter((p) => p.status === "verified");
  const activeWarranties = warranties.filter((w) => w.revokedAt === null);
  const mostRecentJob = jobs[0] ?? null;
  const visitTimeline = mostRecentJob ? projectVisitTimeline(mostRecentJob) : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.xl, paddingBottom: spacing.md }}>
        <Text style={{ ...typography.caption, color: colors.textMuted, letterSpacing: 1 }}>{vehicle.registrationNumber}</Text>
        <Text style={{ ...typography.heading, color: colors.textPrimary, marginBottom: spacing.md }}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </Text>
        <Tabs
          items={[
            { key: "overview", label: "Overview" },
            { key: "passport", label: "Passport" },
            { key: "protection", label: "Protection" },
            { key: "warranty", label: "Warranty" },
          ]}
          selectedKey={tab}
          onSelect={(k) => setTab(k as TabKey)}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}>
        {tab === "overview" && (
          <>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Section>
                  <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs }}>Protection</Text>
                  {verifiedProtections.length > 0 ? (
                    <StatusBadge label={`${verifiedProtections.length} verified`} tone="success" />
                  ) : (
                    <Text style={{ ...typography.captionMedium, color: colors.textMuted }}>None on file</Text>
                  )}
                </Section>
              </View>
              <View style={{ flex: 1 }}>
                <Section>
                  <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs }}>Warranty</Text>
                  {activeWarranties.length > 0 ? (
                    <StatusBadge label={`${activeWarranties.length} active`} tone="success" />
                  ) : (
                    <Text style={{ ...typography.captionMedium, color: colors.textMuted }}>None active</Text>
                  )}
                </Section>
              </View>
            </View>

            <Text style={sectionTitle}>Recent Service</Text>
            <Section>
              {mostRecentJob ? (
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
                      {serviceNames[mostRecentJob.serviceId] ?? "Service"}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>
                      {formatDateShort(mostRecentJob.sealedAt ?? mostRecentJob.createdAt)}
                    </Text>
                  </View>
                  <StatusBadge label={mostRecentJob.status.replace(/_/g, " ")} tone={statusTone(mostRecentJob.status)} />
                </View>
              ) : (
                <Text style={{ ...typography.body, color: colors.textMuted }}>No service history yet</Text>
              )}
            </Section>

            {mostRecentJob && mostRecentJob.status !== "DELIVERED" && (
              <>
                <Text style={sectionTitle}>Live Visit</Text>
                <Section>
                  {visitTimeline.map((step, index) => (
                    <View key={step.status} style={{ flexDirection: "row", minHeight: 44 }}>
                      <View style={{ width: 20, alignItems: "center" }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: step.state === "upcoming" ? colors.border : colors.accent }} />
                        {index < visitTimeline.length - 1 && <View style={{ width: 1, flex: 1, backgroundColor: step.state === "reached" ? colors.accent : colors.border }} />}
                      </View>
                      <View style={{ flex: 1, paddingLeft: spacing.sm, paddingBottom: spacing.sm }}>
                        <Text style={{ ...typography.bodyMedium, color: step.state === "upcoming" ? colors.textMuted : colors.textPrimary }}>{step.label}</Text>
                        {step.changedAt && <Text style={{ ...typography.caption, color: colors.textMuted }}>{formatDateShort(step.changedAt)}</Text>}
                      </View>
                    </View>
                  ))}
                </Section>
              </>
            )}

            <Text style={sectionTitle}>Upcoming Booking</Text>
            <Section>
              {upcomingBooking ? (
                <View>
                  <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
                    {formatDateShort(upcomingBooking.scheduledDate)} at {upcomingBooking.scheduledTime}
                  </Text>
                  {upcomingBooking.membershipDiscountApplied && (
                    <Text style={{ ...typography.caption, color: colors.accent, marginTop: spacing.xs }}>
                      Membership benefit applies to this booking
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={{ ...typography.body, color: colors.textMuted }}>No upcoming booking</Text>
              )}
            </Section>

            {editing ? (
              <Section>
                <TextInput label="Make" value={form.make} onChangeText={(v) => setForm((p) => ({ ...p, make: v }))} autoCapitalize="words" />
                <TextInput label="Model" value={form.model} onChangeText={(v) => setForm((p) => ({ ...p, model: v }))} autoCapitalize="words" />
                <TextInput label="Color" value={form.color} onChangeText={(v) => setForm((p) => ({ ...p, color: v }))} autoCapitalize="words" />
                <TextInput
                  label="Odometer (km)"
                  value={form.odometer}
                  onChangeText={(v) => setForm((p) => ({ ...p, odometer: v }))}
                  keyboardType="numeric"
                />
                <Button label="Save Changes" onPress={() => void handleSave()} loading={saving} />
                <View style={{ height: spacing.sm }} />
                <Button label="Cancel" onPress={() => setEditing(false)} variant="ghost" />
              </Section>
            ) : (
              <Section>
                <ListRow label="Color" value={vehicle.color} />
                {vehicle.odometer !== null && (
                  <>
                    <Divider />
                    <ListRow label="Odometer" value={`${vehicle.odometer?.toLocaleString("en-IN")} km`} />
                  </>
                )}
              </Section>
            )}

            {!editing && (
              <>
                <Button label="Edit Vehicle" onPress={() => setEditing(true)} variant="secondary" />
                <View style={{ height: spacing.sm }} />
                <Button label="Remove from Garage" onPress={handleArchive} variant="destructive" />
              </>
            )}
          </>
        )}

        {tab === "passport" && (
          <>
            {jobs.length === 0 ? (
              <EmptyState title="No service history yet" message="Completed services for this vehicle will appear here." fill={false} />
            ) : (
              jobs.map((job) => {
                const row = (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
                        {serviceNames[job.serviceId] ?? "Service"}
                      </Text>
                      <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>
                        {formatDateShort(job.sealedAt ?? job.createdAt)}
                      </Text>
                    </View>
                    <StatusBadge label={job.status.replace(/_/g, " ")} tone={statusTone(job.status)} />
                  </View>
                );
                return job.bookingId ? (
                  <TouchableOpacity key={job.id} onPress={() => router.push(`/(tabs)/bookings/${job.bookingId}`)}>
                    <Section>{row}</Section>
                  </TouchableOpacity>
                ) : (
                  <Section key={job.id}>{row}</Section>
                );
              })
            )}
          </>
        )}

        {tab === "protection" && (
          <>
            {protections.length === 0 ? (
              <EmptyState title="No protections on file" message="Insurance, FastTag, PUC, and RC records verified by the studio will appear here." fill={false} />
            ) : (
              protections.map((p) => (
                <Section key={p.id}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
                        {PROTECTION_KIND_LABELS[p.kind] ?? p.kind}
                      </Text>
                      {p.provider !== null && (
                        <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>{p.provider}</Text>
                      )}
                      {p.expiryDate !== null && (
                        <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>
                          Expires {formatDateShort(p.expiryDate)}
                        </Text>
                      )}
                    </View>
                    <StatusBadge label={p.status} tone={statusTone(p.status)} />
                  </View>
                </Section>
              ))
            )}
          </>
        )}

        {tab === "warranty" && (
          <>
            {warranties.length === 0 ? (
              <EmptyState title="No warranties yet" message="Warranties are issued automatically when an eligible service is completed." fill={false} />
            ) : (
              warranties.map((w) => (
                <Section key={w.id}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{w.warrantyLabel}</Text>
                      <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>
                        {w.serviceName} · Issued {formatDateShort(w.startDate)}
                      </Text>
                    </View>
                    <StatusBadge label={w.revokedAt ? "Revoked" : "Active"} tone={w.revokedAt ? "error" : "success"} />
                  </View>
                </Section>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const sectionTitle = { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm } as const;
