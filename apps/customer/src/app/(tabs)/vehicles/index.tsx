import { useEffect, useState } from "react";
import { View, FlatList } from "react-native";
import { useRouter } from "expo-router";
import type { Vehicle } from "@autodeck/core";
import { colors, spacing, radius, VehicleCard, EmptyState, LoadingState, ErrorState, Button } from "@autodeck/ui";
import { listenToMyVehicles } from "../../../lib/vehicle-service";
import { useAuth } from "../../../hooks/useAuth";

export default function VehiclesScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== "ready") return;

    const { uid } = auth.user;
    const { tenantId } = auth.claims;

    const unsubscribe = listenToMyVehicles(
      uid,
      tenantId,
      (data) => {
        setVehicles(data);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [auth.status]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={vehicles}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <VehicleCard
            vehicle={item}
            onPress={() => router.push({ pathname: "/(tabs)/vehicles/[id]", params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          <EmptyState title="No vehicles yet" message="Add a vehicle to start booking services." fill={false} />
        }
      />
      <View style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg }}>
        <Button label="+ Add Vehicle" onPress={() => router.push("/(tabs)/vehicles/add")} style={{ borderRadius: radius.full }} />
      </View>
    </View>
  );
}
