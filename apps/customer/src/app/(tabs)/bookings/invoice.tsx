import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Invoice } from "@autodeck/core";
import { listenToInvoiceForBooking } from "../../../lib/invoice-service";

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
}

export default function InvoiceScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    return listenToInvoiceForBooking(
      bookingId,
      (inv) => {
        setInvoice(inv);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [bookingId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !invoice) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {error ? "Couldn't load the invoice." : "No invoice yet — it's issued once payment is confirmed."}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
      <Text style={styles.status}>{invoice.status === "void" ? "VOID" : "Issued"}</Text>

      <View style={styles.section}>
        {invoice.lineItems.map((li, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowLabel}>
              {li.description} × {li.quantity}
            </Text>
            <Text style={styles.rowValue}>{formatPrice(li.total)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Subtotal</Text>
          <Text style={styles.rowValue}>{formatPrice(invoice.subtotal)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{invoice.taxDescription}</Text>
          <Text style={styles.rowValue}>{formatPrice(invoice.tax)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(invoice.total)}</Text>
        </View>
      </View>

      {invoice.status === "void" && (
        <View style={styles.voidBox}>
          <Text style={styles.voidText}>This invoice was voided{invoice.voidedReason ? `: ${invoice.voidedReason}` : "."}</Text>
        </View>
      )}

      <Text style={styles.issuedAt}>
        Issued {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString("en-IN") : "—"}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { fontSize: 15, textAlign: "center", marginBottom: 16 },
  backButton: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#1a1a1a", borderRadius: 8 },
  backButtonText: { color: "#fff", fontWeight: "600" },
  invoiceNumber: { fontSize: 22, fontWeight: "700" },
  status: { fontSize: 13, color: "#4caf50", fontWeight: "600", marginTop: 4, marginBottom: 20 },
  section: { backgroundColor: "#f8f8f8", borderRadius: 10, padding: 16, marginBottom: 16, gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { color: "#666", fontSize: 13, flexShrink: 1 },
  rowValue: { color: "#333", fontSize: 13, fontWeight: "500" },
  divider: { height: 1, backgroundColor: "#e0e0e0", marginVertical: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 15, fontWeight: "700" },
  totalValue: { fontSize: 15, fontWeight: "700" },
  voidBox: { backgroundColor: "#ffebee", borderRadius: 8, padding: 12, marginBottom: 16 },
  voidText: { color: "#c62828", fontSize: 13 },
  issuedAt: { fontSize: 12, color: "#999", textAlign: "center" },
});
