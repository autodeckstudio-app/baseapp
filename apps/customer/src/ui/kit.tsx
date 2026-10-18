// Customer app building blocks on the AutoDeck experience theme: the dark
// studio ground, one warm amber light, glass panes for the raised layer.
// Screens compose these instead of styling raw views.
import { AppBar } from "./AppBar";
import { reportScroll, resetNavScroll } from "../lib/nav-scroll";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  useWindowDimensions,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useRouter, useSegments, useFocusEffect } from "expo-router";
import { glassSurface, glassQuiet } from "../lib/glass";
import { raised } from "../lib/raised";
const inkButton = (mode: string) => raised(mode as never).dark;
import { Ambient as BaseAmbient, type GlassProps, useExperienceTheme, onTabPressed } from "@autodeck/ui/native";
import { floatHero, fontFamily, layout, motion, radius, space, type as typeScale, type TypeRole } from "@autodeck/ui/theme";

const FALLBACK: Record<TypeRole["family"], string> = {
  display: Platform.select({ web: "Montserrat, Inter, 'Noto Sans Gujarati', 'Noto Sans Devanagari', system-ui, sans-serif", default: "System" }) ?? "System",
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

import { ACCENT_TEXT_ROLES } from "../lib/accent";
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
  const { name, colors } = useExperienceTheme();
  // Accent text is for small highlights only. Large roles (prices, titles, data) stay neutral. See lib/accent.ts.
  if (tone === "accent" && !ACCENT_TEXT_ROLES.includes(role as string)) tone = "primary";
  const color = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    accent: name === "night" ? "#F5A25A" : colors.accentStrong,
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
// One header on every screen: avatar (or Back on a drill-down), screen name, bell. Same height everywhere.
// Tab roots (index, bookings, catalogue = Services, garage, profile) never show Back: the nav is their way around.
const SUB_ROOTS: Record<string, string> = { studio: "/(tabs)", membership: "/(tabs)/profile", notifications: "/(tabs)", cars: "/(tabs)", help: "/(tabs)" };
const BAR_TITLES: Record<string, string> = { bookings: "Bookings", catalogue: "Services", garage: "Garage", profile: "You", membership: "Membership", notifications: "Notifications", studio: "The studio", help: "Help", cars: "Cars", book: "Book", approvals: "Approval", invoice: "Invoice", gifts: "Gifts" };
function useBar(appBar?: string, onBackOverride?: () => void) {
  const router = useRouter();
  const segs = useSegments() as string[];
  const root = segs[1] ?? "";
  if (segs[0] !== "(tabs)") return appBar ? { title: appBar } : null;
  const deep = segs.length >= 3 && !(segs[2] === "index");
  const fallback = SUB_ROOTS[root] ?? (root ? `/(tabs)/${root}` : "/(tabs)");
  const title = appBar ?? BAR_TITLES[root];
  if (!title) return null;
  const back = onBackOverride ?? (deep || root in SUB_ROOTS ? () => (router.canGoBack() ? router.back() : router.replace(fallback as never)) : undefined);
  return { title, back };
}

function Ambient({ children }: { children?: ReactNode }) {
  return <BaseAmbient style={{ backgroundColor: "transparent", ...(Platform.OS === "web" ? ({ backgroundImage: "none" } as object) : null) }}>{children}</BaseAmbient>;
}

/** Studio photo behind the top of a screen (web), as on the canvas layout. */
export function CanvasBackdrop() {
  const { name, colors } = useExperienceTheme();
  if (Platform.OS !== "web") return null;
  return <View pointerEvents="none" style={floatHero(name === "night", colors.canvas) as never} />;
}

/** Eyebrow and a large heading that sits on the photo. */
export function CanvasTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  const web = Platform.OS === "web";
  const shadow = web ? { textShadow: "0 1px 12px rgba(0,0,0,.5)" } : {};
  return (
    <View style={{ minHeight: 150, justifyContent: "flex-end" }}>
      {eyebrow ? <T role="label" style={{ color: "rgba(255,255,255,.92)", ...shadow } as never}>{eyebrow}</T> : null}
      <T role="display" numberOfLines={1} style={{ fontSize: 52, lineHeight: 56, fontWeight: "500", letterSpacing: -2.2, color: "rgba(255,255,255,.95)", ...(web ? { textShadow: "0 6px 40px rgba(0,0,0,.4)" } : {}) } as never}>{title}</T>
    </View>
  );
}

/** Every page opens the same way: a small orange kicker, one specific statement, and one line of real detail. */
export function PageHeader({ kicker, title, sub }: { kicker?: string; title: string; sub?: string | null }) {
  return (
    <View style={{ gap: 4 }}>
      {kicker ? <Kicker tone="accent">{kicker}</Kicker> : null}
      <T role="title" style={{ fontSize: 26, lineHeight: 32, fontWeight: "700" } as never}>{title}</T>
      {sub ? <T role="body" tone="secondary">{sub}</T> : null}
    </View>
  );
}

