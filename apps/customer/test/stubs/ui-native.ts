import { createElement, type ReactNode } from "react";
export const useExperienceTheme = () => ({
  name: "night",
  colors: {
    textPrimary: "#fff", textSecondary: "#ccc", textTertiary: "#999",
    accent: "#EC8638", accentStrong: "#F5A25A", accentHaze: "#333", borderSubtle: "#444", premium: "#fff", danger: "#f00", onAccent: "#000",
  },
});
export const LiquidAmbient = ({ children }: { children?: ReactNode }) => children ?? null;
export const onTabPressed = () => () => {};
export type GlassProps = any;
export const Icon = () => null;
// Minimal img stand-in so CarThumb render tests can assert a resolved photo paints.
export const FadeImage = (props: any) => createElement("img", { src: props?.source?.uri, style: props?.style, onError: props?.onError });

// Material shell adapter for node-only interaction tests. Actual material pixels
// and native behavior are qualified separately, not asserted by this adapter.
export const LiquidGlass=({children}: {children?:ReactNode})=>createElement("div",null,children);

export const useReduceTransparency=()=>false;

export const Ambient=LiquidAmbient;export const Glass=LiquidGlass;
