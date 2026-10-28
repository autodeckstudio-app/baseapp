import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, floatCard } from "@autodeck/ui/theme";
import { CanvasBackdrop, CanvasTitle } from "../../components/CanvasTitle";
import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { COLLECTIONS } from "@autodeck/database";
import { listenToJobsByDate, getStudioConfig } from "../../lib/studio-service";
import { listenToPendingApprovalsForStudio, getActiveServices } from "../../lib/approval-service";
import { jobHoldsBay, visitTiming, hasTimingLabel } from "@autodeck/core";
import type { ServiceJob, StudioConfig, Bay, ApprovalRequest, Vehicle, Customer, BayType } from "@autodeck/core";
import { colors, spacing, radius, typography, Button, StatusBadge, statusTone, LoadingState, ErrorState, jobStatusLabel } from "@autodeck/ui";
import { useMinuteNow } from "@autodeck/ui/clock";
import { useAuth } from "../../hooks/useAuth";
import { bayOccupancy } from "../../lib/bay-holders";

const BAY_TYPE_LABELS: Record<BayType, string> = {
  wash: "Washing",
  protection: "Protection & Detailing",
  general: "General",
};

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}


export default function BayBoardScreen() {
  // Re-check bay occupancy every minute: a no-show frees its bay when the slot end passes.
  const tickNow = useMinuteNow();
  const auth = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [vehicleLabels, setVehicleLabels] = useState<Record<string, string>>({});
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [jobsReady, setJobsReady] = useState(false);
  const [approvalsReady, setApprovalsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const studioId = auth.status === "ready" ? auth.claims.studioId : null;

  useEffect(() => {
    if (!studioId) return;
    setLoading(true); setError(null);
    void getStudioConfig(studioId).then((c) => {
      setConfig(c);
      setLoading(false);
    }).catch((err: Error) => { setError(err.message); setLoading(false); });
  }, [studioId, attempt]);

  useEffect(() => {
    if (auth.status !== "ready" || !studioId) return undefined;
    setJobsReady(false);
    return listenToJobsByDate(auth.claims.tenantId, studioId, todayIST(), data => { setJobs(data); setJobsReady(true); }, err => setError(err.message));
  }, [auth.status, studioId, attempt]);

  useEffect(() => {
    if (auth.status !== "ready" || !studioId) return undefined;
    setApprovalsReady(false);
    return listenToPendingApprovalsForStudio(auth.claims.tenantId, studioId, data => { setPendingApprovals(data); setApprovalsReady(true); }, err => setError(err.message));
  }, [auth.status, studioId, attempt]);

  useEffect(() => {
    void getActiveServices().then((services) => {
      const map: Record<string, string> = {};
      for (const s of services) map[s.id] = s.name;
      setServiceNames(map);
    }).catch(() => undefined);
  }, []);

  // Lazily resolve vehicle/customer display labels for whichever jobs are
  // currently occupying a bay — small dataset (today's active jobs only).
  useEffect(() => {
    const occupying = jobs.filter((j) => jobHoldsBay(j));
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
    }).catch((err: Error) => setError(err.message));
  }, [jobs]);

  if (error) return <ErrorState title="Bay board unavailable" message={error} onRetry={() => setAttempt(n => n + 1)} />;
  if (loading || !jobsReady || !approvalsReady) return <LoadingState label="Loading bays and current work" />;
  if (!config) return <ErrorState title="Studio not configured" message="The studio configuration is missing. Ask the owner to set up bays." onRetry={() => setAttempt(n => n + 1)} />;

  const groups = new Map<BayType, Bay[]>();
  for (const bay of config.bays) {
    const list = groups.get(bay.bayType) ?? [];
    list.push(bay);
    groups.set(bay.bayType, list);
  }

  return (
    <View style={{ flex: 1 }}>
      <CanvasBackdrop />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, width: "100%", maxWidth: 1040, alignSelf: "center" }}>
        <CanvasTitle eyebrow="Studio floor" title="Bays" />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>{jobs.filter((j) => jobHoldsBay(j)).length} on the floor</Text>
          <Button label="New walk-in" size="md" onPress={() => router.push("/(tabs)/walkin")} />
        </View>

        {[...groups.entries()].map(([bayType, bays]) => (
          <View key={bayType} style={{ marginBottom: spacing.xl }}>
            <Text style={sectionTitle}>
              {BAY_TYPE_LABELS[bayType] ?? bayType} ({bays.length})
            </Text>
            {bays.map((bay) => {
              const occupancy = bayOccupancy(jobs, bay.id, tickNow);
              const job = occupancy.jobs[0];

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
                      backgroundColor: colors.surface, ...(NightPlatform.OS === "web" ? floatCard(nightMaterial) : {}),
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
                <View key={bay.id} style={occupancy.conflict ? { marginBottom: spacing.sm, borderRadius: 28, borderWidth: 2, borderColor: colors.border, padding: spacing.xs } : undefined}>
                  {occupancy.conflict && (
                    <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
                      <StatusBadge label={`${occupancy.jobs.length} jobs in this bay`} tone="warning" />
                      <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs }}>
                        More than one job is marked as in this bay. Open each job to check. Nothing was changed automatically.
                      </Text>
                    </View>
                  )}
                  {occupancy.jobs.map((j) => {
                    const hasPendingApproval = pendingApprovals.some((a) => a.jobId === j.id);
                    return (
                      <TouchableOpacity
                        key={j.id}
                        onPress={() => router.push(`/(tabs)/jobs/${j.id}`)}
                        style={{ backgroundColor: colors.surface, ...(NightPlatform.OS === "web" ? floatCard(nightMaterial) : {}), borderRadius: 28, padding: spacing.md, marginBottom: occupancy.conflict ? spacing.xs : spacing.sm }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{bay.name}</Text>
                            <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs }}>
                              {vehicleLabels[j.vehicleId] ?? "…"} · {customerNames[j.customerId] ?? "…"}
                            </Text>
                            <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>
                              {serviceNames[j.serviceId] ?? "Service"}
                              {j.isWalkIn ? " · Walk-in" : ""}
                              {j.scheduledDate !== todayIST() ? ` · since ${j.scheduledDate}` : ""}
                              {j.scheduledDate !== j.estimatedEndDate ? ` · until ${j.estimatedEndDate}` : ""}
                          {occupancy.conflict ? ` · slot ${new Date(j.scheduledAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: spacing.xxs }}>
                            <StatusBadge label={jobStatusLabel(j.status)} tone={statusTone(j.status)} />
                            <StatusBadge label={j.paymentStatus} tone={statusTone(j.paymentStatus)} />
                            {hasTimingLabel(visitTiming(j, tickNow)) && <StatusBadge label={visitTiming(j, tickNow).label} tone={visitTiming(j, tickNow).tone} />}
                      {hasPendingApproval && <StatusBadge label="Approval pending" tone="warning" />}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const sectionTitle = { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm } as const;
