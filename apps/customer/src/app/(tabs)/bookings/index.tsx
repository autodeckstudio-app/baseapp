import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { getMyBookings } from "../../../lib/booking-service";
import type { Booking } from "@autodeck/core";
import { FIRST_TENANT_ID } from "@autodeck/core";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f0a500",
  CONFIRMED: "#2196f3",
  ACTIVE: "#9c27b0",
  COMPLETED: "#4caf50",
  CANCELLED: "#bdbdbd",
  EXPIRED: "#bdbdbd",
};

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
}

function BookingCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const status = STATUS_LABELS[booking.status] ?? booking.status;
  const color = STATUS_COLORS[booking.status] ?? "#666";
  const date = new Date(booking.scheduledAt).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = new Date(booking.scheduledAt).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardTop}>
        <Text style={styles.cardDate}>{date} at {time}</Text>
        <View style={[styles.statusBadge, { backgroundColor: color }]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
      <Text style={styles.cardService} numberOfLines={1}>
        {booking.serviceId}
      </Text>
      <Text style={styles.cardPrice}>{formatPrice(booking.totalAmount)}</Text>
    </TouchableOpacity>
  );
}

export default function MyBookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMyBookings(uid, FIRST_TENANT_ID);
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  if (loading && bookings.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error && bookings.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Couldn't load your bookings.</Text>
        <Text style={styles.emptyHint}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void loadBookings()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={bookings}
      keyExtractor={(b) => b.id}
      onRefresh={() => void loadBookings()}
      refreshing={loading}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No bookings yet.</Text>
          <Text style={styles.emptyHint}>Book a service from the Services tab.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <BookingCard
          booking={item}
          onPress={() => router.push(`/(tabs)/bookings/${item.id}`)}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e8e8e8",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardDate: { fontSize: 14, color: "#555" },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  cardService: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  cardPrice: { fontSize: 15, color: "#1a1a1a", fontWeight: "500" },
  separator: { height: 10 },
  empty: { paddingTop: 60, alignItems: "center" },
  emptyText: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptyHint: { color: "#888", fontSize: 14, textAlign: "center" },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#1a1a1a", borderRadius: 8 },
  retryButtonText: { color: "#fff", fontWeight: "600" },
});
