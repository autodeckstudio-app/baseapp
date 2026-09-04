'use client';

/**
 * Shared UI foundation for admin-web — the web counterpart to
 * customer-mobile's/studio-mobile's Layer 2 primitives, built on the same
 * centralized tokens (`@autodeck/design-tokens`) but as DOM elements, not
 * React Native components — per the approved principle that UI components
 * are not shared pixel-for-pixel across native and web, only the design
 * *language* is.
 *
 * Inter is the approved working typography direction, but no font asset
 * is loaded in this pass (risk of a build-time network fetch failing in
 * this environment via `next/font/google` was judged not worth it for a
 * visual-validation pass) — the system font stack stands in, exactly
 * mirroring the same disclosed placeholder used in customer-mobile and
 * studio-mobile. Swapping in real Inter later touches only `FONT_STACK`.
 */
import {
  createContext,
  useContext,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import {
  radiusScale,
  spacingScale,
  touchTarget,
  typeRamps,
  type TypeRampLevel,
} from '@autodeck/design-tokens';
import { useThemeColors } from './theme';

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function Screen({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  return (
    <div style={{ minHeight: '100vh', background: colors.background, color: colors.textPrimary, fontFamily: FONT_STACK }}>
      {children}
    </div>
  );
}

type TextColor = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'inherit';

export function ThemedText({
  level = 'body',
  color = 'primary',
  tabularFigures,
  as: Tag = 'div',
  children,
  style,
}: {
  level?: TypeRampLevel;
  color?: TextColor;
  tabularFigures?: boolean;
  as?: 'div' | 'span' | 'p' | 'h1' | 'h2';
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const colors = useThemeColors();
  const ramp = typeRamps[level];
  const resolvedColor = color === 'inherit' ? undefined : color === 'primary' ? colors.textPrimary : color === 'secondary' ? colors.textSecondary : colors[color];

  return (
    <Tag
      style={{
        margin: 0,
        fontFamily: FONT_STACK,
        fontSize: ramp.fontSize,
        lineHeight: `${ramp.lineHeight}px`,
        fontWeight: ramp.fontWeight,
        color: resolvedColor,
        fontVariantNumeric: tabularFigures ? 'tabular-nums' : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export function Card({ children, style, elevation = 'card' }: { children: ReactNode; style?: React.CSSProperties; elevation?: 'card' | 'raised' }) {
  const colors = useThemeColors();
  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radiusScale.md,
        border: `1px solid ${colors.border}`,
        boxShadow: elevation === 'raised' ? '0 4px 10px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.05)',
        padding: spacingScale.md,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Divider() {
  const colors = useThemeColors();
  return <div style={{ height: 1, background: colors.border }} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export function Button({
  children,
  variant = 'primary',
  disabled,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const colors = useThemeColors();
  const [pressed, setPressed] = useState(false);

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
  const borderByVariant: Record<ButtonVariant, string> = {
    primary: 'none',
    secondary: `1px solid ${colors.border}`,
    ghost: 'none',
    destructive: 'none',
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        fontFamily: FONT_STACK,
        background: backgroundByVariant[variant],
        color: textColorByVariant[variant],
        border: borderByVariant[variant],
        borderRadius: radiusScale.sm,
        minHeight: touchTarget.minimum,
        padding: `${spacingScale.sm}px ${spacingScale.lg}px`,
        fontSize: typeRamps.body.fontSize,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        transition: 'opacity 150ms ease-out',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null }) {
  const colors = useThemeColors();
  return (
    <div style={{ marginBottom: spacingScale.md }}>
      <ThemedText as="div" level="caption" color="secondary" style={{ marginBottom: spacingScale.xs }}>
        {label}
      </ThemedText>
      <input
        {...rest}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: FONT_STACK,
          minHeight: touchTarget.minimum,
          background: colors.surface,
          border: `1px solid ${error ? colors.danger : colors.border}`,
          borderRadius: radiusScale.sm,
          padding: `0 ${spacingScale.md}px`,
          fontSize: typeRamps.body.fontSize,
          color: colors.textPrimary,
        }}
      />
      {error && (
        <ThemedText as="div" level="caption" color="danger" style={{ marginTop: spacingScale.xs }}>
          {error}
        </ThemedText>
      )}
    </div>
  );
}

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

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
    <span
      style={{
        display: 'inline-block',
        background: backgroundByTone[tone],
        color: textByTone[tone],
        borderRadius: radiusScale.full,
        padding: `2px ${spacingScale.sm}px`,
        fontSize: typeRamps.caption.fontSize,
        fontWeight: 600,
        fontFamily: FONT_STACK,
      }}
    >
      {label}
    </span>
  );
}

export function Skeleton({ width = '100%', height = 16 }: { width?: string | number; height?: number }) {
  const colors = useThemeColors();
  return <div style={{ width, height, borderRadius: radiusScale.sm, background: colors.border }} />;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" style={{ padding: spacingScale.lg }}>
      <ThemedText color="secondary">{label}</ThemedText>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" style={{ padding: spacingScale.lg }}>
      <ThemedText color="danger">{message}</ThemedText>
      {onRetry && (
        <div style={{ marginTop: spacingScale.sm }}>
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div style={{ padding: spacingScale.xl, textAlign: 'center' }}>
      <ThemedText color="secondary">{message}</ThemedText>
      {action && <div style={{ marginTop: spacingScale.md }}>{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table — the desktop data-table primitive Bookings/Customers/Vehicles/
// Staff/Payments all need. Promoted here per the Expo design-system rule:
// 5+ screens need it, nameable role, small API (columns + rows).
// ---------------------------------------------------------------------------

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

export function Table<T extends { id: string }>({ columns, rows, emptyMessage }: { columns: TableColumn<T>[]; rows: T[]; emptyMessage: string }) {
  const colors = useThemeColors();

  if (rows.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${colors.border}`, borderRadius: radiusScale.md }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_STACK }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: col.align ?? 'left',
                  padding: `${spacingScale.sm}px ${spacingScale.md}px`,
                  borderBottom: `1px solid ${colors.border}`,
                  fontSize: typeRamps.caption.fontSize,
                  color: colors.textSecondary,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    textAlign: col.align ?? 'left',
                    padding: `${spacingScale.sm}px ${spacingScale.md}px`,
                    borderBottom: `1px solid ${colors.border}`,
                    fontSize: typeRamps.body.fontSize,
                    color: colors.textPrimary,
                  }}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar shell — persistent left nav + top header, per the approved
// "desktop-first, not mobile tabs" requirement.
// ---------------------------------------------------------------------------

const SectionContext = createContext('Overview');
export function useCurrentSection() {
  return useContext(SectionContext);
}

export function AdminShell({
  sections,
  currentSection,
  onSignOut,
  children,
}: {
  sections: { key: string; label: string; href: string }[];
  currentSection: string;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const colors = useThemeColors();

  return (
    <SectionContext.Provider value={currentSection}>
      <div style={{ display: 'flex', minHeight: '100vh', background: colors.background }}>
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            background: colors.surface,
            borderRight: `1px solid ${colors.border}`,
            padding: spacingScale.md,
            display: 'flex',
            flexDirection: 'column',
            gap: spacingScale.xs,
          }}
        >
          <ThemedText level="subheading" style={{ padding: spacingScale.sm, marginBottom: spacingScale.sm }}>
            AutoDeck Admin
          </ThemedText>
          {sections.map((section) => (
            <a
              key={section.key}
              href={section.href}
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                padding: `${spacingScale.sm}px ${spacingScale.sm}px`,
                borderRadius: radiusScale.sm,
                background: section.key === currentSection ? colors.background : 'transparent',
                minHeight: touchTarget.minimum,
              }}
            >
              <ThemedText
                as="span"
                level="body"
                color={section.key === currentSection ? 'accent' : 'primary'}
                style={{ fontWeight: section.key === currentSection ? 600 : 400 }}
              >
                {section.label}
              </ThemedText>
            </a>
          ))}
        </aside>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <header
            style={{
              height: 64,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `0 ${spacingScale.lg}px`,
              borderBottom: `1px solid ${colors.border}`,
              background: colors.surface,
            }}
          >
            <ThemedText level="caption" color="secondary">
              AutoDeck Admin / {currentSection}
            </ThemedText>
            <Button variant="secondary" onClick={onSignOut}>
              Log out
            </Button>
          </header>
          <main style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: spacingScale.xl, maxWidth: 1200, width: '100%', overflowX: 'auto' }}>
            {children}
          </main>
        </div>
      </div>
    </SectionContext.Provider>
  );
}
