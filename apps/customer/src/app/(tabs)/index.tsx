import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import type { Booking } from "@autodeck/core";
import { getMyBookings } from "../../lib/booking-service";
import { useAuth } from "../../hooks/useAuth";

export default function HomeScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [nextBooking, setNextBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth.status !== "ready") return;
    getMyBookings(auth.user.uid, auth.claims.tenantId)
      .then((bookings) => {
        const upcoming = bookings
          .filter((b) => b.status === "PENDING" || b.status === "CONFIRMED" || b.status === "ACTIVE")
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
        setNextBooking(upcoming[0] ?? null);
      })
      .catch(() => setNextBooking(null))
      .finally(() => setLoading(false));
  }, [auth.status]);

  if (auth.status !== "ready") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hi{auth.user.displayName ? `, ${auth.user.displayName}` : ""}</Text>
      <Text style={styles.tagline}>What would you like to get done today?</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : nextBooking ? (
        <TouchableOpacity style={styles.upcomingCard} onPress={() => router.push(`/(tabs)/bookings/${nextBooking.id}`)}>
          <Text style={styles.upcomingLabel}>Upcoming booking</Text>
          <Text style={styles.upcomingDate}>
            {new Date(`${nextBooking.scheduledDate}T12:00:00Z`).toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}{" "}
            at {nextBooking.scheduledTime}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.upcomingCardEmpty}>
          <Text style={styles.upcomingEmptyText}>No upcoming bookings</Text>
        </View>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/(tabs)/catalogue")}>
        <Text style={styles.primaryButtonText}>Book a service</Text>
      </TouchableOpacity>

      <View style={styles.quickLinks}>
        <TouchableOpacity style={styles.quickLink} onPress={() => router.push("/(tabs)/vehicles")}>
          <Text style={styles.quickLinkText}>My Vehicles</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickLink} onPress={() => router.push("/(tabs)/bookings")}>
          <Text style={styles.quickLinkText}>My Bookings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 24 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  greeting: { fontSize: 28, fontWeight: "700", marginTop: 16 },
  tagline: { fontSize: 15, color: "#666", marginTop: 4, marginBottom: 24 },
  upcomingCard: { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 18, marginBottom: 20 },
  upcomingLabel: { color: "#ccc", fontSize: 12 },
  upcomingDate: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 4 },
  upcomingCardEmpty: { backgroundColor: "#f8f8f8", borderRadius: 12, padding: 18, marginBottom: 20 },
  upcomingEmptyText: { color: "#888", fontSize: 14 },
  primaryButton: { backgroundColor: "#1a1a1a", borderRadius: 10, paddingVertical: 16, alignItems: "center", marginBottom: 20 },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  quickLinks: { flexDirection: "row", gap: 10 },
  quickLink: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  quickLinkText: { fontWeight: "600", fontSize: 13 },
});
