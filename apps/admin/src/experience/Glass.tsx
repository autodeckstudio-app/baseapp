// Web glass pane: the one raised material. Styling lives in
// experience.css (.ad-glass) so the blur, sheen and no-blur fallback travel
// together. Server-component safe (no state, no handlers).
import type { CSSProperties, ElementType, ReactNode } from "react";

export type GlassTone = "accent" | "premium" | "danger" | "warning";
export type GlassFill = "base" | "lit" | "warm" | "cool";

export interface GlassProps {
  children?: ReactNode;
  /** Inner padding token. */
  pad?: "none" | "breath" | "line" | "gap" | "inset";
  round?: "chip" | "card" | "pane" | "sheet" | "hero";
  fill?: GlassFill;
  /** A state's hue on the edge only, when the state is the subject. */
  tone?: GlassTone;
  raised?: boolean;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

export function Glass({
  children,
  pad = "gap",
  round = "card",
  fill = "base",
  tone,
  raised = false,
  as: Tag = "div",
  className,
  style,
}: GlassProps) {
  const cls = [
    "ad-glass",
    fill !== "base" && `ad-glass--${fill}`,
    tone && `ad-glass--tone-${tone}`,
    raised && "ad-glass--raised",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag
      className={cls}
      style={{
        borderRadius: `var(--ad-radius-${round})`,
        padding: pad === "none" ? 0 : `var(--ad-space-${pad})`,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
