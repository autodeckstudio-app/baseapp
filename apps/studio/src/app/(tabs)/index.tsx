import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { listenToJobsByDate } from "../../lib/studio-service";
import type { ServiceJob } from "@autodeck/core";
import { FIRST_STUDIO_ID } from "@autodeck/core";

const JOB_STATUS_LABELS: Record<string, string> = {
  PENDING_VEHICLE: "Awaiting Vehicle",
  VEHICLE_RECEIVED: "Vehicle In",
  IN_PROGRESS: "In Progress",
  QUALITY_CHECK: "QC",
  READY_FOR_DELIVERY: "Ready",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_VEHICLE: "#f0a500",
  VEHICLE_RECEIVED: "#2196f3",
  IN_PROGRESS: "#9c27b0",
  QUALITY_CHECK: "#ff9800",
  READY_FOR_DELIVERY: "#4caf50",
  DELIVERED: "#757575",
  CANCELLED: "#bdbdbd",
};

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function JobCard({ job, onPress }: { job: ServiceJob; onPress: () => void }) {
  const statusLabel = JOB_STATUS_LABELS[job.status] ?? job.status;
  const statusColor = STATUS_COLORS[job.status] ?? "#666";
  const time = new Date(job.scheduledAt).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTime}>{time}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={styles.cardVehicle}>Bay: {job.bayId}</Text>
      <Text style={styles.cardNote} numberOfLines={1}>
        {job.studioNotes ?? "No notes"}
      </Text>
      {job.isWalkIn && (
        <View style={styles.walkInBadge}>
          <Text style={styles.walkInText}>Walk-in</Text>
        </View>
      )}
    </TouchableOpacity>
  );
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const activeJobs = jobs.filter((j) => j.status !== "DELIVERED" && j.status !== "CANCELLED");

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={activeJobs}
      keyExtractor={(j) => j.id}
      ListHeaderComponent={
        <Text style={styles.heading}>
          Today — {todayIST()} ({activeJobs.length} job{activeJobs.length !== 1 ? "s" : ""})
        </Text>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No active jobs today.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <JobCard job={item} onPress={() => router.push(`/(tabs)/jobs/${item.id}`)} />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  heading: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e8e8e8",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTime: { fontSize: 16, fontWeight: "600" },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  cardVehicle: { fontSize: 14, color: "#444", marginBottom: 4 },
  cardNote: { fontSize: 13, color: "#888" },
  walkInBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#fff3e0",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  walkInText: { fontSize: 11, color: "#f57c00", fontWeight: "600" },
  separator: { height: 10 },
  empty: { paddingTop: 40, alignItems: "center" },
  emptyText: { color: "#888", fontSize: 16 },
});
