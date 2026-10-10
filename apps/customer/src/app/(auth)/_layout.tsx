import { Stack } from "expo-router";
import { useExperienceTheme } from "@autodeck/ui/native";

export default function AuthLayout() {
  const { colors } = useExperienceTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />;
}
