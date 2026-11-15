import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, nightSurfaceStyle } from "@autodeck/ui/theme";
import { Stack } from "expo-router";
import { colors } from "@autodeck/ui";
import { BackButton } from "../../../components/BackButton";

export default function JobsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "transparent" },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: "700" },
        headerTintColor: colors.accent,
        headerBackVisible: false,
        headerLeft: () => <BackButton fallback="/(tabs)" />,
        contentStyle: { backgroundColor: "transparent" },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: "Job" }} />
      <Stack.Screen name="inspection/[jobId]" options={{ title: "Inspection" }} />
    </Stack>
  );
}
