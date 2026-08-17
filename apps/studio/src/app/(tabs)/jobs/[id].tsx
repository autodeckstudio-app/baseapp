import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { advanceJobStatus, assignBay, getStudioConfig } from "../../../lib/studio-service";
import type { ServiceJob, StudioConfig } from "@autodeck/core";
import { JOB_STATUS_TRANSITIONS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

const JOB_STATUS_LABELS: Record<string, string> = {
  PENDING_VEHICLE: "Awaiting Vehicle",
  VEHICLE_RECEIVED: "Vehicle Received",
  IN_PROGRESS: "In Progress",
  QUALITY_CHECK: "Quality Check",
  READY_FOR_DELIVERY: "Ready for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const ADVANCE_ACTION_LABELS: Record<string, string> = {
  PENDING_VEHICLE: "Check In Vehicle",
  VEHICLE_RECEIVED: "Start Work",
  IN_PROGRESS: "Send to QC",
  QUALITY_CHECK: "Mark Ready",
  READY_FOR_DELIVERY: "Mark Delivered",
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.jobs(), id),
      (snap) => {
        if (snap.exists()) {
          const j = snap.data() as ServiceJob;
          setJob(j);
          if (!config) {
            void getStudioConfig(j.studioId).then(setConfig);
          }
        }
        setLoading(false);
      },
      (err) => {
        Alert.alert("Error", err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [id]);

  async function handleAdvance() {
    if (!job || !id) return;
    setAdvancing(true);
    try {
      await advanceJobStatus(id);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to advance status.");
    } finally {
      setAdvancing(false);
    }
  }

  async function handleReassignBay(bayId: string) {
    if (!job || !id) return;
    setReassigning(true);
    try {
      await assignBay({ jobId: id, bayId, reason: "Manual reassignment by studio" });
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to reassign bay.");
    } finally {
      setReassigning(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.centered}>
        <Text>Job not found.</Text>
      </View>
    );
  }

  const transitions = JOB_STATUS_TRANSITIONS[job.status] ?? [];
  const canAdvance = transitions.some((s) => s !== "CANCELLED");
  const advanceLabel = ADVANCE_ACTION_LABELS[job.status] ?? "Advance";
  const statusLabel = JOB_STATUS_LABELS[job.status] ?? job.status;

  const scheduledTime = new Date(job.scheduledAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const compatibleBays =
    config?.bays.filter((b) => b.active && b.id !== job.bayId) ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.statusLabel}>{statusLabel}</Text>
        {job.isWalkIn && (
          <View style={styles.walkInBadge}>
            <Text style={styles.walkInText}>Walk-in</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Row label="Bay" value={job.bayId} />
        <Row label="Service" value={job.serviceId} />
        <Row label="Scheduled" value={scheduledTime} />
        <Row label="Duration" value={`~${job.estimatedDurationMinutes} min`} />
        <Row label="Payment" value={job.paymentStatus} />
      </View>

      {/* Status history */}
      <Text style={styles.sectionTitle}>Status History</Text>
      <View style={styles.section}>
        {job.statusHistory.map((entry, i) => (
          <View key={i} style={styles.historyRow}>
            <Text style={styles.historyStatus}>
              {JOB_STATUS_LABELS[entry.status] ?? entry.status}
            </Text>
            <Text style={styles.historyTime}>
              {new Date(entry.changedAt).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      {canAdvance && (
        <TouchableOpacity
          style={[styles.advanceButton, advancing && styles.disabled]}
          onPress={() => void handleAdvance()}
          disabled={advancing}
        >
          {advancing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.advanceButtonText}>{advanceLabel}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Bay reassignment */}
      {compatibleBays.length > 0 && job.status !== "DELIVERED" && job.status !== "CANCELLED" && (
        <>
          <Text style={styles.sectionTitle}>Reassign Bay</Text>
          <View style={styles.bayRow}>
            {compatibleBays.map((bay) => (
              <TouchableOpacity
                key={bay.id}
                style={[styles.bayChip, reassigning && styles.disabled]}
                onPress={() => {
                  Alert.alert(
                    "Reassign Bay",
                    `Move job to ${bay.name}?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Confirm", onPress: () => void handleReassignBay(bay.id) },
                    ],
                  );
                }}
                disabled={reassigning}
              >
                <Text style={styles.bayChipText}>{bay.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  statusLabel: { fontSize: 22, fontWeight: "700" },
  walkInBadge: {
    backgroundColor: "#fff3e0",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  walkInText: { fontSize: 12, color: "#f57c00", fontWeight: "600" },
  section: {
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { color: "#888", fontSize: 14 },
  rowValue: { color: "#333", fontSize: 14, fontWeight: "500", maxWidth: "60%", textAlign: "right" },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  historyStatus: { fontSize: 13, color: "#333" },
  historyTime: { fontSize: 13, color: "#888" },
  advanceButton: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 20,
  },
  advanceButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.5 },
  bayRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  bayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1a1a1a",
  },
  bayChipText: { fontSize: 13, color: "#1a1a1a", fontWeight: "500" },
});