/** One section heading size for every list on every page. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <T role="heading" style={{ fontSize: 18, fontWeight: "700" } as never}>{children}</T>;
}

export function Screen({
  children,
  scroll = true,
  header,
  top,
  canvas = false,
  appBar,
  onBack,
}: {
  /** Shared tab header: avatar, screen name, bell. Pass the screen name. */
  appBar?: string;
  /** A level inside one screen (Services category) steps back here instead of using a second back link. */
  onBack?: (() => void) | undefined;
  /** Show the photo backdrop behind the header (use with CanvasTitle). */
  canvas?: boolean;
  children: ReactNode;
  scroll?: boolean;
  header?: ReactNode;
  /** Pinned above the scroll area (sticky chips, search). */
  top?: ReactNode;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const bar = useBar(appBar, onBack);
  const {width}=useWindowDimensions();
  const gutter=width<360?layout.screenInsetCompact:layout.screenInset;
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    resetNavScroll();
    return () => setFocused(false);
  }, []));
  const segs = useSegments() as string[];
  const myTab = segs[0] === "(tabs)" ? (segs[1] ?? "index") : "";
  useEffect(() => onTabPressed((t) => { if (t === myTab) scrollRef.current?.scrollTo({ y: 0, animated: true }); }), [myTab]);
  const body = (
    <View style={{ width: "100%", maxWidth: layout.readingMeasure, alignSelf: "center", paddingHorizontal: gutter, paddingTop: top ? space.gap : space.inset, paddingBottom: 120, gap: 20 }}>
      {bar && !top ? <AppBar title={bar.title} onBack={bar.back} /> : null}
      {header}
      {children}
    </View>
  );
  if (!focused) return null;
  return (
    <Ambient>
      {canvas ? <CanvasBackdrop /> : null}
      {top ? <View style={{ width: "100%", maxWidth: layout.readingMeasure, alignSelf: "center", paddingHorizontal: gutter, paddingTop: space.inset, gap: space.line, zIndex: 2 }}>{bar ? <AppBar title={bar.title} onBack={bar.back} /> : null}{top}</View> : null}
      {scroll ? <ScrollView ref={scrollRef} scrollEventThrottle={16} onScroll={(e) => reportScroll(e.nativeEvent.contentOffset.y)} contentContainerStyle={{ flexGrow: 1 }}>{body}</ScrollView> : body}
    </Ambient>
  );
}

/** Solid dark card in the reference style (replaces the blurred glass pane). */
export function Pane({ children, pad = "gap", tone, fill, style, testID }: GlassProps) {
  const { colors } = useExperienceTheme();
  const edge = tone ? colors[tone] : "transparent";
  return (
    <View testID={testID} style={[{ borderRadius: 24, overflow: "hidden", ...glassSurface, ...(fill === "warm" ? { backgroundColor: colors.accentHaze } : null), ...(tone ? { borderColor: edge, borderWidth: 1 } : null), padding: pad === "none" ? 0 : pad === "inset" ? 16 : space[pad] }, style as never]}>
      {children}
    </View>
  );
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
  const { colors, name } = useExperienceTheme();
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
          marginTop: primary ? layout.primaryActionGap : 0,
          borderRadius: radius.pill,
          paddingHorizontal: space.inset,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: space.breath,
          ...(primary ? inkButton(name) : glassQuiet),
          ...(kind === "danger" ? { borderColor: colors.danger } : null),
          opacity: off ? 0.45 : 1,
          transform: pressed && !off ? [{ scale: 0.97 }] : [],
          ...(Platform.OS === "web" ? ({ transition: "transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease", cursor: "pointer" } as object) : {}),
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={primary ? (name === "light" ? "#FFFFFF" : "#16181C") : colors.textPrimary} /> : null}
      <T role="bodyStrong" tone={primary ? "onAccent" : kind === "danger" ? "danger" : "primary"} style={primary ? { color: name === "light" ? "#FFFFFF" : "#16181C", fontWeight: "700" } : undefined}>
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
  const { colors, name } = useExperienceTheme();
  const night = name === "night";
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
      {onPress ? <View style={{ width: 28, height: 28, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: night ? "rgba(255,255,255,0.07)" : "rgba(20,22,26,0.06)" }}><T tone="secondary">›</T></View> : null}
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
  const { colors, name } = useExperienceTheme();
  const c = tone === "accent" ? colors.textPrimary : tone === "premium" ? colors.premium : tone === "danger" ? colors.danger : colors.textSecondary;
  return (
    <View style={{ borderRadius: radius.pill, borderWidth: 1, borderColor: c, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start", backgroundColor: name === "night" ? "rgba(255,255,255,0.08)" : "rgba(29,27,38,0.05)" }}>
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
    <View style={{ gap: space.breath }}>
      <T role="label" tone="tertiary">{label}</T>
      <TextInput
        accessibilityLabel={label}
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

export { rupees } from "../lib/money";

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
  return <Animated.View style={{ height, width, borderRadius: 12, backgroundColor: colors.borderSubtle, opacity: v }} />;
}
