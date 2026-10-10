import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, nightSurfaceStyle } from "@autodeck/ui/theme";
import { Stack } from "expo-router";
import { colors } from "@autodeck/ui";

export default function LookupLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background, ...(NightPlatform.OS === "web" && nightMaterial ? nightGroundStyle : {}) },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: "700" },
        headerTintColor: colors.accent,
        contentStyle: { backgroundColor: colors.background, ...(NightPlatform.OS === "web" && nightMaterial ? nightGroundStyle : {}) },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Lookup" }} />
      <Stack.Screen name="customer/[id]" options={{ title: "Customer" }} />
      <Stack.Screen name="vehicle/[id]" options={{ title: "Vehicle" }} />
    </Stack>
  );
}
