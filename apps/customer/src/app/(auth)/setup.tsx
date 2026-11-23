import { LegalLinks } from "../../ui/LegalLinks";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import {useExperienceTheme} from "@autodeck/ui/native";
import { space } from "@autodeck/ui/theme";
import { Ambient } from "../../ui/kit";
import { setupCustomerProfile, refreshAuthToken, auth, isClaimRequired, rememberMyCustomerDocId } from "../../lib/auth-service";
import { Button, Kicker, Pane, T } from "../../ui/kit";

export default function SetupScreen() {
  // Google gives us a name; the customer can correct it.
  const [name, setName] = useState(auth.currentUser?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const {colors,name:appearance}=useExperienceTheme();

  async function handleSetup() {
    if (name.trim().length < 2) {
      setError("Enter your name (at least 2 characters).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await setupCustomerProfile(name.trim());
      if (isClaimRequired(res)) {
        // The studio already has a record for this email (walk-in). Claim it
        // with the counter code instead of making a parallel profile.
        router.replace({ pathname: "/(auth)/claim", params: { renewal: res.renewalRequired ? "1" : "0" } });
        return;
      }
      const id = typeof res.customerId === "string" && res.customerId
        ? res.customerId
        : typeof (res.customer as { id?: unknown })?.id === "string" ? (res.customer as { id: string }).id : null;
      if (id) await rememberMyCustomerDocId(id);
      // Force-refresh token to receive custom claims (role, tenantId)
      await refreshAuthToken();
      router.replace("/(tabs)");
    } catch {
      setError("We couldn't finish setting up your account. Please try again in a moment.");
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
        <ScrollView style={{width:"100%"}} contentContainerStyle={{flexGrow:1,justifyContent:"center",gap:24,paddingVertical:24}} keyboardShouldPersistTaps="handled"><Pane pad="inset"><View style={{gap:24}}><View style={{ gap: space.line }}>
          <Kicker tone="accent">One step</Kicker>
          <T role="title" style={{fontSize:30,lineHeight:36}}>What should we call you?</T>
          <T tone="secondary">The studio team sees this name on your bookings.</T>
        </View>
        <TextInput
          accessibilityLabel="Your name"
          placeholderTextColor={colors.textTertiary}
          style={{minHeight:52,paddingHorizontal:16,paddingVertical:14,borderRadius:18,borderWidth:1,borderColor:colors.borderSubtle,color:colors.textPrimary,fontSize:16,backgroundColor:appearance==="light"?"#F5F8FC":"#233246"}}
          placeholder="Your name"
          autoCapitalize="words"
          maxLength={100}
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void handleSetup()}
        />
        {error ? <T role="caption" tone="danger">{error}</T> : null}
        <Button label="Continue" onPress={() => void handleSetup()} busy={busy} testID="setup-continue" />
        </View></Pane><LegalLinks /></ScrollView>
      </KeyboardAvoidingView>
    </Ambient>
  );
}
