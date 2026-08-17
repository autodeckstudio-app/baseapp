import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Invoice } from "@autodeck/core";
import { listenToInvoiceForJob } from "../../../lib/invoice-service";
import { colors, spacing, radius, typography, Button, Divider, LoadingState, ErrorState, formatPaise, formatDateShort } from "@autodeck/ui";

export default function InvoiceScreen() {
  const { jobId, tenantId, customerId } = useLocalSearchParams<{
    jobId: string;
    tenantId: string;
    customerId: string;
  }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || !tenantId || !customerId) return;
    return listenToInvoiceForJob(
      jobId,
      tenantId,
      customerId,
      (inv) => {
        setInvoice(inv);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [jobId, tenantId, customerId]);

  if (loading) return <LoadingState />;

  if (error || !invoice) {
    return (
      <ErrorState
        title={error ? "Couldn't load the invoice" : "No invoice yet"}
        message={error ?? "It's issued once payment is confirmed."}
        onRetry={() => router.back()}
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={{ ...typography.heading, color: colors.textPrimary }}>{invoice.invoiceNumber}</Text>
      <Text
        style={{
          ...typography.captionMedium,
          color: invoice.status === "void" ? colors.error : colors.success,
          marginTop: spacing.xxs,
          marginBottom: spacing.xl,
        }}
      >
        {invoice.status === "void" ? "VOID" : "Issued"}
      </Text>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm }}>
        {invoice.lineItems.map((li, i) => (
          <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...typography.body, color: colors.textMuted, flexShrink: 1 }}>
              {li.description} × {li.quantity}
            </Text>
            <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{formatPaise(li.total)}</Text>
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ ...typography.body, color: colors.textMuted }}>Subtotal</Text>
          <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{formatPaise(invoice.subtotal)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ ...typography.body, color: colors.textMuted }}>{invoice.taxDescription}</Text>
          <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{formatPaise(invoice.tax)}</Text>
        </View>
        <Divider spacingY="xxs" />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ ...typography.title, color: colors.textPrimary }}>Total</Text>
          <Text style={{ ...typography.price, color: colors.textPrimary }}>{formatPaise(invoice.total)}</Text>
        </View>
      </View>

      {invoice.status === "void" && (
        <View style={{ backgroundColor: colors.errorMuted, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
          <Text style={{ ...typography.caption, color: colors.error }}>
            This invoice was voided{invoice.voidedReason ? `: ${invoice.voidedReason}` : "."}
          </Text>
        </View>
      )}

      <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center" }}>
        Issued {invoice.issuedAt ? formatDateShort(invoice.issuedAt) : "—"}
      </Text>

      <View style={{ height: spacing.xl }} />
      <Button label="Go back" onPress={() => router.back()} variant="ghost" />
    </ScrollView>
  );
}
