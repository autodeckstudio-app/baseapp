import type { ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { nightButtonStyle, nightButtonText } from "../theme/night.js";
import { AUTH, AUTH_FOOTNOTE } from "../theme/auth.js";
import { createElement } from "react";
import { Logo } from "./Logo.js";

/** The one sign-in layout for every AutoDeck app: static studio photo, dark veil, logo, one glass card. Same in day and night; only role, title and copy differ. */
export const AUTH_PHOTO_GROUND = "linear-gradient(180deg, rgba(5,5,6,0.55) 0%, rgba(5,5,6,0.92) 100%), url(/hero-studio.jpg)";
export function AuthCard({ role, title, copy, children, error }: { role: string; title: string; copy: string; children: ReactNode; error?: string | null; dark?: boolean }) {
  const web = Platform.OS === "web";
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "#050506", ...(web ? ({ backgroundImage: AUTH_PHOTO_GROUND, backgroundSize: "cover", backgroundPosition: "center", minHeight: "100vh" } as object) : {}) }}>
      <View style={{ width: "100%", maxWidth: 420, alignItems: "center", gap: 18 }}>
        <Logo onDark variant="stacked" height={84} />
        <View
          style={{
            width: "100%", borderRadius: 32, padding: 24, gap: 14, alignItems: "center",
            backgroundColor: "rgba(18,18,20,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)",
            ...(web ? ({ backdropFilter: "blur(26px) saturate(140%)", WebkitBackdropFilter: "blur(26px) saturate(140%)", boxShadow: "0 18px 50px rgba(0,0,0,0.5)" } as object) : {}),
          }}
        >
          <Text style={{ color: "#F59A45", fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "600" }}>{role}</Text>
          <Text style={{ color: "#F6F4F1", fontFamily: "Montserrat, Inter, sans-serif", fontSize: 26, fontWeight: "700", textAlign: "center" }}>{title}</Text>
          <Text style={{ color: "#CDCBC8", fontSize: 15, lineHeight: 22, textAlign: "center" }}>{copy}</Text>
          <View style={{ width: "100%", gap: 10, marginTop: 6 }}>{children}</View>
          {error ? <Text style={{ color: "#FF8D7A", fontSize: 13, textAlign: "center" }}>{error}</Text> : null}
          <Text style={{ color: "#A9A7A4", fontSize: 12, textAlign: "center" }}>{AUTH_FOOTNOTE}</Text>
        </View>
      </View>
    </View>
  );
}

/** The sign-in button, identical in every app. */
export function AuthButton({ label, onPress, busy, disabled, testID, dark: _darkProp = true, soft = false }: { dark?: boolean; soft?: boolean; label: string; onPress: () => void; busy?: boolean; disabled?: boolean; testID?: string }) {
  const night = false; // the sign-in button is the same orange in every mode
  const dark = true;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => ({ height: AUTH.buttonHeight, borderRadius: AUTH.buttonRadius, backgroundColor: soft ? "rgba(255,255,255,0.16)" : dark ? "#F59A45" : AUTH.accent, ...(soft ? { borderWidth: 1, borderColor: "rgba(255,255,255,0.32)" } : null), flexDirection: "row", alignItems: "center", justifyContent: "center", opacity: busy || disabled ? 0.6 : pressed ? 0.88 : 1, ...(dark && !soft && Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg, #F9B060 0%, #F59A45 55%, #EC8638 100%)" } as object) : {}), ...(night && Platform.OS === "web" ? nightButtonStyle : {}) })}
    >
      {Platform.OS === "web" ? createElement("svg", { width: 18, height: 18, viewBox: "0 0 48 48", "aria-hidden": true, style: { marginRight: 10 }, dangerouslySetInnerHTML: { __html: G } }) : null}
      <Text style={{ color: soft ? "#FFFFFF" : night && Platform.OS === "web" ? nightButtonText : dark ? "#1A1410" : "#fff", fontSize: 16, fontWeight: "600" }}>{busy ? "Please wait..." : label}</Text>
    </Pressable>
  );
}

const G = '<path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>';
