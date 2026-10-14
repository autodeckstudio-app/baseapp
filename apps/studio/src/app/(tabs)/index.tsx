import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { floatCard } from "@autodeck/ui/theme";
import { useState, useEffect } from "react";
import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { listenToJobsByDate, listenToStandby } from "../../lib/studio-service";
import type { ServiceJob } from "@autodeck/core";
import { colors, spacing, radius, typography, JobCard, LoadingState, ErrorState, Button } from "@autodeck/ui";
import { Icon, FadeUp } from "@autodeck/ui/native";
import { useJobLabels } from "../../hooks/useBayNames";
import { useJobPeople } from "../../hooks/useJobPeople";

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default function TodaysJobsScreen() {
  const router = useRouter();
  const authState = useAuth();
  const [standby, setStandby] = useState<ServiceJob[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [queueReady, setQueueReady] = useState(false);
  const studioId = authState.status === "ready" ? authState.claims.studioId : null;
  const tenantId = authState.status === "ready" ? authState.claims.tenantId : null;

  const { width } = useWindowDimensions();
  const labels = useJobLabels(studioId);
  const people = useJobPeople([...jobs, ...standby]);
  useEffect(() => {
    if (!studioId || !tenantId) return undefined;
    setLoading(true); setQueueReady(false); setError(null);
    const unsub = listenToJobsByDate(
      tenantId,
      studioId,
      todayIST(),
      (data) => {
        setJobs(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message); setLoading(false);
      },
    );
    const queueUnsub = listenToStandby(tenantId, studioId, data => { setStandby(data); setQueueReady(true); }, err => { setError(err.message); setQueueReady(true); });
    return () => { unsub(); queueUnsub(); };
  }, [studioId, tenantId, attempt]);

  if (error) return <ErrorState title="Floor unavailable" message={error} onRetry={() => setAttempt(n => n + 1)} />;
  if (loading) return <LoadingState label="Loading studio floor" />;

  const activeJobs = jobs.filter((j) => j.status !== "STANDBY" && j.status !== "DELIVERED" && j.status !== "CANCELLED");

  const ready = activeJobs.filter((j) => j.status === "READY_FOR_DELIVERY").length;
  const inProgress = activeJobs.filter((j) => j.status === "IN_PROGRESS" || j.status === "QUALITY_CHECK").length;
  const longDate = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });

  const STATE: Record<string, string> = { PENDING_VEHICLE: "Expected", VEHICLE_RECEIVED: "Arrived", IN_PROGRESS: "Working", QUALITY_CHECK: "Finishing", READY_FOR_DELIVERY: "Ready" };
  const glass = { backgroundColor: colors.surface, ...(NightPlatform.OS === "web" ? floatCard(nightMaterial) : {}) };
  const Stat = ({ label, value }: { label: string; value: number }) => (
    <View style={{ flex: 1, ...glass, borderRadius: 20, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, alignItems: "center" }}>
      <Text style={{ fontSize: 34, fontWeight: "700", color: colors.textPrimary }}>{value}</Text>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>{label}</Text>
    </View>
  );
  const bayIds = Object.keys(labels.bays);
  const wide = width >= 900;
  const jobsList = (
    <View style={{ flex: 1, gap: spacing.sm }}>
      <Text style={{ ...typography.title, color: colors.textPrimary }}>On the floor</Text>
      {activeJobs.length === 0 ? (
        <View style={{ alignItems: "center", ...glass, borderRadius: 20, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <View style={{ width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(236,134,56,0.16)" }}>
            <Icon name="check" color={colors.accent} size={28} />
          </View>
          <Text style={{ ...typography.title, color: colors.textPrimary }}>All clear</Text>
          <Text style={{ ...typography.body, color: colors.textMuted, textAlign: "center" }}>No cars on the floor. Bookings and walk-ins land here the moment they arrive.</Text>
        </View>
      ) : activeJobs.map((item, index) => (
        <FadeUp key={item.id} delay={Math.min(index, 5) * 50}>
          <JobCard job={item} carName={people.car(item)} customerName={people.customer(item)} viewDate={todayIST()} bayName={labels.bays[item.bayId]} serviceName={labels.services[item.serviceId]} onPress={() => router.push(`/(tabs)/jobs/${item.id}`)} />
        </FadeUp>
      ))}
    </View>
  );
  const baysBoard = bayIds.length === 0 ? null : (
    <View style={{ width: wide ? 340 : "100%", gap: spacing.sm }}>
      <Text style={{ ...typography.title, color: colors.textPrimary }}>Bays</Text>
      {bayIds.map((id) => {
        const j = activeJobs.find((x) => x.bayId === id);
        const plate = j?.vehicleSnapshot?.registrationNumber;
        return (
          <View key={id} style={{ ...glass, borderRadius: 20, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, fontWeight: "600", color: colors.textPrimary }}>{labels.bays[id]}</Text>
              <Text style={{ ...typography.caption, color: colors.textMuted }} numberOfLines={1}>{j ? [plate, labels.services[j.serviceId]].filter(Boolean).join(" · ") || "In use" : "Free"}</Text>
            </View>
            <View style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, backgroundColor: j ? "rgba(236,134,56,0.18)" : "rgba(120,200,140,0.16)" }}>
              <Text style={{ ...typography.caption, color: j ? colors.accent : "#8fd4a0", fontWeight: "600" }}>{j ? STATE[j.status] ?? "Busy" : "Free"}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 130, flexGrow: 1, width: "100%", maxWidth: 1040, alignSelf: "center", gap: spacing.lg }}>
      <View style={{ flexDirection: wide ? "row" : "column", alignItems: wide ? "flex-end" : "flex-start", justifyContent: "space-between", gap: spacing.md, minHeight: wide ? 180 : 150 }}>
        <View style={{ justifyContent: "flex-end" }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1.6, fontWeight: "600" } as never}>{longDate}</Text>
          <Text style={{ fontSize: wide ? 72 : 56, lineHeight: wide ? 74 : 58, fontWeight: "500", letterSpacing: -3, color: colors.textPrimary } as never}>Today</Text>
        </View>
        <View style={{ width: wide ? 260 : "100%" }}>
          <Button label="New walk-in" onPress={() => router.push("/(tabs)/walkin")} fullWidth />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Stat label="On the floor" value={activeJobs.length} />
        <Stat label="In progress" value={inProgress} />
        <Stat label="Ready" value={ready} />
        <Stat label="Waiting" value={standby.length} />
      </View>
      {standby.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...typography.title, color: colors.textPrimary }}>Waiting for a bay ({standby.length})</Text>
          {standby.map((j) => <JobCard key={j.id} job={j} carName={people.car(j)} customerName={people.customer(j)} serviceName={labels.services[j.serviceId]} onPress={() => router.push(`/(tabs)/jobs/${j.id}`)} />)}
        </View>
      )}
      <View style={{ flexDirection: wide ? "row" : "column", gap: spacing.lg, alignItems: "flex-start" }}>
        {jobsList}
        {baysBoard}
      </View>
    </ScrollView>
    </View>
  );
}
