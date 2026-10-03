import { useState } from "react";
import { View, Text, Alert, Platform, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { httpsCallable } from "firebase/functions";
import { signOut } from "firebase/auth";
import { auth, functions } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { colors, spacing, radius, typography, Avatar, LoadingState } from "@autodeck/ui";
import { Icon } from "@autodeck/ui/native";

type IconName = "home" | "wrench" | "calendar" | "search" | "profile" | "plus" | "check" | "pin" | "close" | "bell" | "users";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={{ ...typography.caption, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>{title}</Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

function Row({ icon, label, hint, onPress, disabled, last, danger }: { icon: IconName; label: string; hint?: string; onPress: () => void; disabled?: boolean; last?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 14, paddingHorizontal: spacing.lg, minHeight: 56, opacity: disabled ? 0.5 : 1, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: danger ? "#FDECEA" : "rgba(240,125,40,0.14)" }}>
        <Icon name={icon} color={danger ? "#C0392B" : colors.accent} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.body, color: danger ? "#C0392B" : colors.textPrimary, fontWeight: "600" }}>{label}</Text>
        {hint ? <Text style={{ ...typography.caption, color: colors.textMuted }}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}


export default function AccountScreen() {
  const authState = useAuth();
  const router = useRouter();
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
    // Alert.alert with buttons is a no-op on react-native-web, so confirm natively there.
    const w = globalThis as { confirm?: (m: string) => boolean };
    if (Platform.OS === "web") {
      if (typeof w.confirm !== "function" || w.confirm("Sign out of AutoDeck Studio?")) {
        void signOut(auth);
      }
      return;
    }
    Alert.alert("Sign Out", "Sign out of AutoDeck Studio?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => void signOut(auth) },
    ]);
  }

  if (authState.status !== "ready") return <LoadingState />;

  const email = authState.user.email ?? "Studio staff";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120, width: "100%", maxWidth: 560, alignSelf: "center" }}>
      <View style={{ alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.xl, marginBottom: spacing.xl }}>
        <Avatar name={email} size={64} />
        <Text style={{ ...typography.title, color: colors.textPrimary, marginTop: spacing.md }}>{email}</Text>
        <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs, textTransform: "capitalize" }}>
          {authState.claims.role}
          {authState.claims.studioId ? `  |  ${authState.claims.studioId}` : ""}
        </Text>
      </View>

      <Section title="My day">
        <Row icon="check" label="Check in" onPress={() => void run("in", "checkInAttendance", "Checked in for today.")} disabled={busy !== null} />
        <Row icon="bell" label="Start break" onPress={() => void run("bs", "startAttendanceBreak", "Break started.")} disabled={busy !== null} />
        <Row icon="bell" label="End break" onPress={() => void run("be", "endAttendanceBreak", "Break ended.")} disabled={busy !== null} />
        <Row icon="close" label="Check out" onPress={() => void run("out", "checkOutAttendance", "Checked out. See you tomorrow.")} disabled={busy !== null} last />
        {note ? <Text style={{ ...typography.caption, color: colors.textMuted, padding: spacing.md }}>{note}</Text> : null}
      </Section>

      <Section title="Shortcuts">
        <Row icon="plus" label="New walk-in" hint="Add a car that just arrived" onPress={() => router.push("/(tabs)/walkin")} />
        <Row icon="wrench" label="Bay board" onPress={() => router.push("/(tabs)/bays")} />
        <Row icon="pin" label="Pickup requests" hint="Customers asking for pickup or drop" onPress={() => router.push("/(tabs)/pickups")} />
        <Row icon="calendar" label="Calendar" onPress={() => router.push("/(tabs)/calendar")} />
        <Row icon="search" label="Lookup" hint="Find a customer or car" onPress={() => router.push("/(tabs)/lookup")} last />
      </Section>

      <Section title="Account">
        <Row icon="profile" label="Sign out" onPress={handleSignOut} danger last />
      </Section>
    </ScrollView>
  );
}
