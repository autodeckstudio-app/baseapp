import { useState, useEffect, useCallback } from "react";
import { View, FlatList } from "react-native";
import { useRouter } from "expo-router";
import type { Service } from "@autodeck/core";
import { colors, spacing, ServiceCard, EmptyState, LoadingState, ErrorState } from "@autodeck/ui";
import { getServiceCatalogue } from "../../../lib/catalogue-service";

export default function CatalogueScreen() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getServiceCatalogue();
      setServices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load services.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={services}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
        onRefresh={() => void load()}
        refreshing={loading}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <ServiceCard service={item} onPress={() => router.push(`/(tabs)/catalogue/${item.id}`)} />
        )}
        ListEmptyComponent={<EmptyState title="No services available" message="Please check back later." fill={false} />}
      />
    </View>
  );
}
