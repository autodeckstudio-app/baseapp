import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, nightSurfaceStyle } from "@autodeck/ui/theme";
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput as RNTextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { listenToInspection, updateInspection, finalizeInspection } from "../../../../lib/inspection-service";
import type { Inspection, InspectionArea, InspectionRating } from "@autodeck/core";
import { colors, spacing, radius, typography, Button, StatusBadge, LoadingState, ErrorState } from "@autodeck/ui";

const AREA_LABELS: Record<InspectionArea, string> = {
  exterior: "Exterior",
  glass: "Glass",
  interior: "Interior",
  service_specific: "Service-Specific",
};

const RATINGS: { value: InspectionRating; label: string }[] = [
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "not_applicable", label: "N/A" },
];

const RATING_COLOR: Record<InspectionRating, string> = {
  good: colors.success,
  fair: colors.warning,
  poor: colors.error,
  not_applicable: colors.textMuted,
};

export default function InspectionScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const [inspection, setInspection] = useState<Inspection | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [overallNotes, setOverallNotes] = useState("");
  const [, setNotesInitialized] = useState(false);
  const [retryTick,setRetryTick] = useState(0);
  const [confirming,setConfirming] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    setError(null);
    if (!jobId) {setInspection(null);return undefined;}
    return listenToInspection(
      jobId,
      (i) => {
        setError(null);setInspection(i);
        setNotesInitialized((already) => {
          if (i && !already) setOverallNotes(i.overallNotes ?? "");
          return already || !!i;
        });
      },
      (err) => setError(err.message),
    );
  }, [jobId,retryTick]);

  const readOnly = inspection?.status === "finalized";

  async function handleSetRating(key: string, rating: InspectionRating) {
    if (!jobId || readOnly) return;
    setSavingKey(key);
    try {
      await updateInspection({ jobId, items: [{ key, rating }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveNotes(key: string, notes: string) {
    if (!jobId || readOnly) return;
    try {
      await updateInspection({ jobId, items: [{ key, notes: notes || null }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note.");
    }
  }

  async function handleSaveOverallNotes() {
    if (!jobId || readOnly) return;
    try {
      await updateInspection({ jobId, overallNotes: overallNotes || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save notes.");
    }
  }

  async function confirmFinalize() {
    if(!jobId || finalizing || readOnly) return;
    setFinalizing(true);
    try{await finalizeInspection(jobId);setConfirming(false);}
    catch(err){setError(err instanceof Error?err.message:"Could not finalize inspection.");}
    finally{setFinalizing(false);}
  }
  function handleFinalize(){setConfirming(true);}

  if (error) return <ErrorState message={error} onRetry={()=>setRetryTick(n=>n+1)} />;
  if (inspection === undefined) return <LoadingState />;
  if (inspection === null) return <ErrorState title="Inspection not found" />;

  const areas: InspectionArea[] = ["exterior", "glass", "interior", "service_specific"];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background, ...(NightPlatform.OS === "web" && nightMaterial ? nightGroundStyle : {}) }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130,width:"100%",maxWidth:640,alignSelf:"center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg }}>
        <Text style={{ ...typography.heading, color: colors.textPrimary }}>Inspection</Text>
        <StatusBadge label={readOnly ? "Finalized" : "In Progress"} tone={readOnly ? "success" : "accent"} />
      </View>

      {confirming?<View style={{gap:spacing.sm,padding:spacing.md,marginBottom:spacing.lg,backgroundColor:colors.surface,borderRadius:radius.lg}}><Text style={{color:colors.textPrimary}}>Finalize inspection? The checklist and notes cannot be edited afterward.</Text><Button label="Finalize inspection" loading={finalizing} onPress={()=>void confirmFinalize()}/><Button label="Keep editing" onPress={()=>setConfirming(false)} disabled={finalizing}/></View>:null}
      {areas.map((area) => {
        const items = inspection.checklist.filter((i) => i.area === area);
        if (items.length === 0) return null;
        return (
          <View key={area} style={{ marginBottom: spacing.lg }}>
            <Text style={sectionTitle}>{AREA_LABELS[area]}</Text>
            <View style={{ backgroundColor: colors.surface, ...(NightPlatform.OS === "web" && nightMaterial ? nightSurfaceStyle : {}), borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
              {items.map((item) => (
                <View key={item.key}>
                  <Text style={{ ...typography.bodyMedium, color: colors.textPrimary, marginBottom: spacing.xs }}>{item.label}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.xs }}>
                    {RATINGS.map((r) => {
                      const selected = item.rating === r.value;
                      return (
                        <TouchableOpacity
                          key={r.value}
                          disabled={readOnly || savingKey === item.key}
                          onPress={() => void handleSetRating(item.key, r.value)}
                          style={{
                            paddingHorizontal: spacing.md,
                            paddingVertical: spacing.xs,
                            borderRadius: radius.md,
                            borderWidth: 1,
                            borderColor: selected ? RATING_COLOR[r.value] : colors.border,
                            backgroundColor: selected ? RATING_COLOR[r.value] : colors.surface,
                            opacity: readOnly ? 0.7 : 1,
                          }}
                        >
                          <Text style={{ ...typography.caption, color: selected ? colors.white : colors.textSecondary }}>
                            {r.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <RNTextInput
                    defaultValue={item.notes ?? ""}
                    editable={!readOnly}
                    placeholder="Notes (optional)"
                    placeholderTextColor={colors.textMuted}
                    onEndEditing={(e) => void handleSaveNotes(item.key, e.nativeEvent.text)}
                    style={{
                      ...typography.caption,
                      color: colors.textPrimary,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.sm,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                    }}
                  />
                </View>
              ))}
            </View>
          </View>
        );
      })}

      <Text style={sectionTitle}>Overall Notes</Text>
      <RNTextInput
        value={overallNotes}
        editable={!readOnly}
        onChangeText={setOverallNotes}
        onEndEditing={() => void handleSaveOverallNotes()}
        multiline
        placeholder="Overall condition summary…"
        placeholderTextColor={colors.textMuted}
        style={{
          ...typography.body,
          color: colors.textPrimary,
          backgroundColor: colors.surface, ...(NightPlatform.OS === "web" && nightMaterial ? nightSurfaceStyle : {}),
          borderRadius: radius.lg,
          padding: spacing.lg,
          minHeight: 80,
          marginBottom: spacing.lg,
          textAlignVertical: "top",
        }}
      />

      {!readOnly && (
        <Button label="Finalize Inspection" onPress={handleFinalize} loading={finalizing} variant="destructive" />
      )}
      <View style={{ height: spacing.lg }} />
      <Button label="Back to Job" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}

const sectionTitle = { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm } as const;
