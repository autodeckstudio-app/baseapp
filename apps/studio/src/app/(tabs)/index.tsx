import { useState, useEffect } from "react";
import { View, Text, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { listenToJobsByDate, listenToStandby } from "../../lib/studio-service";
import type { ServiceJob } from "@autodeck/core";
import { colors, spacing, radius, typography, JobCard, LoadingState, ErrorState, Button } from "@autodeck/ui";
import { Icon, FadeUp } from "@autodeck/ui/native";
import { useJobLabels } from "../../hooks/useBayNames";

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

  const labels = useJobLabels(studioId);
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
  if (loading || !queueReady) return <LoadingState label="Loading studio floor" />;

  const activeJobs = jobs.filter((j) => j.status !== "STANDBY" && j.status !== "DELIVERED" && j.status !== "CANCELLED");

  const ready = activeJobs.filter((j) => j.status === "READY_FOR_DELIVERY").length;
  const inProgress = activeJobs.filter((j) => j.status === "IN_PROGRESS" || j.status === "QUALITY_CHECK").length;
  const longDate = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });

  const Stat = ({ label, value }: { label: string; value: number }) => (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md }}>
      <Text style={{ fontSize: 28, fontWeight: "700", color: colors.textPrimary }}>{value}</Text>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>{label}</Text>
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, flexGrow: 1, width: "100%", maxWidth: 640, alignSelf: "center" }}
      data={activeJobs}
      keyExtractor={(j) => j.id}
      ListHeaderComponent={
        <View style={{ marginBottom: spacing.lg, gap: spacing.md }}>
          <View>
            <Text style={{ ...typography.caption, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Today</Text>
            <Text style={{ fontSize: 26, fontWeight: "700", color: colors.textPrimary }}>{longDate}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Stat label="On the floor" value={activeJobs.length} />
            <Stat label="In progress" value={inProgress} />
            <Stat label="Ready" value={ready} />
          </View>
          {standby.length > 0 && <View style={{gap: spacing.sm}}>
            <Text style={{...typography.title, color: colors.textPrimary}}>Arrived - standby ({standby.length})</Text>
            <Text style={{...typography.caption, color: colors.textMuted}}>Waiting in arrival order. No bay or time reserved. Open the next car to admit when a compatible bay is free.</Text>
            {standby.length === 0 ? <Text style={{color: colors.textMuted}}>No cars waiting.</Text> : standby.map(j => <JobCard key={j.id} job={j} serviceName={labels.services[j.serviceId]} onPress={() => router.push(`/(tabs)/jobs/${j.id}`)} />)}
          </View>}
          <Button label="New walk-in" onPress={() => router.push("/(tabs)/walkin")} fullWidth />
        </View>
      }
      ListEmptyComponent={
        <View style={{ alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(240,125,40,0.14)" }}>
            <Icon name="check" color={colors.accent} size={28} />
          </View>
          <Text style={{ ...typography.title, color: colors.textPrimary }}>All clear</Text>
          <Text style={{ ...typography.body, color: colors.textMuted, textAlign: "center" }}>No cars on the floor right now. New bookings and walk-ins show up here.</Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <FadeUp delay={Math.min(index, 5) * 50}>
          <JobCard job={item} viewDate={todayIST()} bayName={labels.bays[item.bayId]} serviceName={labels.services[item.serviceId]} onPress={() => router.push(`/(tabs)/jobs/${item.id}`)} />
        </FadeUp>
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
    />
  );
}
