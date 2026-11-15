import { LegalLinks } from "../../ui/LegalLinks";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TextInput } from "@autodeck/ui";
import { space } from "@autodeck/ui/theme";
import { Ambient } from "@autodeck/ui/native";
import { claimCustomerRecord, setupCustomerProfile, refreshAuthToken, isClaimRequired, signOut, rememberMyCustomerDocId } from "../../lib/auth-service";
import { Button, Kicker, T } from "../../ui/kit";

/**
 * The studio created a record for this email at the counter (walk-in).
 * The customer proves ownership with the one-time code from the studio PLUS
 * this account's verified Google email (checked server-side). Failures are
 * deliberately flat - the screen never learns whether a code or record exists.
 */
export default function ClaimScreen() {
  const { renewal } = useLocalSearchParams<{ renewal?: string }>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClaim() {
    const cleaned = code.trim();
    if (cleaned.replace(/[^0-9A-Za-z]/g, "").length !== 8) {
      setError("Enter the 8-character code from the studio.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const claim = await claimCustomerRecord(cleaned);
      // Claim sets claims server-side; setup now returns the CLAIMED profile.
      const res = await setupCustomerProfile();
      if (isClaimRequired(res)) {
        // The claim was accepted but the profile did not follow: an anomaly
        // for the studio, NOT a wrong code - never misreport it as one.
        setError("Your record did not finish linking. Please contact the studio team.");
        return;
      }
      const id = typeof res.customerId === "string" && res.customerId
        ? res.customerId
        : typeof (res.customer as { id?: unknown })?.id === "string" ? (res.customer as { id: string }).id : claim.customerId;
      await rememberMyCustomerDocId(id);
      await refreshAuthToken();
      router.replace("/(tabs)");
    } catch {
      // Flat by design: wrong code, expired code and locked code all read the same.
      setError("That code did not work. Check it with the studio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Ambient>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "center", width: "100%", maxWidth: 480, alignSelf: "center", padding: space.inset, gap: space.inset }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={{ gap: space.line }}>
          <Kicker tone="accent">Welcome back</Kicker>
          <T role="display">Enter your studio code</T>
          <T tone="secondary">
            {renewal === "1"
              ? "Ask the AutoDeck studio team for a code, then enter it here."
              : "The studio team gave you a code at the counter. Enter it to pick up your cars and history."}
          </T>
        </View>
        <TextInput
          placeholder="XXXX-XXXX"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9}
          value={code}
          onChangeText={setCode}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void handleClaim()}
        />
        {error ? <T role="caption" tone="danger">{error}</T> : null}
        <Button label="Link my record" onPress={() => void handleClaim()} busy={busy} testID="claim-continue" />
        <Button
          label="I don't have a code"
          kind="quiet"
          onPress={() => {
            void (async () => {
              await signOut();
              router.replace("/(auth)/welcome");
            })();
          }}
          testID="claim-no-code"
        />
        <T role="caption" tone="secondary">No code? Ask the AutoDeck studio team - they can give you one in person.</T>
        <LegalLinks />
      </KeyboardAvoidingView>
    </Ambient>
  );
}
