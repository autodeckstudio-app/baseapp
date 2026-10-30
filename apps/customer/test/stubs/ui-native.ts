import type { ReactNode } from "react";
export const useExperienceTheme = () => ({
  name: "night",
  colors: {
    textPrimary: "#fff", textSecondary: "#ccc", textTertiary: "#999",
    accentStrong: "#F5A25A", accentHaze: "#333", premium: "#fff", danger: "#f00", onAccent: "#000",
  },
});
export const Ambient = ({ children }: { children?: ReactNode }) => children ?? null;
export const onTabPressed = () => () => {};
export type GlassProps = any;
export const Icon = () => null;
