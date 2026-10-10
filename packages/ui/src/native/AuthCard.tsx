import type { ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { nightGround, nightSurfaceStyle, nightButtonStyle, nightButtonText } from "../theme/night.js";
import { AUTH, AUTH_FOOTNOTE } from "../theme/auth.js";
import { currentMode } from "../theme/autoMode.js";
import { createElement } from "react";
import { Logo } from "./Logo.js";

/** The one sign-in layout for every AutoDeck app. Same card, logo, button slot and footnote; only role, title and copy differ. */
export function AuthCard({ role, title, copy, children, error, dark: darkProp = false }: { role: string; title: string; copy: string; children: ReactNode; error?: string | null; dark?: boolean }) {
  const web = Platform.OS === "web";
  const night = currentMode() === "night";
  const dark = darkProp || night;
  const A0 = dark
    ? { ...AUTH, ground: "radial-gradient(60vmax 60vmax at 100% 0%, rgba(245,154,69,0.18), transparent 70%), linear-gradient(170deg, #141416 0%, #0B0B0D 50%, #050506 100%)", groundFallback: "#0B0B0D", cardBg: "rgba(21,21,23,0.92)", cardBorder: "rgba(255,255,255,0.10)", cardShadow: "0 18px 50px rgba(0,0,0,0.6)", text: "#F6F4F1", muted: "#C4C2BF", accent: "#F59A45", danger: "#FF8D7A" }
    : AUTH;
  const A = night ? { ...A0, ground: nightGround, groundFallback: "#50504D", cardBg: "rgba(72,72,69,0.96)", accent: "#EC8638" } : A0;
  return (
    <>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: A.groundFallback, ...(web ? ({ backgroundImage: A.ground, minHeight: "100vh" } as object) : {}) }}>
        <View
          style={{
            width: "100%",
            maxWidth: A.maxWidth,
            alignItems: "center",
            gap: 14,
            padding: A.cardPad,
            borderRadius: A.cardRadius,
            backgroundColor: A.cardBg,
            borderWidth: 1,
            borderColor: A.cardBorder,
            ...(web && night ? nightSurfaceStyle : {}),
            ...(web ? ({ boxShadow: A.cardShadow } as object) : { shadowColor: "#3C285A", shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } }),
          }}
        >
          <Logo onDark={dark} variant="stacked" height={A.logoHeight} />
          <Text style={{ color: A.accent, fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "600" }}>{role}</Text>
          <Text style={{ color: A.text, fontFamily: "Montserrat, Inter, sans-serif", fontSize: 24, fontWeight: "600", textAlign: "center" }}>{title}</Text>
          <Text style={{ color: A.muted, fontSize: 15, lineHeight: 22, textAlign: "center" }}>{copy}</Text>
          <View style={{ width: "100%", gap: 10, marginTop: 6 }}>{children}</View>
          {error ? <Text style={{ color: A.danger, fontSize: 13, textAlign: "center" }}>{error}</Text> : null}
          <Text style={{ color: A.muted, fontSize: 12, textAlign: "center", opacity: 0.8 }}>{AUTH_FOOTNOTE}</Text>
        </View>
      </View>
    </>
  );
}

/** The sign-in button, identical in every app. */
export function AuthButton({ label, onPress, busy, disabled, testID, dark: darkProp = false }: { dark?: boolean; label: string; onPress: () => void; busy?: boolean; disabled?: boolean; testID?: string }) {
  const night = currentMode() === "night";
  const dark = darkProp || night;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => ({ height: AUTH.buttonHeight, borderRadius: AUTH.buttonRadius, backgroundColor: dark ? "#F59A45" : AUTH.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", opacity: busy || disabled ? 0.6 : pressed ? 0.88 : 1, ...(dark && Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg, #F9B060 0%, #F59A45 55%, #EC8638 100%)" } as object) : {}), ...(night && Platform.OS === "web" ? nightButtonStyle : {}) })}
    >
      {Platform.OS === "web" ? createElement("svg", { width: 18, height: 18, viewBox: "0 0 48 48", "aria-hidden": true, style: { marginRight: 10 }, dangerouslySetInnerHTML: { __html: G } }) : null}
      <Text style={{ color: night && Platform.OS === "web" ? nightButtonText : dark ? "#1A1410" : "#fff", fontSize: 16, fontWeight: "600" }}>{busy ? "Please wait..." : label}</Text>
    </Pressable>
  );
}

const G = '<path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>';
