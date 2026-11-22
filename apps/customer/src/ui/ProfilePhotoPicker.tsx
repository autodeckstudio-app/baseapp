import { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, View } from "react-native";
import { launchImageLibraryAsync } from "expo-image-picker";
import { useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "./NavIcon";
import { T } from "./kit";

/** Picker-only interaction. A local preview is never an account-photo write. */
export function ProfilePhotoPicker({ scope }: { scope: string }) {
  const { colors } = useExperienceTheme();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const currentScope = useRef(scope); currentScope.current = scope;
  const generation = useRef(0), locked = useRef(false);
  useEffect(() => {
    generation.current++; locked.current = false;
    setPreview(null); setError(null); setBusy(false);
    return () => { generation.current++; };
  }, [scope]);
  async function choose() {
    if (locked.current) return;
    const startedScope = scope, epoch = generation.current;
    const current = () => currentScope.current === startedScope && generation.current === epoch;
    locked.current = true; setBusy(true); setError(null);
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8, exif: false, base64: false });
      if (current() && !result.canceled && result.assets[0]?.uri) setPreview(result.assets[0].uri);
    } catch {
      if (current()) setError("Could not open the photo picker. Your account photo is unchanged.");
    } finally {
      if (current()) { locked.current = false; setBusy(false); }
    }
  }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Choose photo preview" accessibilityHint="Opens a local preview. Your account photo will not change." accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void choose()} style={({ pressed }) => ({ position: "absolute", right: -9, bottom: -9, width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed || busy ? 0.6 : 1 })}>
      <View pointerEvents="none" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle, alignItems: "center", justifyContent: "center" }}><NavIcon name="edit" size={17} color={colors.textPrimary} cut={colors.surfaceElevated} /></View>
    </Pressable>
    <Modal visible={Boolean(preview || error)} transparent animationType="fade" onRequestClose={() => { setPreview(null); setError(null); }}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, padding: 20, justifyContent: "center" }}><View accessibilityViewIsModal style={{ maxWidth: 480, maxHeight: "85%", width: "100%", alignSelf: "center", backgroundColor: colors.surfaceElevated, padding: 20, borderRadius: 24 }}>
        <ScrollView contentContainerStyle={{ gap: 16 }}>
          <T role="heading">{preview ? "Photo preview" : "Photo picker"}</T>
          {preview ? <Image accessibilityLabel="Selected photo preview, not saved" source={{ uri: preview }} resizeMode="contain" style={{ width: "100%", height: 240, borderRadius: 14 }} /> : null}
          <T role="caption" tone="secondary">{error ?? "This preview is not saved to your account. Your account photo is unchanged."}</T>
          <Pressable accessibilityRole="button" accessibilityLabel="Close photo preview" onPress={() => { setPreview(null); setError(null); }} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: 12 }}><T>Close</T></Pressable>
        </ScrollView>
      </View></View>
    </Modal>
  </>;
}
