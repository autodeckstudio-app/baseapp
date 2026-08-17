import { View, Text, Alert } from "react-native";
import { signOut } from "../../lib/auth-service";
import { useAuth } from "../../hooks/useAuth";
import { colors, spacing, radius, typography, Avatar, Button, LoadingState } from "@autodeck/ui";

export default function ProfileScreen() {
  const auth = useAuth();

  async function handleSignOut() {
    Alert.alert("Sign Out", "Sign out of AutoDeck?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  }

  if (auth.status !== "ready") return <LoadingState />;

  const displayName = auth.user.displayName ?? "Customer";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.xl }}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          paddingVertical: spacing.xxl,
          marginTop: spacing.lg,
          marginBottom: spacing.xl,
        }}
      >
        <Avatar name={displayName} size={72} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, marginTop: spacing.md }}>{displayName}</Text>
        {auth.user.phoneNumber !== null && (
          <Text style={{ ...typography.body, color: colors.textMuted, marginTop: spacing.xxs }}>{auth.user.phoneNumber}</Text>
        )}
      </View>

      <Button label="Sign Out" onPress={() => void handleSignOut()} variant="destructive" />
    </View>
  );
}
