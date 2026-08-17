import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { listenToJobsByDate } from "../../lib/studio-service";
import type { ServiceJob } from "@autodeck/core";
import { FIRST_STUDIO_ID } from "@autodeck/core";

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function formatDisplayDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_VEHICLE: "#f0a500",
  VEHICLE_RECEIVED: "#2196f3",
  IN_PROGRESS: "#9c27b0",
  QUALITY_CHECK: "#ff9800",
  READY_FOR_DELIVERY: "#4caf50",
  DELIVERED: "#757575",
  CANCELLED: "#bdbdbd",
};

export default function CalendarScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(todayIST());
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);

  // Build the next 7 days for date picker
  const today = todayIST();
  const dateDays = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  useEffect(() => {
    setLoading(true);
    const unsub = listenToJobsByDate(
      FIRST_STUDIO_ID,
      selectedDate,
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
  }, [selectedDate]);

  return (
    <View style={styles.container}>
      {/* Date picker row */}
      <View style={styles.datePicker}>
        {dateDays.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.dateChip, selectedDate === d && styles.dateChipSelected]}
            onPress={() => setSelectedDate(d)}
          >
            <Text
              style={[styles.dateChipText, selectedDate === d && styles.dateChipTextSelected]}
            >
              {formatDisplayDate(d).split(", ")[0]}
            </Text>
            <Text
              style={[styles.dateChipSub, selectedDate === d && styles.dateChipTextSelected]}
            >
              {formatDisplayDate(d).split(", ")[1]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={jobs}
          keyExtractor={(j) => j.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No jobs on {formatDisplayDate(selectedDate)}.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = STATUS_COLORS[item.status] ?? "#666";
            const time = new Date(item.scheduledAt).toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => router.push(`/(tabs)/jobs/${item.id}`)}
              >
                <View style={[styles.statusBar, { backgroundColor: color }]} />
                <View style={styles.rowContent}>
                  <Text style={styles.rowTime}>{time}</Text>
                  <Text style={styles.rowBay}>Bay: {item.bayId}</Text>
                </View>
                <Text style={[styles.rowStatus, { color }]}>{item.status.replace("_", " ")}</Text>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  datePicker: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  dateChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  dateChipSelected: { backgroundColor: "#1a1a1a", borderColor: "#1a1a1a" },
  dateChipText: { fontSize: 11, fontWeight: "700", color: "#333" },
  dateChipSub: { fontSize: 10, color: "#666", marginTop: 2 },
  dateChipTextSelected: { color: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  statusBar: { width: 4, height: 40, borderRadius: 2 },
  rowContent: { flex: 1 },
  rowTime: { fontSize: 15, fontWeight: "600" },
  rowBay: { fontSize: 13, color: "#555", marginTop: 2 },
  rowStatus: { fontSize: 12, fontWeight: "600" },
  separator: { height: 1, backgroundColor: "#f0f0f0" },
  empty: { paddingTop: 60, alignItems: "center" },
  emptyText: { color: "#888", fontSize: 16 },
});
