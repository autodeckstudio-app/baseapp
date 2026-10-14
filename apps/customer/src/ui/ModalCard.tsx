// Card for pop-ups. The Raised card shadow has a light highlight meant for the
// grey page, which shows as a white glow on a dimmed backdrop, so pop-ups use a
// flat surface with one soft neutral drop shadow instead.
import type { ReactNode } from "react";
import { Platform, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";

export function ModalCard({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  const { colors } = useExperienceTheme();
  return (
    <View style={{ padding: 16, gap: 10, borderRadius: 24, backgroundColor: colors.surfaceElevated, ...(Platform.OS === "web" ? ({ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.35)" } as object) : { elevation: 12 }) }}>
      <Text style={{ color: colors.textPrimary, fontSize: 19, fontWeight: "800" }}>{title}</Text>
      {body ? <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{body}</Text> : null}
      {children ? <View style={{ gap: 10, marginTop: 8 }}>{children}</View> : null}
    </View>
  );
}
