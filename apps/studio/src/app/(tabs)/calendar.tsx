import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, nightSurfaceStyle } from "@autodeck/ui/theme";
import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { listenToJobsByDate } from "../../lib/studio-service";
import { useAuth } from "../../hooks/useAuth";
import { useJobLabels } from "../../hooks/useBayNames";
import type { ServiceJob } from "@autodeck/core";
// V1 is explicitly single-studio-per-tenant (seeded once) — FIRST_STUDIO_ID
// is the correct, intentional value here, unlike tenantId which must always
// come from the authenticated user's own claims (see Phase 3G HANDOFF).
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { colors, spacing, radius, typography, EmptyState, ErrorState, LoadingState, JobCard } from "@autodeck/ui";

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
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const labels = useJobLabels(auth.status === "ready" ? FIRST_STUDIO_ID : null);

  const today = todayIST();
  const dateDays = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  useEffect(() => {
    if (auth.status !== "ready") return undefined;
    setLoading(true); setError(null);
    const unsub = listenToJobsByDate(
      auth.claims.tenantId,
      FIRST_STUDIO_ID,
      selectedDate,
      (data) => {
        setJobs(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [selectedDate, auth.status, attempt]);

  if (error) return <ErrorState title="Calendar unavailable" message={error} onRetry={() => setAttempt(n => n + 1)} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, ...(NightPlatform.OS === "web" && nightMaterial ? nightGroundStyle : {}) }}>
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          gap: spacing.xxs,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
          backgroundColor: colors.surface, ...(NightPlatform.OS === "web" && nightMaterial ? nightSurfaceStyle : {}),
        }}
      >
        {dateDays.map((d) => {
          const [weekday, dayMonth] = formatDisplayDate(d).split(", ");
          const selected = selectedDate === d;
          return (
            <TouchableOpacity
              key={d}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${formatDisplayDate(d)}`}
              accessibilityState={{selected}}
              onPress={() => setSelectedDate(d)}
              style={{
                flex: 1,
                minHeight:48,
                justifyContent:"center",
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
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, flexGrow: 1 }}
          data={jobs}
          keyExtractor={(j) => j.id}
          ListEmptyComponent={<EmptyState title="No jobs" message={`Nothing scheduled for ${formatDisplayDate(selectedDate)}.`} fill={false} />}
          renderItem={({ item }) => (
            <JobCard job={item} viewDate={selectedDate} bayName={labels.bays[item.bayId]} serviceName={labels.services[item.serviceId]} onPress={() => router.push(`/(tabs)/jobs/${item.id}`)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </View>
  );
}
