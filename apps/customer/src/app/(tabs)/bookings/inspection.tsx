import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Inspection, InspectionArea } from "@autodeck/core";
import { listenToInspection } from "../../../lib/inspection-service";
import { space } from "@autodeck/ui/theme";
import { Button, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T } from "../../../ui/kit";

const AREA_LABELS: Record<InspectionArea, string> = {
  exterior: "Exterior",
  glass: "Glass",
  interior: "Interior",
  service_specific: "Service-specific",
};

const RATING_LABELS: Record<string, string> = {
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  not_applicable: "N/A",
};

function ratingTone(rating: string): "neutral" | "accent" | "premium" | "danger" {
  if (rating === "good") return "premium";
  if (rating === "fair") return "accent";
  if (rating === "poor") return "danger";
  return "neutral";
}

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
    return (
      <Screen>
        <Notice title="Couldn't load the inspection" body={error} action={<Button label="Go back" onPress={() => router.back()} />} />
      </Screen>
    );
  }
  if (inspection === undefined) return <Loading label="Opening the report" />;
  if (inspection === null || inspection.status !== "finalized") {
    return (
      <Screen>
        <Notice
          title="No inspection report yet"
          body="The studio hasn't finalized an inspection report for this job yet."
          action={<Button label="Go back" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const areas: InspectionArea[] = ["exterior", "glass", "interior", "service_specific"];

  return (
    <Screen
      header={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">Inspection</Kicker>
          <T role="title">Inspection report</T>
          <T role="caption" tone="secondary">{inspection.serviceName}</T>
        </View>
      }
    >
      {areas.map((area) => {
        const items = inspection.checklist.filter((i) => i.area === area);
        if (items.length === 0) return null;
        return (
          <View key={area} style={{ gap: space.line }}>
            <Kicker>{AREA_LABELS[area]}</Kicker>
            <Pane pad="gap">
              {items.map((item, idx) => (
                <Row
                  key={item.key}
                  title={item.label}
                  detail={item.notes ?? undefined}
                  trailing={item.rating ? <Chip label={RATING_LABELS[item.rating] ?? item.rating} tone={ratingTone(item.rating)} /> : null}
                  last={idx === items.length - 1}
                />
              ))}
            </Pane>
          </View>
        );
      })}

      {inspection.overallNotes ? (
        <View style={{ gap: space.line }}>
          <Kicker>Overall notes</Kicker>
          <Pane pad="inset">
            <T>{inspection.overallNotes}</T>
          </Pane>
        </View>
      ) : null}

      <Button label="Go back" kind="quiet" onPress={() => router.back()} />
    </Screen>
  );
}
