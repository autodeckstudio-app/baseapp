// You: account, membership, notifications, sign out.
import { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { db } from "../../lib/firebase";
import { useLang } from "../../lib/i18n";
import { cancelAccountDeletion, requestAccountDeletion } from "../../lib/pickup-service";
import { signOut } from "../../lib/auth-service";
import { enablePush, pushAvailable } from "../../lib/push";
import { useAuth } from "../../hooks/useAuth";
import { Button, Field, Kicker, Loading, Pane, Row, Screen, T } from "../../ui/kit";

export default function YouScreen() {
  const auth = useAuth();
  const { lang, t } = useLang();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [delStep, setDelStep] = useState<"idle" | "ask" | "sent">("idle");
  const [delBusy, setDelBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  async function saveName() {
    if (auth.status !== "ready") return;
    const next = draft.trim();
    if (next.length < 2 || next.length > 100) {
      setSaveError("Enter your name, 2 to 100 characters.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await updateDoc(doc(db, COLLECTIONS.customers(), auth.user.uid), { name: next, updatedAt: new Date().toISOString() });
      await updateProfile(auth.user, { displayName: next });
      setSavedName(next);
      setEditing(false);
    } catch {
      setSaveError("We could not save your name. Try again.");
    } finally {
      setSaving(false);
    }
  }
  if (auth.status !== "ready") return <Loading />;
  const name = savedName ?? auth.user.displayName ?? "AutoDeck member";

  return (
    <Screen header={<View style={{ flexDirection: "row", alignItems: "center", gap: space.inset }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: "#F59A45", ...({ backgroundImage: "linear-gradient(160deg,#F9B060,#EC8638)", boxShadow: "0 10px 26px rgba(236,134,56,0.35)" } as object) }}>
        <T role="title" style={{ color: "#1A1410" }}>{(name.trim()[0] ?? "A").toUpperCase()}</T>
      </View>
      <View style={{ flex: 1, gap: space.hair }}><Kicker tone="accent">{t("You")}</Kicker><T role="title" numberOfLines={1}>{name}</T>{auth.user.email ? <T role="caption" tone="tertiary" numberOfLines={1}>{auth.user.email}</T> : null}</View>
    </View>}>
      {editing ? (
        <View style={{ gap: space.breath }}>
          <Field label="Your name" value={draft} onChangeText={setDraft} autoCapitalize="words" maxLength={100} />
          {saveError ? <T tone="danger">{saveError}</T> : null}
          <View style={{ flexDirection: "row", gap: space.breath }}>
            <Button label={t("Save")} busy={saving} onPress={() => void saveName()} style={{ flex: 1 }} />
            <Button kind="quiet" label={t("Cancel")} onPress={() => setEditing(false)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Button kind="quiet" label={t("Edit name")} onPress={() => { setDraft(name === "AutoDeck member" ? "" : name); setSaveError(null); setEditing(true); }} />
      )}
      <Pane pad="gap">
        <Row title={t("Membership")} detail={t("Plans, washes left, history")} onPress={() => router.push("/(tabs)/membership")} />
        <Row title={t("Notifications")} detail={t("Updates from the studio")} onPress={() => router.push("/(tabs)/notifications")} />
        {pushAvailable() ? <Row title="Booking alerts" detail="Get a notification when the studio updates your booking" onPress={() => void enablePush().then((r) => Alert.alert(r === "on" ? "Alerts on" : "Not enabled", r === "on" ? "You will get booking updates on this device." : "Allow notifications in your browser settings to turn this on."))} /> : null}
        <Row title={t("Help and contact")} detail={t("Call, WhatsApp, FAQ")} onPress={() => router.push("/(tabs)/help")} last />
      </Pane>
      {/* Language picker hidden until the whole app is translated (LANGS, setLang kept in lib/i18n). */}
      <Pane pad="gap">
        <Row title="Signed in with Google" detail="AutoDeck never stores a password for you." last />
      </Pane>
      {confirm ? (
        <View style={{ gap: space.breath }}>
          <T tone="secondary">Sign out of AutoDeck on this device?</T>
          <View style={{ flexDirection: "row", gap: space.breath }}>
            <Button kind="danger" label={t("Sign out")} onPress={() => void signOut()} style={{ flex: 1 }} />
            <Button kind="quiet" label={t("Cancel")} onPress={() => setConfirm(false)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Button kind="quiet" label={t("Sign out")} onPress={() => setConfirm(true)} />
      )}
      {delStep === "sent" ? (
        <View style={{ gap: space.breath }}>
          <T role="caption" tone="secondary">Your deletion request is in. Your personal data is removed after 30 days. Invoices and warranty records are kept for 8 years with your name and phone removed. You can cancel within 7 days.</T>
          <Button kind="quiet" label="Cancel deletion" busy={delBusy} onPress={() => { setDelBusy(true); void cancelAccountDeletion().then(() => setDelStep("idle")).catch(() => Alert.alert("Could not cancel", "The 7 day window may have passed. Contact the studio.")).finally(() => setDelBusy(false)); }} />
        </View>
      ) : delStep === "ask" ? (
        <View style={{ gap: space.breath }}>
          <T tone="secondary">Delete your account? Your personal data is removed after 30 days. Invoices and warranty records are kept for 8 years with your name and phone removed. You can cancel within 7 days.</T>
          <View style={{ flexDirection: "row", gap: space.breath }}>
            <Button kind="danger" label="Send request" busy={delBusy} style={{ flex: 1 }} onPress={() => { setDelBusy(true); void requestAccountDeletion().then(() => setDelStep("sent")).catch(() => Alert.alert("Could not send", "Try again in a moment.")).finally(() => setDelBusy(false)); }} />
            <Button kind="quiet" label="Cancel" onPress={() => setDelStep("idle")} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Button kind="quiet" label="Delete my account" onPress={() => setDelStep("ask")} />
      )}
    </Screen>
  );
}
