import { createElement, type ReactNode } from "react";
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
// Minimal img stand-in so CarThumb render tests can assert a resolved photo paints.
export const FadeImage = (props: any) => createElement("img", { src: props?.source?.uri, style: props?.style, onError: props?.onError });
