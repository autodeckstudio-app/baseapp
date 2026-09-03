'use client';

/**
 * Minimal shared UI foundation for admin-web — intentionally small (per
 * Phase 3A scope: "keep this intentionally minimal... do not build the
 * complete AutoDeck visual design system yet"). Plain inline styles built
 * from `@autodeck/design-tokens`'s existing placeholder token values
 * (colors/spacing/type scale) rather than a CSS framework dependency —
 * there is nothing here a real design system wouldn't still need to
 * restyle once an actual brand decision exists.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { colorTokens, spacingScale, typeScale } from '@autodeck/design-tokens';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: colorTokens.background,
        color: colorTokens.textPrimary,
        fontFamily: 'system-ui, sans-serif',
        padding: spacingScale.lg,
      }}
    >
      {children}
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: colorTokens.surface,
        border: `1px solid ${colorTokens.border}`,
        borderRadius: 8,
        padding: spacingScale.md,
      }}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  const background = variant === 'primary' ? colorTokens.accent : colorTokens.surface;
  const color = variant === 'primary' ? '#FFFFFF' : colorTokens.textPrimary;
  return (
    <button
      {...rest}
      style={{
        background,
        color,
        border: variant === 'primary' ? 'none' : `1px solid ${colorTokens.border}`,
        borderRadius: 6,
        padding: `${spacingScale.sm}px ${spacingScale.md}px`,
        fontSize: typeScale.body,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" style={{ padding: spacingScale.lg, color: colorTokens.textSecondary }}>
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" style={{ padding: spacingScale.lg, color: colorTokens.danger }}>
      <p style={{ fontSize: typeScale.body }}>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: spacingScale.lg, color: colorTokens.textSecondary, textAlign: 'center' }}>{message}</div>
  );
}
