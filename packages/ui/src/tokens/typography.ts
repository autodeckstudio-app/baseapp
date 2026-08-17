// Typography scale. Each entry is a plain style object — spreadable directly
// into a React Native StyleSheet. fontSize/lineHeight are in RN's density-
// independent points; a web consumer spreading these into a CSS-in-JS style
// must append "px" to lineHeight (unitless line-height in CSS is a
// font-size multiplier, not an absolute value, unlike React Native).
export const typography = {
  display: { fontSize: 32, fontWeight: "700", lineHeight: 38 },
  heading: { fontSize: 22, fontWeight: "700", lineHeight: 28 },
  title: { fontSize: 17, fontWeight: "600", lineHeight: 22 },
  body: { fontSize: 15, fontWeight: "400", lineHeight: 21 },
  bodyMedium: { fontSize: 15, fontWeight: "600", lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  captionMedium: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  label: { fontSize: 11, fontWeight: "600", lineHeight: 14, letterSpacing: 0.4 },
  // Numeric/price sizes — pair with numericStyle (RN-only) for tabular figures.
  price: { fontSize: 24, fontWeight: "700", lineHeight: 29 },
  priceSmall: { fontSize: 17, fontWeight: "700", lineHeight: 22 },
} as const;

export type TypographyToken = keyof typeof typography;
