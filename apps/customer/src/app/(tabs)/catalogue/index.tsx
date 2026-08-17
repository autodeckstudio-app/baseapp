import { useState, useEffect, useCallback } from "react";
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
import type { Service } from "@autodeck/core";
import { getServiceCatalogue } from "../../../lib/catalogue-service";

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function ServiceCard({ service, onPress }: { service: Service; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{service.name}</Text>
        {service.brand !== null && <Text style={styles.cardBrand}>{service.brand}</Text>}
      </View>
      <Text style={styles.cardDesc} numberOfLines={2}>
        {service.description}
      </Text>
      <View style={styles.cardMeta}>
        <Text style={styles.cardPrice}>from {formatPrice(service.basePrice)}</Text>
        <Text style={styles.cardDuration}>{service.estimatedDurationMinutes} min</Text>
      </View>
      {service.warrantyLabel !== null && (
        <Text style={styles.cardWarranty}>{service.warrantyLabel}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function CatalogueScreen() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getServiceCatalogue();
      setServices(data);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not load services.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (services.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No services available.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={services}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => (
        <ServiceCard
          service={item}
          onPress={() => router.push(`/(tabs)/catalogue/${item.id}`)}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  emptyText: { color: "#666", fontSize: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e8e8e8",
  },
  cardHeader: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 4 },
  cardName: { fontSize: 16, fontWeight: "700", flex: 1 },
  cardBrand: { fontSize: 12, color: "#666" },
  cardDesc: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 10 },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardPrice: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },
  cardDuration: { fontSize: 13, color: "#888" },
  cardWarranty: { fontSize: 12, color: "#4a90d9", marginTop: 6 },
  separator: { height: 12 },
});
