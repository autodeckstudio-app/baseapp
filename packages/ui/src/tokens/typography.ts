// Typography scale. Each entry is a plain style object - spreadable directly
// into a React Native StyleSheet. fontSize/lineHeight are in RN's density-
// independent points; a web consumer spreading these into a CSS-in-JS style
// must append "px" to lineHeight (unitless line-height in CSS is a
// font-size multiplier, not an absolute value, unlike React Native).
export const typography = {
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

export type TypographyToken = keyof typeof typography;
