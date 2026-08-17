import { View, Text, Alert } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { colors, spacing, radius, typography, Avatar, Button, LoadingState } from "@autodeck/ui";

export default function AccountScreen() {
  const authState = useAuth();

  function handleSignOut() {
    Alert.alert("Sign Out", "Sign out of AutoDeck Studio?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => void signOut(auth),
      },
    ]);
  }

  if (authState.status !== "ready") return <LoadingState />;

  const email = authState.user.email ?? "Studio staff";

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
        <Avatar name={email} size={64} />
        <Text style={{ ...typography.title, color: colors.textPrimary, marginTop: spacing.md }}>{email}</Text>
        <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs, textTransform: "capitalize" }}>
          {authState.claims.role}
        </Text>
        {authState.claims.studioId && (
          <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>
            Studio: {authState.claims.studioId}
          </Text>
        )}
      </View>

      <Button label="Sign Out" onPress={handleSignOut} variant="destructive" />
    </View>
  );
}
