import { useState, useEffect } from "react";
import { View, Text, FlatList, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { listenToJobsByDate } from "../../lib/studio-service";
import type { ServiceJob } from "@autodeck/core";
import { colors, spacing, typography, JobCard, Button, EmptyState, LoadingState } from "@autodeck/ui";

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

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
      data={activeJobs}
      keyExtractor={(j) => j.id}
      ListHeaderComponent={
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
          <Text style={{ ...typography.title, color: colors.textPrimary }}>
            Today — {todayIST()} ({activeJobs.length} job{activeJobs.length !== 1 ? "s" : ""})
          </Text>
          <Button label="+ Walk-in" size="md" fullWidth={false} onPress={() => router.push("/(tabs)/walkin")} />
        </View>
      }
      ListEmptyComponent={<EmptyState title="No active jobs today" fill={false} />}
      renderItem={({ item }) => (
        <JobCard job={item} viewDate={todayIST()} onPress={() => router.push(`/(tabs)/jobs/${item.id}`)} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
    />
  );
}
