// Customer app building blocks on the AutoDeck experience theme: the dark
// studio ground, one warm amber light, glass panes for the raised layer.
// Screens compose these instead of styling raw views.
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useRouter, useSegments } from "expo-router";
import { Ambient, Glass, type GlassProps, useExperienceTheme, onTabPressed } from "@autodeck/ui/native";
import { fontFamily, motion, radius, space, type as typeScale, type TypeRole } from "@autodeck/ui/theme";

const FALLBACK: Record<TypeRole["family"], string> = {
  display: Platform.select({ web: "Montserrat, 'Noto Sans Gujarati', 'Noto Sans Devanagari', system-ui, sans-serif", default: "System" }) ?? "System",
  body: Platform.select({ web: "Inter, 'Noto Sans Gujarati', 'Noto Sans Devanagari', system-ui, sans-serif", default: "System" }) ?? "System",
  data: Platform.select({ web: "Inter, 'Noto Sans Gujarati', 'Noto Sans Devanagari', system-ui, sans-serif", default: "Menlo" }) ?? "Menlo",
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
// Sub-screens (anything deeper than a tab root, plus membership and
// notifications which live under You) get a quiet back control so no screen
// is a dead end. Falls back to the parent tab when there is no history.
const SUB_ROOTS: Record<string, string> = { membership: "/(tabs)/profile", notifications: "/(tabs)" };
function BackBar() {
  const router = useRouter();
  const segs = useSegments() as string[];
  const { colors } = useExperienceTheme();
  const root = segs[1] ?? "";
  const deep = segs.length >= 3 && !(segs[2] === "index");
  const fallback = SUB_ROOTS[root] ?? (root ? `/(tabs)/${root}` : "/(tabs)");
  if (segs[0] !== "(tabs)" || !(deep || root in SUB_ROOTS)) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
      style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingRight: 12 }}
    >
      <Text style={{ color: colors.textSecondary, fontSize: 20, marginTop: -2 }}>‹</Text>
      <T role="label" tone="secondary">Back</T>
    </Pressable>
  );
}

export function Screen({
  children,
  scroll = true,
  header,
  top,
}: {
  children: ReactNode;
  scroll?: boolean;
  header?: ReactNode;
  /** Pinned above the scroll area (sticky chips, search). */
  top?: ReactNode;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const segs = useSegments() as string[];
  const myTab = segs[0] === "(tabs)" ? (segs[1] ?? "index") : "";
  useEffect(() => onTabPressed((t) => { if (t === myTab) scrollRef.current?.scrollTo({ y: 0, animated: true }); }), [myTab]);
  const body = (
    <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: space.inset, paddingTop: space.section, paddingBottom: 120, gap: space.inset }}>
      <BackBar />
      {header}
      {children}
    </View>
  );
  return (
    <Ambient>
      {top ? <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: space.inset, paddingTop: space.section, gap: space.line, zIndex: 2 }}>{top}</View> : null}
      {scroll ? <ScrollView ref={scrollRef} contentContainerStyle={{ flexGrow: 1 }}>{body}</ScrollView> : body}
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
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D1D3D8", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
      <T role="data" style={{ color: "#16181C", fontWeight: "700", letterSpacing: 1.2 }}>
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
          opacity: off ? 0.45 : 1,
          transform: pressed && !off ? [{ scale: 0.97 }] : [],
          ...(Platform.OS === "web" ? ({ transition: "transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease", cursor: "pointer" } as object) : {}),
          ...(Platform.OS === "web" && primary
            ? ({ backgroundImage: "linear-gradient(180deg, #F59A4E 0%, #EC8638 52%, #DC7428 100%)", boxShadow: pressed ? "0 3px 8px rgba(236,134,56,0.3), inset 0 1px 0 rgba(255,255,255,0.35)" : "0 8px 18px rgba(236,134,56,0.38), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(160,70,10,0.28)" } as object)
            : {}),
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
      {onPress ? <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)" }}><T tone="secondary">›</T></View> : null}
    </Pressable>
  );
}



/** Photographic banner with the theme's hero-settle motion: one quiet
 *  scale-and-fade as it lands. Reduced-motion users get the still frame. */
export function HeroImage({ source, aspect = 21 / 9 }: { source: ImageSourcePropType; aspect?: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    if (Platform.OS === "web" && mm?.("(prefers-reduced-motion: reduce)").matches) {
      setStill(true);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.duration.scene,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [progress]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [motion.heroSettle.scale, 1] });
  return (
    <View style={{ width: "100%", aspectRatio: aspect, overflow: "hidden" }}>
      <Animated.Image
        source={source}
        resizeMode="cover"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", ...(still ? {} : { opacity: progress, transform: [{ scale }] }) }}
      />
    </View>
  );
}

/** Card with a photographic banner over a glass body - the rich catalogue/list unit. */
export function PhotoCard({
  image,
  children,
  onPress,
  imageAspect = 2.4,
}: {
  image: ImageSourcePropType;
  children: ReactNode;
  onPress?: (() => void) | undefined;
  imageAspect?: number;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }], ...(Platform.OS === "web" ? ({ transition: "transform 140ms ease, opacity 140ms ease" } as object) : {}) })}
    >
      <Pane pad="none">
        <HeroImage source={image} aspect={imageAspect} />
        <View style={{ padding: space.gap, gap: space.breath }}>{children}</View>
      </Pane>
    </Pressable>
  );
}

export function Chip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" | "premium" | "danger" }) {
  const { colors } = useExperienceTheme();
  const c = tone === "accent" ? colors.accent : tone === "premium" ? colors.premium : tone === "danger" ? colors.danger : colors.textSecondary;
  return (
    <View style={{ borderRadius: radius.pill, borderWidth: 1, borderColor: c, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.05)" }}>
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

/** Themed text input on the glass kit: label above, data-safe styling. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = "sentences",
  keyboardType = "default",
  multiline = false,
  maxLength,
  error,
  onBlur,
}: {
  onBlur?: (() => void) | undefined;
  error?: string | undefined;
  maxLength?: number;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
  multiline?: boolean;
}) {
  const { colors } = useExperienceTheme();
  return (
    <View style={{ gap: space.hair }}>
      <T role="label" tone="tertiary">{label}</T>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
        style={[
          textStyle("body"),
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.borderSubtle,
            borderRadius: radius.chip,
            paddingHorizontal: space.line,
            paddingVertical: 12,
            minHeight: multiline ? 96 : undefined,
            textAlignVertical: multiline ? "top" : "auto",
          },
        ]}
      />
      {error ? <T role="caption" tone="danger">{error}</T> : null}
    </View>
  );
}

export const rupees = (paise: number): string =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: paise % 100 === 0 ? 0 : 2 })}`;

/** Pulsing placeholder block for loading states. */
export function Skeleton({ height = 56, width = "100%" }: { height?: number; width?: number | `${number}%` }) {
  const { colors } = useExperienceTheme();
  const v = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.8, duration: 700, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.35, duration: 700, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [v]);
  return <Animated.View style={{ height, width, borderRadius: 14, backgroundColor: colors.borderSubtle, opacity: v }} />;
}
