import { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { useAuth } from "../../../../hooks/useAuth";
import { getVehiclesForCustomer } from "../../../../lib/walkin-service";
import { listenToJobsForCustomerAtStudio } from "../../../../lib/lookup-service";
import { COLLECTIONS } from "@autodeck/database";
import type { Customer, Vehicle, ServiceJob } from "@autodeck/core";
import { colors, spacing, radius, typography, ListRow, JobCard, LoadingState, ErrorState } from "@autodeck/ui";

export default function LookupCustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auth = useAuth();

  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || auth.status !== "ready") return;
    void getDoc(doc(db, COLLECTIONS.customers(), id))
      .then((snap) => setCustomer(snap.exists() ? (snap.data() as Customer) : null))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load customer."));
  }, [id, auth.status]);

  useEffect(() => {
    if (!id || auth.status !== "ready") return;
    void getVehiclesForCustomer(auth.claims.tenantId, id)
      .then(setVehicles)
      .catch(() => undefined);
  }, [id, auth.status]);

  useEffect(() => {
    if (!id || auth.status !== "ready" || !auth.claims.studioId) return undefined;
    return listenToJobsForCustomerAtStudio(auth.claims.tenantId, auth.claims.studioId, id, setJobs, () => undefined);
  }, [id, auth.status]);

  if (error) return <ErrorState message={error} />;
  if (auth.status !== "ready" || customer === undefined) return <LoadingState />;
  if (customer === null) return <ErrorState title="Customer not found" />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ ...typography.heading, color: colors.textPrimary }}>{customer.name}</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.lg }}>{customer.phone}</Text>

      <Text style={sectionTitle}>Vehicles ({vehicles.length})</Text>
      {vehicles.length === 0 ? (
        <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg }}>No vehicles on file.</Text>
      ) : (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          {vehicles.map((v, i) => (
            <View key={v.id}>
              {i > 0 && <View style={{ height: 1, backgroundColor: colors.divider }} />}
              <ListRow
                label={`${v.year} ${v.make} ${v.model}`}
                value={v.registrationNumber}
                showChevron
                onPress={() => router.push(`/(tabs)/lookup/vehicle/${v.id}`)}
              />
            </View>
          ))}
        </View>
      )}

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
