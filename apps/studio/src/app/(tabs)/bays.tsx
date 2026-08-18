import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { COLLECTIONS } from "@autodeck/database";
import { listenToJobsByDate, getStudioConfig } from "../../lib/studio-service";
import { listenToPendingApprovalsForStudio, getActiveServices } from "../../lib/approval-service";
import type { ServiceJob, StudioConfig, Bay, ApprovalRequest, Vehicle, Customer, BayType } from "@autodeck/core";
import { colors, spacing, radius, typography, Button, StatusBadge, statusTone, LoadingState } from "@autodeck/ui";
import { useAuth } from "../../hooks/useAuth";

const BAY_TYPE_LABELS: Record<BayType, string> = {
  wash: "Washing",
  protection: "Protection & Detailing",
  general: "General",
};

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const ACTIVE_STATUSES: ServiceJob["status"][] = [
  "PENDING_VEHICLE",
  "VEHICLE_RECEIVED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "READY_FOR_DELIVERY",
];

export default function BayBoardScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [vehicleLabels, setVehicleLabels] = useState<Record<string, string>>({});
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const studioId = auth.status === "ready" ? auth.claims.studioId : null;

  useEffect(() => {
    if (!studioId) return;
    void getStudioConfig(studioId).then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, [studioId]);

  useEffect(() => {
    if (auth.status !== "ready" || !studioId) return undefined;
    return listenToJobsByDate(auth.claims.tenantId, studioId, todayIST(), setJobs, () => undefined);
  }, [auth.status, studioId]);

  useEffect(() => {
    if (auth.status !== "ready" || !studioId) return undefined;
    return listenToPendingApprovalsForStudio(auth.claims.tenantId, studioId, setPendingApprovals, () => undefined);
  }, [auth.status, studioId]);

  useEffect(() => {
    void getActiveServices().then((services) => {
      const map: Record<string, string> = {};
      for (const s of services) map[s.id] = s.name;
      setServiceNames(map);
    });
  }, []);

  // Lazily resolve vehicle/customer display labels for whichever jobs are
  // currently occupying a bay — small dataset (today's active jobs only).
  useEffect(() => {
    const occupying = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
    const missingVehicleIds = [...new Set(occupying.map((j) => j.vehicleId))].filter((id) => !(id in vehicleLabels));
    const missingCustomerIds = [...new Set(occupying.map((j) => j.customerId))].filter(
      (id) => !(id in customerNames),
    );
    if (missingVehicleIds.length === 0 && missingCustomerIds.length === 0) return;

    void Promise.all([
      Promise.all(
        missingVehicleIds.map(async (id) => {
          const snap = await getDoc(doc(db, COLLECTIONS.vehicles(), id));
          if (!snap.exists()) return [id, "Vehicle"] as const;
          const v = snap.data() as Vehicle;
          return [id, `${v.make} ${v.model}`] as const;
        }),
      ),
      Promise.all(
        missingCustomerIds.map(async (id) => {
          const snap = await getDoc(doc(db, COLLECTIONS.customers(), id));
          if (!snap.exists()) return [id, "Customer"] as const;
          const c = snap.data() as Customer;
          return [id, c.name] as const;
        }),
      ),
    ]).then(([vehiclePairs, customerPairs]) => {
      if (vehiclePairs.length > 0) setVehicleLabels((prev) => ({ ...prev, ...Object.fromEntries(vehiclePairs) }));
      if (customerPairs.length > 0) setCustomerNames((prev) => ({ ...prev, ...Object.fromEntries(customerPairs) }));
    });
  }, [jobs]);

  if (loading) return <LoadingState />;
  if (!config) return <LoadingState label="Loading studio configuration…" />;

  const groups = new Map<BayType, Bay[]>();
  for (const bay of config.bays) {
    const list = groups.get(bay.bayType) ?? [];
    list.push(bay);
    groups.set(bay.bayType, list);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
          <Text style={{ ...typography.heading, color: colors.textPrimary }}>Bay Board</Text>
          <Button label="+ New Walk-in" size="md" onPress={() => router.push("/(tabs)/walkin")} />
        </View>

        {[...groups.entries()].map(([bayType, bays]) => (
          <View key={bayType} style={{ marginBottom: spacing.xl }}>
            <Text style={sectionTitle}>
              {BAY_TYPE_LABELS[bayType] ?? bayType} ({bays.length})
            </Text>
            {bays.map((bay) => {
              const job = jobs.find((j) => j.bayId === bay.id && ACTIVE_STATUSES.includes(j.status));
              const hasPendingApproval = job ? pendingApprovals.some((a) => a.jobId === job.id) : false;

              if (!bay.active) {
                return (
                  <View
                    key={bay.id}
                    style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}
                  >
                    <Text style={{ ...typography.bodyMedium, color: colors.textMuted }}>{bay.name}</Text>
                    <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>Inactive</Text>
                  </View>
                );
              }

              if (!job) {
                return (
                  <TouchableOpacity
                    key={bay.id}
                    onPress={() => router.push({ pathname: "/(tabs)/walkin", params: { bayId: bay.id } })}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: radius.lg,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderStyle: "dashed",
                    }}
                  >
                    <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{bay.name}</Text>
                    <StatusBadge label="Available" tone="success" />
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={bay.id}
                  onPress={() => router.push(`/(tabs)/jobs/${job.id}`)}
                  style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{bay.name}</Text>
                      <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs }}>
                        {vehicleLabels[job.vehicleId] ?? "…"} · {customerNames[job.customerId] ?? "…"}
                      </Text>
                      <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>
                        {serviceNames[job.serviceId] ?? "Service"}
                        {job.isWalkIn ? " · Walk-in" : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: spacing.xxs }}>
                      <StatusBadge label={job.status.replace(/_/g, " ")} tone={statusTone(job.status)} />
                      <StatusBadge label={job.paymentStatus} tone={statusTone(job.paymentStatus)} />
                      {hasPendingApproval && <StatusBadge label="Approval pending" tone="warning" />}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const sectionTitle = { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm } as const;
