import { useState, useEffect } from "react";
import { View, Text, FlatList, Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { listenToJobsByDate } from "../../lib/studio-service";
import type { ServiceJob } from "@autodeck/core";
import { colors, spacing, radius, typography, JobCard, LoadingState } from "@autodeck/ui";
import { Icon } from "@autodeck/ui/native";

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default function TodaysJobsScreen() {
  const router = useRouter();
  const authState = useAuth();
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const studioId = authState.status === "ready" ? authState.claims.studioId : null;
  const tenantId = authState.status === "ready" ? authState.claims.tenantId : null;

  useEffect(() => {
    if (!studioId || !tenantId) return undefined;
    const unsub = listenToJobsByDate(
      tenantId,
      studioId,
      todayIST(),
      (data) => {
        setJobs(data);
        setLoading(false);
      },
      (err) => {
        Alert.alert("Error", err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [studioId, tenantId]);

  if (loading) return <LoadingState />;

  const activeJobs = jobs.filter((j) => j.status !== "DELIVERED" && j.status !== "CANCELLED");

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
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, flexGrow: 1, width: "100%", maxWidth: 640, alignSelf: "center" }}
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
          <Pressable
            onPress={() => router.push("/(tabs)/walkin")}
            accessibilityRole="button"
            accessibilityLabel="New walk-in"
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.accent, borderRadius: radius.lg, minHeight: 52 }}
          >
            <Icon name="plus" color="#FFFFFF" size={22} />
            <Text style={{ ...typography.body, color: "#FFFFFF", fontWeight: "700" }}>New walk-in</Text>
          </Pressable>
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
      renderItem={({ item }) => (
        <JobCard job={item} viewDate={todayIST()} onPress={() => router.push(`/(tabs)/jobs/${item.id}`)} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
    />
  );
}
