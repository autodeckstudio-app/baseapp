import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { exportInvoiceCopy } from "../lib/invoice-export";
import { Button, T } from "./kit";

export function InvoiceExportAction({ html }: { html: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const locked = useRef(false);
  const latestHtml = useRef(html); latestHtml.current = html;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function openCopy() {
    if (locked.current || !alive.current) return;
    locked.current = true; setBusy(true); setError(null);
    try { await exportInvoiceCopy(html, () => alive.current && latestHtml.current === html); }
    catch { if (alive.current) setError("Opening the invoice copy could not be confirmed. Check your files or try again."); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  return <View style={{ gap: 8 }}>
    <Button label={busy ? "Opening invoice copy..." : Platform.OS === "web" ? "Download PDF" : "Save PDF copy"} disabled={busy} onPress={() => void openCopy()} />
    {Platform.OS !== "web" ? <T role="caption" tone="secondary">Choose where to save in your phone's share sheet. This does not issue a new invoice.</T> : null}
    {error ? <View accessibilityRole="alert"><T role="caption" tone="secondary">{error}</T></View> : null}
  </View>;
}
