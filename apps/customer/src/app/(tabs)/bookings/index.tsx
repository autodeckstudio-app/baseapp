import { useState, useEffect, useCallback } from "react";
import { View, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../hooks/useAuth";
import { getMyBookings } from "../../../lib/booking-service";
import type { Booking } from "@autodeck/core";
import { colors, spacing, BookingCard, EmptyState, ErrorState, LoadingState } from "@autodeck/ui";

export default function MyBookingsScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (auth.status !== "ready") return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMyBookings(auth.user.uid, auth.claims.tenantId);
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (auth.status === "ready") void loadBookings();
  }, [auth.status, loadBookings]);

  if (auth.status === "loading") return <LoadingState />;
  if (auth.status === "unauthenticated" || auth.status === "authenticated_no_claims") return null;
  if (loading && bookings.length === 0) return <LoadingState />;
  if (error && bookings.length === 0) return <ErrorState message={error} onRetry={() => void loadBookings()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={bookings}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
        onRefresh={() => void loadBookings()}
        refreshing={loading}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <EmptyState title="No bookings yet" message="Book a service from the Services tab." fill={false} />
        }
        renderItem={({ item }) => <BookingCard booking={item} onPress={() => router.push(`/(tabs)/bookings/${item.id}`)} />}
      />
    </View>
  );
}
