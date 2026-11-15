import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { getBlob, ref } from "firebase/storage";
import { colors, radius, typography } from "@autodeck/ui";
import { storage } from "../lib/firebase";

/** One stored inspection photo. The bytes are read as the signed-in staff member through the Storage rules (getBlob) and shown from a private in-memory object URL that is revoked on unmount. No shareable download link is ever created. */
export function PhotoThumb({ path, size = 88 }: { path: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    getBlob(ref(storage, path)).then((b) => { if (!live) return; made = URL.createObjectURL(b); setUrl(made); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [path]);
  const box = { width: size, height: size, borderRadius: radius.md, backgroundColor: colors.border, overflow: "hidden" as const, alignItems: "center" as const, justifyContent: "center" as const };
  return (
    <View style={box} accessibilityLabel="Inspection photo">
      {url ? <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="cover" accessibilityLabel="Inspection photo" />
        : <Text style={{ ...typography.caption, color: colors.textMuted }}>{failed ? "Can't load" : "..."}</Text>}
    </View>
  );
}
