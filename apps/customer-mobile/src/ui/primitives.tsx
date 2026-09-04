/**
 * Shared UI primitives for customer-mobile (Layer 2 in the approved
 * component-architecture blueprint). Every screen must build from these —
 * no per-screen colour, font size, radius, or spacing value.
 */
import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type ViewProps,
} from 'react-native';
import {
  radiusScale,
  shadowScale,
  spacingScale,
  touchTarget,
  typeRamps,
  type TypeRampLevel,
} from '@autodeck/design-tokens';
import { useThemeColors } from './theme';

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

interface ThemedTextProps extends TextProps {
  level?: TypeRampLevel;
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'inherit';
  tabularFigures?: boolean;
  children: ReactNode;
}

/**
 * The only place a screen touches a font size. Wraps the named type ramp
 * (see `@autodeck/design-tokens`'s `typeRamps`) so nothing hardcodes a
 * `fontSize`. `tabularFigures` must be set on every price, quantity, count,
 * duration, or date per the approved UI requirements.
 */
export function ThemedText({ level = 'body', color = 'primary', tabularFigures, style, ...rest }: ThemedTextProps) {
  const colors = useThemeColors();
  const ramp = typeRamps[level];
  const resolvedColor =
    color === 'inherit'
      ? undefined
      : color === 'primary'
        ? colors.textPrimary
        : color === 'secondary'
          ? colors.textSecondary
          : colors[color];

  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: ramp.fontSize,
          lineHeight: ramp.lineHeight,
          fontWeight: ramp.fontWeight,
          color: resolvedColor,
          fontVariant: tabularFigures ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({ children, style, ...rest }: ViewProps & { children: ReactNode }) {
  const colors = useThemeColors();
  return (
    <View {...rest} style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      {children}
    </View>
  );
}

/**
 * react-native-web deprecates `shadow*`/`elevation` in favour of a CSS
 * `boxShadow` string (confirmed via the visual audit — the app was
 * emitting that exact console warning, and elevation was likely not
 * rendering on web at all). React Native's native renderer has no unified
 * `boxShadow` style prop yet, so this resolves per-platform from the same
 * token, rather than picking one at the cost of the other.
 */
function resolveElevation(level: 'card' | 'raised' | 'overlay') {
  const shadow = shadowScale[level];
  if (Platform.OS === 'web') {
    const { shadowOffset, shadowRadius, shadowOpacity } = shadow;
    // `boxShadow` isn't in RN 0.74's ViewStyle typings yet (native has no
    // unified prop for it either), but react-native-web's own deprecation
    // message names it as the correct replacement and passes it straight
    // through to CSS — the cast is narrowly scoped to this one return.
    return {
      boxShadow: `${shadowOffset.width}px ${shadowOffset.height}px ${shadowRadius}px rgba(0,0,0,${shadowOpacity})`,
    } as unknown as typeof shadow;
  }
  return shadow;
}

/**
 * Premium surfaces are distinguished by elevation, not borders — per the
 * approved requirement to avoid excessive borders/decorative chrome.
 */
export function Card({
  children,
  elevation = 'card',
  style,
  ...rest
}: ViewProps & { children: ReactNode; elevation?: 'card' | 'raised' }) {
  const colors = useThemeColors();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radiusScale.md,
          borderCurve: 'continuous',
          padding: spacingScale.md,
        },
        resolveElevation(elevation),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Consistent pressed-state feedback for anything that wraps a Card/row
 * into a tappable target (Explore, Garage, Bookings lists) — promoted here
 * because the pattern repeats in 4+ screens and every tappable element
 * needs pressed feedback per the approved interaction rules; a raw
 * `Pressable` with no style function (the previous implementation) gave
 * none at all.
 */
export function Touchable({
  children,
  style,
  ...rest
}: Omit<PressableProps, 'style'> & { children: ReactNode; style?: PressableProps['style'] }) {
  return (
    <Pressable
      {...rest}
      style={(state) => [
        { opacity: state.pressed ? 0.85 : 1, transform: [{ scale: state.pressed ? 0.99 : 1 }] },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function Divider({ style }: { style?: ViewProps['style'] }) {
  const colors = useThemeColors();
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  children: ReactNode;
  variant?: ButtonVariant;
  style?: PressableProps['style'];
}

/**
 * Every tappable element needs a pressed-state style (per the approved
 * motion/interaction rules) — implemented here once via `Pressable`'s style
 * function so no screen has to remember to add it.
 */
export const Button = forwardRef<View, ButtonProps>(function Button(
  { children, variant = 'primary', disabled, style, ...rest },
  ref
) {
  const colors = useThemeColors();

  const backgroundByVariant: Record<ButtonVariant, string> = {
    primary: colors.accent,
    secondary: colors.surface,
    ghost: 'transparent',
    destructive: colors.danger,
  };
  const textColorByVariant: Record<ButtonVariant, string> = {
    primary: colors.accentContrast,
    secondary: colors.textPrimary,
    ghost: colors.textPrimary,
    destructive: colors.accentContrast,
  };

  return (
    <Pressable
      ref={ref}
      disabled={disabled}
      accessibilityRole="button"
      style={(state) => [
        {
          backgroundColor: backgroundByVariant[variant],
          borderRadius: radiusScale.md,
          borderCurve: 'continuous',
          minHeight: touchTarget.minimum,
          paddingVertical: spacingScale.sm,
          paddingHorizontal: spacingScale.lg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : state.pressed ? 0.85 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <ThemedText level="body" color="inherit" style={{ color: textColorByVariant[variant], fontWeight: '600' }}>
        {children}
      </ThemedText>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Field (Input)
// ---------------------------------------------------------------------------

interface FieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

/**
 * Promoted per the Expo design-system rule: appears in Login and Profile
 * (2+ screens), has a nameable role, and its API is smaller than its
 * implementation (label + error handling wrapping a bare TextInput).
 */
export function Field({ label, error, style, ...rest }: FieldProps) {
  const colors = useThemeColors();
  return (
    <View style={{ marginBottom: spacingScale.md }}>
      <ThemedText level="caption" color="secondary" style={{ marginBottom: spacingScale.xs }}>
        {label}
      </ThemedText>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[
          {
            minHeight: touchTarget.minimum,
            backgroundColor: colors.surface,
            borderRadius: radiusScale.sm,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            paddingHorizontal: spacingScale.md,
            color: colors.textPrimary,
            fontSize: typeRamps.body.fontSize,
          },
          style,
        ]}
        {...rest}
      />
      {error && (
        <ThemedText level="caption" color="danger" style={{ marginTop: spacingScale.xs }}>
          {error}
        </ThemedText>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Badge / Chip
// ---------------------------------------------------------------------------

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

/**
 * Semantic-status surface. Tone must always come from this fixed set — no
 * screen introduces an ad hoc colour for a status, per the approved
 * "consistent semantic status colours" requirement.
 */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const colors = useThemeColors();
  const backgroundByTone: Record<BadgeTone, string> = {
    neutral: colors.border,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  };
  const textByTone: Record<BadgeTone, string> = {
    neutral: colors.textPrimary,
    accent: colors.accentContrast,
    success: colors.accentContrast,
    warning: colors.accentContrast,
    danger: colors.accentContrast,
  };

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: backgroundByTone[tone],
        borderRadius: radiusScale.full,
        paddingVertical: spacingScale.xs / 2,
        paddingHorizontal: spacingScale.sm,
      }}
    >
      <ThemedText level="caption" color="inherit" style={{ color: textByTone[tone], fontWeight: '600' }}>
        {label}
      </ThemedText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skeleton (replaces content-area spinners)
// ---------------------------------------------------------------------------

/**
 * Static skeleton block — deliberately not animated (a shimmer loop would
 * need to respect `useReducedMotion` for no real benefit at this stage).
 * Used for content-area loading per the approved "skeletons, not spinners"
 * requirement; `LoadingState` below remains for full-screen/blocking loads
 * only (initial auth resolution), which is a different situation.
 */
export function Skeleton({ width = '100%', height = 16 }: { width?: number | `${number}%`; height?: number }) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        width,
        height,
        borderRadius: radiusScale.sm,
        backgroundColor: colors.border,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// State surfaces
// ---------------------------------------------------------------------------

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ padding: spacingScale.lg, alignItems: 'center' }}>
      <ActivityIndicator color={colors.accent} />
      <ThemedText level="body" color="secondary" style={{ marginTop: spacingScale.sm }}>
        {label}
      </ThemedText>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ padding: spacingScale.lg }}>
      <ThemedText level="body" color="danger">
        {message}
      </ThemedText>
      {onRetry && (
        <View style={{ marginTop: spacingScale.sm, alignSelf: 'flex-start' }}>
          <Button variant="secondary" onPress={onRetry}>
            Try again
          </Button>
        </View>
      )}
    </View>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <View style={{ padding: spacingScale.lg, alignItems: 'center' }}>
      <ThemedText level="body" color="secondary" style={{ textAlign: 'center' }}>
        {message}
      </ThemedText>
      {action && <View style={{ marginTop: spacingScale.md }}>{action}</View>}
    </View>
  );
}
