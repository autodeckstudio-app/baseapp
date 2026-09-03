/**
 * Minimal shared UI foundation for customer-mobile — intentionally small
 * (per Phase 3A scope). Plain React Native primitives styled from
 * `@autodeck/design-tokens`'s existing placeholder token values, not a
 * component-library dependency.
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';
import { colorTokens, spacingScale, typeScale } from '@autodeck/design-tokens';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colorTokens.background, padding: spacingScale.lg }}>{children}</View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colorTokens.surface,
        borderWidth: 1,
        borderColor: colorTokens.border,
        borderRadius: 8,
        padding: spacingScale.md,
      }}
    >
      {children}
    </View>
  );
}

export function Button({
  children,
  variant = 'primary',
  ...rest
}: PressableProps & { children: ReactNode; variant?: 'primary' | 'secondary' }) {
  const background = variant === 'primary' ? colorTokens.accent : colorTokens.surface;
  const color = variant === 'primary' ? '#FFFFFF' : colorTokens.textPrimary;
  return (
    <Pressable
      {...rest}
      style={{
        backgroundColor: background,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: colorTokens.border,
        borderRadius: 6,
        paddingVertical: spacingScale.sm,
        paddingHorizontal: spacingScale.md,
        alignItems: 'center',
      }}
    >
      <Text style={{ color, fontSize: typeScale.body }}>{children}</Text>
    </Pressable>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={{ padding: spacingScale.lg, alignItems: 'center' }}>
      <ActivityIndicator color={colorTokens.accent} />
      <Text style={{ color: colorTokens.textSecondary, marginTop: spacingScale.sm }}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ padding: spacingScale.lg }}>
      <Text style={{ color: colorTokens.danger, fontSize: typeScale.body }}>{message}</Text>
      {onRetry && (
        <View style={{ marginTop: spacingScale.sm }}>
          <Button variant="secondary" onPress={onRetry}>
            Try again
          </Button>
        </View>
      )}
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={{ padding: spacingScale.lg, alignItems: 'center' }}>
      <Text style={{ color: colorTokens.textSecondary, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}
