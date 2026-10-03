import { Stack } from "expo-router";
import { colors } from "@autodeck/ui";

export default function JobsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: "700" },
        headerTintColor: colors.accent,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: "Job" }} />
      <Stack.Screen name="inspection/[jobId]" options={{ title: "Inspection" }} />
    </Stack>
  );
}
