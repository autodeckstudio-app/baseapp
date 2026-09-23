// Customer app building blocks on the AutoDeck experience theme: the dark
// studio ground, one warm amber light, glass panes for the raised layer.
// Screens compose these instead of styling raw views.
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Ambient, Glass, type GlassProps, useExperienceTheme } from "@autodeck/ui/native";
import { fontFamily, radius, space, type as typeScale, type TypeRole } from "@autodeck/ui/theme";

const FALLBACK: Record<TypeRole["family"], string> = {
  display: Platform.select({ web: "Outfit, system-ui, sans-serif", default: "System" }) ?? "System",
  body: Platform.select({ web: "'DM Sans', system-ui, sans-serif", default: "System" }) ?? "System",
  data: Platform.select({ web: "'DM Mono', ui-monospace, monospace", default: "Menlo" }) ?? "Menlo",
};

export function textStyle(role: keyof typeof typeScale): TextStyle {
  const r: TypeRole = typeScale[role];
  return {
    fontFamily: Platform.OS === "web" ? FALLBACK[r.family] : fontFamily[r.family],
    fontSize: r.size,
    lineHeight: r.lineHeight,
    fontWeight: r.weight,
    letterSpacing: r.letterSpacing,
    ...(r.uppercase ? { textTransform: "uppercase" as const } : {}),
    ...(r.tabular ? { fontVariant: ["tabular-nums" as const] } : {}),
  };
}

export function T({
  role = "body",
  tone = "primary",
  style,
  children,
  numberOfLines,
}: {
  role?: keyof typeof typeScale;
  tone?: "primary" | "secondary" | "tertiary" | "accent" | "premium" | "danger" | "onAccent";
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const { colors } = useExperienceTheme();
  const color = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    accent: colors.accent,
    premium: colors.premium,
    danger: colors.danger,
    onAccent: colors.textOnAccent,
  }[tone];
  return (
    <Text numberOfLines={numberOfLines} style={[textStyle(role), { color }, style]}>
      {children}
    </Text>
  );
}

/** Full screen: ambient ground, scrolling column capped at reading width. */
export function Screen({
  children,
  scroll = true,
  header,
}: {
  children: ReactNode;
  scroll?: boolean;
  header?: ReactNode;
}) {
  const body = (
    <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: space.inset, paddingTop: space.section, paddingBottom: 120, gap: space.inset }}>
      {header}
      {children}
    </View>
  );
  return (
    <Ambient>
      {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }}>{body}</ScrollView> : body}
    </Ambient>
  );
}

export function Pane(props: GlassProps) {
  return <Glass {...props} />;
}

export function Kicker({ children, tone = "tertiary" }: { children: ReactNode; tone?: "tertiary" | "accent" | "premium" }) {
  return (
    <T role="label" tone={tone}>
      {children}
    </T>
  );
}

/** Registration plate in the data face, normalized: GJ 01 AB 1234. */
export function formatPlate(reg: string): string {
  const s = reg.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(s);
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(" ") : s;
}

export function Plate({ value }: { value: string }) {
  const { colors } = useExperienceTheme();
  return (
    <View style={{ alignSelf: "flex-start", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <T role="data" tone="secondary" style={{ letterSpacing: 1.2 }}>
        {formatPlate(value)}
      </T>
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = "primary",
  disabled,
  busy,
  style,
  testID,
}: {
  label: string;
  onPress?: () => void;
  kind?: "primary" | "quiet" | "danger";
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useExperienceTheme();
  const primary = kind === "primary";
  const off = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 48,
          borderRadius: radius.pill,
          paddingHorizontal: space.inset,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: space.breath,
          backgroundColor: primary ? colors.accent : "transparent",
          borderWidth: primary ? 0 : 1,
          borderColor: kind === "danger" ? colors.danger : colors.borderStrong,
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={primary ? colors.textOnAccent : colors.textPrimary} /> : null}
      <T role="bodyStrong" tone={primary ? "onAccent" : kind === "danger" ? "danger" : "primary"}>
        {label}
      </T>
    </Pressable>
  );
}

export function Row({
  title,
  detail,
  trailing,
  onPress,
  last,
}: {
  title: ReactNode;
  detail?: ReactNode | undefined;
  trailing?: ReactNode | undefined;
  onPress?: (() => void) | undefined;
  last?: boolean | undefined;
}) {
  const { colors } = useExperienceTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.line,
        paddingVertical: space.line,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        {typeof title === "string" ? <T role="bodyStrong">{title}</T> : title}
        {detail ? typeof detail === "string" ? <T role="caption" tone="tertiary">{detail}</T> : detail : null}
      </View>
      {trailing}
      {onPress ? <T tone="tertiary">›</T> : null}
    </Pressable>
  );
}

export function Chip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" | "premium" | "danger" }) {
  const { colors } = useExperienceTheme();
  const c = tone === "accent" ? colors.accent : tone === "premium" ? colors.premium : tone === "danger" ? colors.danger : colors.textSecondary;
  return (
    <View style={{ borderRadius: radius.pill, borderWidth: 1, borderColor: c, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}>
      <T role="label" style={{ color: c }}>
        {label}
      </T>
    </View>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  const { colors } = useExperienceTheme();
  return (
    <Ambient>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.line }}>
        <ActivityIndicator color={colors.accent} />
        <T role="label" tone="tertiary">{label}</T>
      </View>
    </Ambient>
  );
}

/** Empty / failed / offline states share one quiet pane. */
export function Notice({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <Pane pad="inset">
      <View style={{ gap: space.breath }}>
        <T role="heading">{title}</T>
        {body ? <T tone="secondary">{body}</T> : null}
        {action ? <View style={{ marginTop: space.breath }}>{action}</View> : null}
      </View>
    </Pane>
  );
}

export const rupees = (paise: number): string =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: paise % 100 === 0 ? 0 : 2 })}`;
