// Typography scale. Each entry is a plain style object - spreadable directly
// into a React Native StyleSheet. fontSize/lineHeight are in RN's density-
// independent points; a web consumer spreading these into a CSS-in-JS style
// must append "px" to lineHeight (unitless line-height in CSS is a
// font-size multiplier, not an absolute value, unlike React Native).
// Phone sizes. Phones (window 430 wide or less) read the smaller column; everything else keeps the
// desktop column. One scale, so no screen picks its own number.
export const PHONE_MAX_WIDTH = 430;
export const PHONE_SIZES: Record<string, [number, number]> = {
  display: [28, 34], heading: [20, 26], title: [16, 22], body: [14, 20], bodyMedium: [14, 20],
  caption: [12, 17], captionMedium: [12, 17], label: [11, 15], price: [22, 28], priceSmall: [16, 20],
};

/** Current window width in points, or 0 when unknown (server render, tests). */
export function windowWidth(): number {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  if (typeof w === "number" && w > 0) return w;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = typeof require === "function" ? (require("react-native") as { Dimensions?: { get: (k: string) => { width: number } } }) : null;
    return rn?.Dimensions?.get("window").width ?? 0;
  } catch {
    return 0;
  }
}
export const isPhoneWidth = (w: number = windowWidth()): boolean => w > 0 && w <= PHONE_MAX_WIDTH;

/** A size that shrinks on phones: phoneFont(56, 40) is 56 on large screens and 40 on a phone. */
export function phoneFont(large: number, phone: number, w?: number): number {
  return isPhoneWidth(w) ? phone : large;
}

const desktopTypography = {
  display: { fontFamily: "Montserrat, 'Noto Sans Gujarati', 'Noto Sans Devanagari', Inter, system-ui, sans-serif", fontSize: 32, fontWeight: "600", lineHeight: 38, letterSpacing: -0.5 },
  heading: { fontFamily: "Montserrat, 'Noto Sans Gujarati', 'Noto Sans Devanagari', Inter, system-ui, sans-serif", fontSize: 22, fontWeight: "600", lineHeight: 28, letterSpacing: -0.3 },
  title: { fontFamily: "Montserrat, 'Noto Sans Gujarati', 'Noto Sans Devanagari', Inter, system-ui, sans-serif", fontSize: 18, fontWeight: "600", lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: "Inter, 'Noto Sans Gujarati', 'Noto Sans Devanagari', system-ui, sans-serif", fontSize: 15, fontWeight: "400", lineHeight: 22 },
  bodyMedium: { fontFamily: "Inter, 'Noto Sans Gujarati', 'Noto Sans Devanagari', system-ui, sans-serif", fontSize: 15, fontWeight: "600", lineHeight: 22 },
  caption: { fontFamily: "Inter, 'Noto Sans Gujarati', 'Noto Sans Devanagari', system-ui, sans-serif", fontSize: 13, fontWeight: "400", lineHeight: 18 },
  captionMedium: { fontFamily: "Inter, 'Noto Sans Gujarati', 'Noto Sans Devanagari', system-ui, sans-serif", fontSize: 13, fontWeight: "600", lineHeight: 18 },
  label: { fontFamily: "Inter, 'Noto Sans Gujarati', 'Noto Sans Devanagari', system-ui, sans-serif", fontSize: 12, fontWeight: "600", lineHeight: 16, letterSpacing: 0.6 },
  price: { fontFamily: "Inter, 'Noto Sans Gujarati', 'Noto Sans Devanagari', system-ui, sans-serif", fontSize: 24, fontWeight: "600", lineHeight: 30 },
  priceSmall: { fontFamily: "Inter, 'Noto Sans Gujarati', 'Noto Sans Devanagari', system-ui, sans-serif", fontSize: 17, fontWeight: "600", lineHeight: 22 },
} as const;


/** Tokens at the size for this device. Fixed when the app loads (a phone does not change width). */
export function typographyFor(w?: number) {
  const phone = isPhoneWidth(w);
  const out: Record<string, Record<string, string | number>> = {};
  for (const [k, v] of Object.entries(desktopTypography)) {
    const sz = PHONE_SIZES[k];
    out[k] = phone && sz ? { ...v, fontSize: sz[0], lineHeight: sz[1] } : { ...v };
  }
  return out as unknown as typeof desktopTypography;
}
export const typography = typographyFor();
export { desktopTypography };

export type TypographyToken = keyof typeof desktopTypography;
