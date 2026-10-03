import { useState } from "react";
import { View, Text, Alert } from "react-native";
import { httpsCallable } from "firebase/functions";
import { signOut } from "firebase/auth";
import { auth, functions } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { colors, spacing, radius, typography, Avatar, Button, LoadingState } from "@autodeck/ui";

export default function AccountScreen() {
  const authState = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function run(label: string, fn: string, done: string) {
    setBusy(label);
    setNote(null);
    try {
      await httpsCallable(functions, fn)({});
      setNote(done);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setNote(/already/i.test(m) ? m : "That did not go through. Try again.");
    } finally {
      setBusy(null);
    }
  }

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

      <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
        <Text style={{ ...typography.title, color: colors.textPrimary }}>My attendance</Text>
        <Button label="Check in" onPress={() => void run("in", "checkInAttendance", "Checked in for today.")} disabled={busy !== null} />
        <Button label="Start break" onPress={() => void run("bs", "startAttendanceBreak", "Break started.")} disabled={busy !== null} variant="secondary" />
        <Button label="End break" onPress={() => void run("be", "endAttendanceBreak", "Break ended.")} disabled={busy !== null} variant="secondary" />
        <Button label="Check out" onPress={() => void run("out", "checkOutAttendance", "Checked out. See you tomorrow.")} disabled={busy !== null} variant="secondary" />
        {note ? <Text style={{ ...typography.caption, color: colors.textMuted }}>{note}</Text> : null}
      </View>

      <Button label="Sign Out" onPress={handleSignOut} variant="destructive" />
    </View>
  );
}
