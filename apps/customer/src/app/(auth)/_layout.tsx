import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="login" options={{ title: "Sign In", headerShown: false }} />
      <Stack.Screen name="verify" options={{ title: "Verify OTP" }} />
      <Stack.Screen name="setup" options={{ title: "Your Name", headerShown: false }} />
    </Stack>
  );
}
