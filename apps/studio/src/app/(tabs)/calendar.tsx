import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, floatCard } from "@autodeck/ui/theme";
import { CanvasBackdrop, CanvasTitle } from "../../components/CanvasTitle";
import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { listenToJobsByDate } from "../../lib/studio-service";
import { useAuth } from "../../hooks/useAuth";
import { useJobLabels } from "../../hooks/useBayNames";
import { useJobPeople } from "../../hooks/useJobPeople";
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
  const [show, setShow] = useState<"active" | "done" | "cancelled">("active");
  const labels = useJobLabels(auth.status === "ready" ? FIRST_STUDIO_ID : null);
  const people = useJobPeople(jobs);

  const isCancelled = (j: ServiceJob) => j.status === "CANCELLED";
  const isDone = (j: ServiceJob) => j.status === "DELIVERED";
  const counts = { active: jobs.filter((j) => !isCancelled(j) && !isDone(j)).length, done: jobs.filter(isDone).length, cancelled: jobs.filter(isCancelled).length };
  const shown = jobs.filter((j) => (show === "cancelled" ? isCancelled(j) : show === "done" ? isDone(j) : !isCancelled(j) && !isDone(j)));
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
  const glass = NightPlatform.OS === "web" ? (floatCard(nightMaterial) as object) : { backgroundColor: colors.surface };
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, width: "100%", maxWidth: 1040, alignSelf: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
        <CanvasTitle eyebrow="Schedule" title="Calendar" />
        <View style={{ flexDirection: "row", gap: spacing.xs, padding: spacing.xs, borderRadius: 20, marginBottom: spacing.md, ...glass }}>
          {dateDays.map((d) => {
            const [weekday, dayMonth] = formatDisplayDate(d).split(", ");
            const selected = selectedDate === d;
            return (
              <TouchableOpacity
                key={d}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${formatDisplayDate(d)}`}
                accessibilityState={{ selected }}
                onPress={() => setSelectedDate(d)}
                style={{ flex: 1, minHeight: 52, justifyContent: "center", alignItems: "center", paddingVertical: spacing.xs, borderRadius: 14, ...(selected ? ({ backgroundImage: "linear-gradient(180deg, #F08A3C, #D9701F)", boxShadow: "0 10px 22px -10px rgba(217,112,31,.7)" } as object) : {}) }}
              >
                <Text style={{ ...typography.captionMedium, color: selected ? "#FFFFFF" : colors.textPrimary }}>{weekday}</Text>
                <Text style={{ ...typography.caption, color: selected ? "#FFFFFF" : colors.textMuted, marginTop: 2 }}>{dayMonth}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md }}>
          {(["active", "done", "cancelled"] as const).map((k) => {
            const on = show === k;
            return (
              <TouchableOpacity key={k} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setShow(k)} style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: 1.5, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentMuted : "transparent" }}>
                <Text style={{ ...typography.captionMedium, color: on ? colors.accentPressed : colors.textSecondary }}>{`${k === "active" ? "Active" : k === "done" ? "Done" : "Cancelled"} ${counts[k]}`}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {loading ? (
          <LoadingState />
        ) : (
          <FlatList
            contentContainerStyle={{ paddingBottom: 130, flexGrow: 1 }}
            data={shown}
            keyExtractor={(j) => j.id}
            ListEmptyComponent={<EmptyState title={show === "active" ? "No active jobs" : show === "done" ? "Nothing finished yet" : "No cancelled jobs"} message={show === "active" && (counts.cancelled > 0 || counts.done > 0) ? `${formatDisplayDate(selectedDate)} has ${counts.done} done and ${counts.cancelled} cancelled. Use the filters above to see them.` : show === "active" ? `Nothing scheduled for ${formatDisplayDate(selectedDate)}. Start a walk-in from the Today tab or pick another day.` : `Nothing here for ${formatDisplayDate(selectedDate)}.`} fill={false} />}
            renderItem={({ item }) => (
              <JobCard job={item} carName={people.car(item)} customerName={people.customer(item)} viewDate={selectedDate} bayName={labels.bays[item.bayId]} serviceName={labels.services[item.serviceId]} onPress={() => router.push(`/(tabs)/jobs/${item.id}`)} />
            )}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          />
        )}
      </View>
    </View>
  );
}
