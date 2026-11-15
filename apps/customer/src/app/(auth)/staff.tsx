import { View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { Ambient } from "@autodeck/ui/native";
import { signOut } from "../../lib/auth-service";
import { Button, Kicker, T } from "../../ui/kit";

// A staff or admin account opened the customer app. Customer screens never
// render for staff; point them at their own tools instead.
export default function StaffNotice() {
  return (
    <Ambient>
      <View style={{ flex: 1, justifyContent: "center", width: "100%", maxWidth: 480, alignSelf: "center", padding: space.inset, gap: space.inset }}>
        <Kicker tone="accent">Studio account</Kicker>
        <T role="display">This is the customer app.</T>
        <T tone="secondary">You're signed in with a studio account. Use AutoDeck Studio for today's work, or AutoDeck Admin on the web.</T>
        <Button kind="quiet" label="Sign out" onPress={() => void signOut()} />
      </View>
    </Ambient>
  );
}
