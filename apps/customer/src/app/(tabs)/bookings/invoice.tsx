import { useState, useEffect } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import type { Customer, Invoice, Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { listenToInvoice, listenToInvoiceForJob } from "../../../lib/invoice-service";
import { buildInvoiceHtml, gstSplit, printInvoiceHtml, serviceLabel } from "../../../lib/invoice-display";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { db } from "../../../lib/firebase";
import { STUDIO_INFO } from "../../../lib/studio-info";
import { Button, Loading, Notice, Screen, T, rupees } from "../../../ui/kit";
import { amountInWords } from "../../../lib/amount-words";

// Ivory invoice palette: off-white paper, one orange accent, thin separators.
const IVORY = "#FAF6EE";
const INK = "#20190F";
const INK_SOFT = "#6B6252";
const ACCENT = "#D96C1F";
const HAIRLINE = "#E3DACA";


function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function InvoiceScreen() {
  // Canonical entry: ?invoiceId=<exact invoice>. jobId/tenantId/customerId is
  // the legacy form, still honoured for old links.
  const { invoiceId, jobId, tenantId, customerId } = useLocalSearchParams<{
    invoiceId?: string;
    jobId: string;
    tenantId: string;
    customerId: string;
  }>();
  const router = useRouter();
  const compact=useWindowDimensions().width<600;
  const [retryTick,setRetryTick] = useState(0);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [catalogue, setCatalogue] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onData = (inv: Invoice | null) => { setError(null); setInvoice(inv); setLoading(false); };
    const onErr = (err: Error) => { setError(err.message); setLoading(false); };
    setLoading(true); setError(null);
    if (invoiceId) return listenToInvoice(invoiceId, onData, onErr);
    if (!jobId || !tenantId || !customerId) { setLoading(false); return; }
    return listenToInvoiceForJob(jobId, tenantId, customerId, onData, onErr);
  }, [invoiceId, jobId, tenantId, customerId, retryTick]);

  // Customer-facing service names come from the catalogue (id -> name).
  useEffect(() => {
    let alive = true;
    void getServiceCatalogue().then((all) => { if (alive) setCatalogue(Object.fromEntries(all.map((x) => [x.id, x.name]))); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  // Bill-to details come from the stored customer and vehicle records.
  useEffect(() => {
    if (!invoice) return;
    const snapshots=invoice as unknown as {customerSnapshot?:Customer;vehicleSnapshot?:Vehicle};
    if(snapshots.customerSnapshot)setCustomer(snapshots.customerSnapshot);
    if(snapshots.vehicleSnapshot)setVehicle(snapshots.vehicleSnapshot);
    void getDoc(doc(db, COLLECTIONS.customers(), invoice.customerId))
      .then((s) => { if (s.exists() && !snapshots.customerSnapshot) setCustomer(s.data() as Customer); })
      .catch(() => undefined);
    void getDoc(doc(db, COLLECTIONS.vehicles(), invoice.vehicleId))
      .then((s) => { if (s.exists() && !snapshots.vehicleSnapshot) setVehicle(s.data() as Vehicle); })
      .catch(() => undefined);
  }, [invoice]);

  if (loading) return <Loading label="Opening the invoice" />;

  if (error || !invoice) {
    return (
      <Screen>
        <Notice
          title={error ? "Couldn't load the invoice" : "No invoice yet"}
          body={error ?? "It's issued once payment is confirmed."}
          action={error?<Button label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>:<Button label="Go back" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const { split: gstSplitOn, cgst, sgst } = gstSplit(invoice);
  const statusLabel = invoice.status === "void" ? "Void" : invoice.status === "paid" ? "Paid" : "Issued";

  return (
    <Screen>
      <View style={{ backgroundColor: IVORY, borderRadius: 20, padding: compact?16:28, gap: 20, width: "100%", maxWidth: 720, alignSelf: "center" }}>
        {/* Header: brand left, invoice identity right */}
        <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
          <View style={{ gap: 4 }}>
            <T role="heading" style={{ color: ACCENT, letterSpacing: 1 }}>{STUDIO_INFO.name.toUpperCase()}</T>
            <T role="caption" style={{ color: INK_SOFT }}>{STUDIO_INFO.address}</T>
            {STUDIO_INFO.phone ? <T role="caption" style={{ color: INK_SOFT }}>{STUDIO_INFO.phone}</T> : null}
          </View>
          <View style={{ alignItems: "flex-start", gap: 4, width:"100%" }}>
            <T role="display" style={{ color: INK, letterSpacing: 4, fontSize: 28 }}>INVOICE</T>
            <T role="bodyStrong" style={{ color: INK }}>{invoice.invoiceNumber}</T>
            <T role="caption" style={{ color: INK_SOFT }}>{invoice.issuedAt ? formatDate(invoice.issuedAt) : "-"}</T>
          </View>
        </View>

        <View style={{ height: 2, backgroundColor: ACCENT, opacity: 0.85 }} />

        {/* Bill to */}
        <View style={{ gap: 4 }}>
          <T role="caption" style={{ color: ACCENT, letterSpacing: 1 }}>BILL TO</T>
          <T role="bodyStrong" style={{ color: INK }}>{customer?.name ?? "Customer"}</T>
          {customer?.phone ? <T role="caption" style={{ color: INK_SOFT }}>{customer.phone}</T> : null}
          {vehicle ? (
            <T role="caption" style={{ color: INK_SOFT }}>
              {`${vehicle.make} ${vehicle.model} - ${vehicle.registrationNumber}`}
            </T>
          ) : null}
        </View>

        {/* Services */}
        <View>
          {!compact?<View style={{ flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: HAIRLINE }}>
            <T role="caption" style={{ color: INK_SOFT, flex: 1, letterSpacing: 1 }}>SERVICE</T>
            <T role="caption" style={{ color: INK_SOFT, width: 40, textAlign: "center", letterSpacing: 1 }}>QTY</T>
            <T role="caption" style={{ color: INK_SOFT, width: 90, textAlign: "right", letterSpacing: 1 }}>PRICE</T>
            <T role="caption" style={{ color: INK_SOFT, width: 100, textAlign: "right", letterSpacing: 1 }}>AMOUNT</T>
          </View>:null}
          {invoice.lineItems.map((li, i) => (
            compact?<View key={i} style={{gap:8,paddingVertical:12,borderBottomWidth:1,borderBottomColor:HAIRLINE}}>
              <T style={{color:INK}}>{serviceLabel(li,catalogue)}</T>
              <View style={{flexDirection:"row",justifyContent:"space-between",gap:8}}><T role="caption" style={{color:INK_SOFT}}>Qty {li.quantity} × {rupees(li.unitPrice)}</T><T role="bodyStrong" style={{color:INK}}>{rupees(li.total)}</T></View>
            </View>:
            <View key={i} style={{ flexDirection: "row", alignItems: "baseline", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: HAIRLINE }}>
              <T role="body" style={{ color: INK, flex: 1, paddingRight: 8 }}>{serviceLabel(li, catalogue)}</T>
              <T role="body" style={{ color: INK_SOFT, width: 40, textAlign: "center" }}>{li.quantity}</T>
              <T role="body" style={{ color: INK_SOFT, width: 90, textAlign: "right" }}>{rupees(li.unitPrice)}</T>
              <T role="bodyStrong" style={{ color: INK, width: 100, textAlign: "right" }}>{rupees(li.total)}</T>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={{ alignSelf: "flex-end", width: "100%", maxWidth: 320, gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <T role="body" style={{ color: INK_SOFT }}>Subtotal</T>
            <T role="body" style={{ color: INK }}>{rupees(invoice.subtotal)}</T>
          </View>
          {invoice.discount ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <T role="body" style={{ color: INK_SOFT }}>{invoice.discountDescription ?? "Discount"}</T>
              <T role="body" style={{ color: INK }}>{`- ${rupees(invoice.discount)}`}</T>
            </View>
          ) : null}
          {gstSplitOn ? (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <T role="body" style={{ color: INK_SOFT }}>CGST 9%</T>
                <T role="body" style={{ color: INK }}>{rupees(cgst)}</T>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <T role="body" style={{ color: INK_SOFT }}>SGST 9%</T>
                <T role="body" style={{ color: INK }}>{rupees(sgst)}</T>
              </View>
            </>
          ) : (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <T role="body" style={{ color: INK_SOFT }}>{invoice.taxDescription}</T>
              <T role="body" style={{ color: INK }}>{rupees(invoice.tax)}</T>
            </View>
          )}
          <View style={{ height: 1, backgroundColor: HAIRLINE, marginVertical: 4 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <T role="heading" style={{ color: INK }}>Total</T>
            <T role="heading" style={{ color: ACCENT }}>{rupees(invoice.total)}</T>
          </View>
          <T role="caption" style={{ color: INK_SOFT, textAlign: "right" }}>{amountInWords(invoice.total)}</T>
        </View>

        {/* Footer: accurate payment status + thank-you */}
        <View style={{ borderTopWidth: 1, borderTopColor: HAIRLINE, paddingTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <T role="caption" style={{ color: INK_SOFT, flex: 1 }}>Thank you for choosing {STUDIO_INFO.name}.</T>
          <View style={{ borderRadius: 9999, borderWidth: 1, borderColor: invoice.status === "void" ? INK_SOFT : ACCENT, paddingHorizontal: 14, paddingVertical: 6 }}>
            <T role="caption" style={{ color: invoice.status === "void" ? INK_SOFT : ACCENT, letterSpacing: 1 }}>{statusLabel.toUpperCase()}</T>
          </View>
        </View>

        {invoice.status === "void" ? (
          <T role="caption" style={{ color: INK_SOFT }}>{invoice.voidedReason ? `Void reason: ${invoice.voidedReason}` : "This invoice was voided."}</T>
        ) : null}
      </View>

      {Platform.OS === "web" ? (
        <Button label="Download or print PDF" onPress={() => printInvoiceHtml(buildInvoiceHtml({ invoice, catalogue, studio: { name: STUDIO_INFO.name, address: STUDIO_INFO.address, phone: STUDIO_INFO.phone }, customer, vehicle }))} />
      ) : null}
      <Button label="Go back" kind="quiet" onPress={() => router.back()} />
    </Screen>
  );
}
