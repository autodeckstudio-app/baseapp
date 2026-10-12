// Surface recipes shared by every customer screen. They are plain style
// objects filled in place from lib/raised.ts for the current theme, so a
// spread like ...glassSurface always matches day or night. The root calls
// setSurfaceMode(name) before it renders children and remounts on a flip.
import type { ViewStyle } from "react-native";
import { raised, type Mode } from "./raised";

export const glassSurface: ViewStyle = {};
export const glassInner: ViewStyle = {};
export const glassOrange: ViewStyle = {};
export const glassQuiet: ViewStyle = {};

function fill(target: ViewStyle, src: ViewStyle) {
  for (const k of Object.keys(target)) delete (target as Record<string, unknown>)[k];
  Object.assign(target, src);
}

let current: Mode | null = null;
export function setSurfaceMode(mode: Mode): void {
  if (current === mode) return;
  current = mode;
  const r = raised(mode);
  fill(glassSurface, { ...r.card });
  fill(glassInner, { ...r.well, borderRadius: 14 });
  fill(glassOrange, { ...r.primary });
  fill(glassQuiet, { ...r.quiet });
}
setSurfaceMode("night");
