import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList, Alert } from "react-native";
import { useRouter } from "expo-router";
import { listenToJobsByDate } from "../../lib/studio-service";
import { useAuth } from "../../hooks/useAuth";
import type { ServiceJob } from "@autodeck/core";
// V1 is explicitly single-studio-per-tenant (seeded once) — FIRST_STUDIO_ID
// is the correct, intentional value here, unlike tenantId which must always
// come from the authenticated user's own claims (see Phase 3G HANDOFF).
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { colors, spacing, radius, typography, statusTone, StatusBadge, EmptyState, LoadingState, formatTime } from "@autodeck/ui";

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

export default function CalendarScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayIST());
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);

  const today = todayIST();
  const dateDays = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  useEffect(() => {
    if (auth.status !== "ready") return undefined;
    setLoading(true);
    const unsub = listenToJobsByDate(
      auth.claims.tenantId,
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
  }, [selectedDate, auth.status]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          gap: spacing.xxs,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
          backgroundColor: colors.surface,
        }}
      >
        {dateDays.map((d) => {
          const [weekday, dayMonth] = formatDisplayDate(d).split(", ");
          const selected = selectedDate === d;
          return (
            <TouchableOpacity
              key={d}
              onPress={() => setSelectedDate(d)}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: spacing.xs,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: selected ? colors.textPrimary : colors.border,
                backgroundColor: selected ? colors.textPrimary : colors.surface,
              }}
            >
              <Text style={{ ...typography.captionMedium, color: selected ? colors.white : colors.textPrimary }}>{weekday}</Text>
              <Text style={{ ...typography.caption, color: selected ? colors.white : colors.textMuted, marginTop: 2 }}>
                {dayMonth}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <LoadingState />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
          data={jobs}
          keyExtractor={(j) => j.id}
          ListEmptyComponent={<EmptyState title="No jobs" message={`Nothing scheduled for ${formatDisplayDate(selectedDate)}.`} fill={false} />}
          renderItem={({ item }) => {
            return (
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, gap: spacing.md }}
                onPress={() => router.push(`/(tabs)/jobs/${item.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{formatTime(item.scheduledAt)}</Text>
                  <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 2 }}>Bay: {item.bayId}</Text>
                </View>
                <StatusBadge label={item.status.replace(/_/g, " ")} tone={statusTone(item.status)} />
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.divider }} />}
        />
      )}
    </View>
  );
}
