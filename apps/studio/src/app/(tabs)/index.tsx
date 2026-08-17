import { useState, useEffect } from "react";
import { View, Text, FlatList, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { listenToJobsByDate } from "../../lib/studio-service";
import type { ServiceJob } from "@autodeck/core";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { colors, spacing, typography, JobCard, EmptyState, LoadingState } from "@autodeck/ui";

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default function TodaysJobsScreen() {
  const router = useRouter();
  const authState = useAuth();
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const authReady = authState.status === "ready";

  useEffect(() => {
    if (!authReady) return;
    const today = todayIST();
    const unsub = listenToJobsByDate(
      FIRST_STUDIO_ID,
      today,
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
  }, [authReady]);

  if (loading) return <LoadingState />;

  const activeJobs = jobs.filter((j) => j.status !== "DELIVERED" && j.status !== "CANCELLED");

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
      data={activeJobs}
      keyExtractor={(j) => j.id}
      ListHeaderComponent={
        <Text style={{ ...typography.title, color: colors.textPrimary, marginBottom: spacing.md }}>
          Today — {todayIST()} ({activeJobs.length} job{activeJobs.length !== 1 ? "s" : ""})
        </Text>
      }
      ListEmptyComponent={<EmptyState title="No active jobs today" fill={false} />}
      renderItem={({ item }) => <JobCard job={item} onPress={() => router.push(`/(tabs)/jobs/${item.id}`)} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
    />
  );
}
