// Shows a private document photo (RC or driving licence) by asking the backend for a tokened URL.
import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { httpsCallable } from "firebase/functions";
import { colors, radius, spacing, typography } from "@autodeck/ui";
import { functions } from "../lib/firebase";

type Doc = { kind: "rc"; vehicleId: string; path: string | null | undefined } | { kind: "licence"; customerId: string; path: string | null | undefined };

export function DocPhoto({ doc, label }: { doc: Doc; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const path = doc.path ?? null;
  const key = doc.kind === "rc" ? doc.vehicleId : doc.customerId;
  useEffect(() => {
    setUrl(null); setFailed(false);
    if (!path) return;
    const call = doc.kind === "rc"
      ? httpsCallable<{ vehicleId: string; path: string; kind: "rc" }, { url: string }>(functions, "publishVehiclePhoto")({ vehicleId: key, path, kind: "rc" })
      : httpsCallable<{ customerId: string; path: string }, { url: string }>(functions, "publishLicensePhoto")({ customerId: key, path });
    void call.then((r) => setUrl(r.data.url)).catch(() => setFailed(true));
  }, [path, key, doc.kind]);
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm }}>{label}</Text>
      {!path ? <Text style={{ ...typography.caption, color: colors.textMuted }}>Not on file.</Text>
        : failed ? <Text style={{ ...typography.caption, color: colors.textMuted }}>Could not load the photo.</Text>
        : url ? <Image source={{ uri: url }} resizeMode="contain" style={{ width: "100%", height: 220, borderRadius: radius.lg }} accessibilityLabel={label} />
        : <Text style={{ ...typography.caption, color: colors.textMuted }}>Loading...</Text>}
    </View>
  );
}
