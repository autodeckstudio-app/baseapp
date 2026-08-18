import { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { useAuth } from "../../../../hooks/useAuth";
import { listenToJobsForVehicleAtStudio } from "../../../../lib/lookup-service";
import { COLLECTIONS } from "@autodeck/database";
import type { Vehicle, Customer, ServiceJob } from "@autodeck/core";
import { colors, spacing, radius, typography, ListRow, JobCard, LoadingState, ErrorState } from "@autodeck/ui";

export default function LookupVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auth = useAuth();

  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [owner, setOwner] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || auth.status !== "ready") return;
    void getDoc(doc(db, COLLECTIONS.vehicles(), id))
      .then((snap) => setVehicle(snap.exists() ? (snap.data() as Vehicle) : null))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load vehicle."));
  }, [id, auth.status]);

  useEffect(() => {
    if (!vehicle) return;
    void getDoc(doc(db, COLLECTIONS.customers(), vehicle.ownerId))
      .then((snap) => setOwner(snap.exists() ? (snap.data() as Customer) : null))
      .catch(() => undefined);
  }, [vehicle]);

  useEffect(() => {
    if (!id || auth.status !== "ready" || !auth.claims.studioId) return undefined;
    return listenToJobsForVehicleAtStudio(auth.claims.tenantId, auth.claims.studioId, id, setJobs, () => undefined);
  }, [id, auth.status]);

  if (error) return <ErrorState message={error} />;
  if (auth.status !== "ready" || vehicle === undefined) return <LoadingState />;
  if (vehicle === null) return <ErrorState title="Vehicle not found" />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ ...typography.heading, color: colors.textPrimary }}>
        {vehicle.year} {vehicle.make} {vehicle.model}
      </Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.lg }}>{vehicle.registrationNumber}</Text>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
        <ListRow label="Category" value={vehicle.category ?? "—"} />
        <View style={{ height: 1, backgroundColor: colors.divider }} />
        {owner ? (
          <ListRow label="Owner" value={owner.name} showChevron onPress={() => router.push(`/(tabs)/lookup/customer/${owner.id}`)} />
        ) : (
          <ListRow label="Owner" value="—" />
        )}
      </View>

      <Text style={sectionTitle}>Jobs at this studio ({jobs.length})</Text>
      {jobs.length === 0 ? (
        <Text style={{ ...typography.caption, color: colors.textMuted }}>No jobs at this studio yet.</Text>
      ) : (
        jobs.map((j) => (
          <View key={j.id} style={{ marginBottom: spacing.sm }}>
            <JobCard job={j} onPress={() => router.push(`/(tabs)/jobs/${j.id}`)} />
          </View>
        ))
      )}
    </ScrollView>
  );
}

const sectionTitle = { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm } as const;
