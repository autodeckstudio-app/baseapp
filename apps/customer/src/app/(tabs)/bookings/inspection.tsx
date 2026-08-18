import { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Inspection, InspectionArea } from "@autodeck/core";
import { listenToInspection } from "../../../lib/inspection-service";
import { colors, spacing, radius, typography, Button, StatusBadge, LoadingState, ErrorState } from "@autodeck/ui";

const AREA_LABELS: Record<InspectionArea, string> = {
  exterior: "Exterior",
  glass: "Glass",
  interior: "Interior",
  service_specific: "Service-Specific",
};

const RATING_LABELS: Record<string, string> = {
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  not_applicable: "N/A",
};

export default function InspectionScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const [inspection, setInspection] = useState<Inspection | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return undefined;
    return listenToInspection(jobId, setInspection, (err) => setError(err.message));
  }, [jobId]);

  if (error) {
    return <ErrorState title="Couldn't load the inspection" message={error} onRetry={() => router.back()} />;
  }
  if (inspection === undefined) return <LoadingState />;
  if (inspection === null || inspection.status !== "finalized") {
    return (
      <ErrorState
        title="No inspection report yet"
        message="The studio hasn't finalized an inspection report for this job yet."
        onRetry={() => router.back()}
      />
    );
  }

  const areas: InspectionArea[] = ["exterior", "glass", "interior", "service_specific"];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xxs }}>Inspection Report</Text>
      <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.xl }}>{inspection.serviceName}</Text>

      {areas.map((area) => {
        const items = inspection.checklist.filter((i) => i.area === area);
        if (items.length === 0) return null;
        return (
          <View key={area} style={{ marginBottom: spacing.lg }}>
            <Text style={sectionTitle}>{AREA_LABELS[area]}</Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
              {items.map((item) => (
                <View key={item.key} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text style={{ ...typography.body, color: colors.textPrimary }}>{item.label}</Text>
                    {item.notes && (
                      <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 2 }}>{item.notes}</Text>
                    )}
                  </View>
                  {item.rating && <StatusBadge label={RATING_LABELS[item.rating] ?? item.rating} tone={ratingTone(item.rating)} />}
                </View>
              ))}
            </View>
          </View>
        );
      })}

      {inspection.overallNotes && (
        <>
          <Text style={sectionTitle}>Overall Notes</Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
            <Text style={{ ...typography.body, color: colors.textPrimary }}>{inspection.overallNotes}</Text>
          </View>
        </>
      )}

      <View style={{ height: spacing.xl }} />
      <Button label="Go back" onPress={() => router.back()} variant="ghost" />
    </ScrollView>
  );
}

function ratingTone(rating: string): "success" | "warning" | "error" | "neutral" {
  if (rating === "good") return "success";
  if (rating === "fair") return "warning";
  if (rating === "poor") return "error";
  return "neutral";
}

const sectionTitle = { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm } as const;
