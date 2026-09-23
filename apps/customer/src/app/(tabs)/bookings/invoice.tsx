import { useState, useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Invoice } from "@autodeck/core";
import { listenToInvoiceForJob } from "../../../lib/invoice-service";
import { space } from "@autodeck/ui/theme";
import { Button, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";

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

  if (loading) return <Loading label="Opening the invoice" />;

  if (error || !invoice) {
    return (
      <Screen>
        <Notice
          title={error ? "Couldn't load the invoice" : "No invoice yet"}
          body={error ?? "It's issued once payment is confirmed."}
          action={<Button label="Go back" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <View style={{ gap: space.breath }}>
          <Chip label={invoice.status === "void" ? "Void" : "Issued"} tone={invoice.status === "void" ? "danger" : "premium"} />
          <T role="title">{invoice.invoiceNumber}</T>
        </View>
      }
    >
      <Pane pad="gap">
        {invoice.lineItems.map((li, i) => (
          <Row
            key={i}
            title={`${li.description} × ${li.quantity}`}
            trailing={<T role="data">{rupees(li.total)}</T>}
            last={i === invoice.lineItems.length - 1}
          />
        ))}
      </Pane>

      <Pane pad="gap">
        <Row title="Subtotal" trailing={<T role="data">{rupees(invoice.subtotal)}</T>} />
        <Row title={invoice.taxDescription} trailing={<T role="data">{rupees(invoice.tax)}</T>} />
        <Row title={<T role="heading">Total</T>} trailing={<T role="heading">{rupees(invoice.total)}</T>} last />
      </Pane>

      {invoice.status === "void" ? (
        <Notice title="Invoice voided" body={invoice.voidedReason ? `Reason: ${invoice.voidedReason}` : "This invoice was voided."} />
      ) : null}

      <T role="caption" tone="tertiary" style={{ textAlign: "center" }}>
        Issued {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
      </T>

      <Button label="Go back" kind="quiet" onPress={() => router.back()} />
    </Screen>
  );
}
