import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import type { Vehicle } from "@autodeck/core";
import { listenToMyVehicles } from "../../../lib/vehicle-service";
import { useAuth } from "../../../hooks/useAuth";

export default function VehiclesScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth.status !== "ready") return;

    const { uid } = auth.user;
    const { tenantId } = auth.claims;

    const unsubscribe = listenToMyVehicles(
      uid,
      tenantId,
      (data) => {
        setVehicles(data);
        setLoading(false);
      },
      (err) => {
        Alert.alert("Error", err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [auth.status]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={vehicles}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              router.push({ pathname: "/(tabs)/vehicles/[id]", params: { id: item.id } })
            }
          >
            <Text style={styles.carTitle}>
              {item.year} {item.make} {item.model}
            </Text>
            <Text style={styles.carPlate}>{item.registrationNumber}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No vehicles added yet.</Text>
          </View>
        }
        contentContainerStyle={vehicles.length === 0 ? styles.emptyContainer : undefined}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/(tabs)/vehicles/add")}
      >
        <Text style={styles.fabText}>+ Add Car</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1 },
  emptyText: { color: "#999", fontSize: 16 },
  card: {
    backgroundColor: "#fff",
    margin: 12,
    marginBottom: 0,
    padding: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  carTitle: { fontSize: 18, fontWeight: "600" },
  carPlate: { fontSize: 14, color: "#666", marginTop: 4, letterSpacing: 1 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  fabText: { color: "#fff", fontWeight: "600" },
});
