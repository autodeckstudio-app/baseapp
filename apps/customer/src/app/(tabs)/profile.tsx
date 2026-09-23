// You: account, membership, notifications, sign out.
import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { signOut } from "../../lib/auth-service";
import { useAuth } from "../../hooks/useAuth";
import { Button, Kicker, Loading, Pane, Row, Screen, T } from "../../ui/kit";

export default function YouScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  if (auth.status !== "ready") return <Loading />;
  const name = auth.user.displayName ?? "AutoDeck member";

  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">You</Kicker><T role="title">{name}</T>{auth.user.email ? <T role="caption" tone="tertiary">{auth.user.email}</T> : null}</View>}>
      <Pane pad="gap">
        <Row title="Membership" detail="Plans, washes left, history" onPress={() => router.push("/(tabs)/membership")} />
        <Row title="Notifications" detail="Updates from the studio" onPress={() => router.push("/(tabs)/notifications")} />
        <Row title="Services and prices" detail="The full menu" onPress={() => router.push("/(tabs)/catalogue")} last />
      </Pane>
      <Pane pad="gap">
        <Row title="Signed in with Google" detail="AutoDeck never stores a password for you." last />
      </Pane>
      {confirm ? (
        <View style={{ gap: space.breath }}>
          <T tone="secondary">Sign out of AutoDeck on this device?</T>
          <View style={{ flexDirection: "row", gap: space.breath }}>
            <Button kind="danger" label="Sign out" onPress={() => void signOut()} style={{ flex: 1 }} />
            <Button kind="quiet" label="Cancel" onPress={() => setConfirm(false)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Button kind="quiet" label="Sign out" onPress={() => setConfirm(true)} />
      )}
    </Screen>
  );
}
