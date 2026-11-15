import { Platform } from "react-native";
import { printInvoiceHtml } from "./invoice-display";

/** A copy of the already-readable invoice, not new issuance or a server PDF. */
export async function exportInvoiceCopy(html: string, isCurrent: () => boolean): Promise<void> {
  if (!isCurrent()) return;
  if (Platform.OS === "web") {
    printInvoiceHtml(html);
    return;
  }
  const [print, sharing, files] = await Promise.all([
    import("expo-print"), import("expo-sharing"), import("expo-file-system"),
  ]);
  if (!isCurrent()) return;
  if (!await sharing.isAvailableAsync()) throw new Error("File sharing is unavailable on this device.");
  if (!isCurrent()) return;
  let uri: string | undefined;
  try {
    const result = await print.printToFileAsync({ html });
    uri = result.uri;
    if (!isCurrent()) return;
    await sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Save invoice copy" });
  } finally {
    // Private cache only, no upload. Remove the temporary copy after the sheet closes.
    if (uri) await files.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }
}
