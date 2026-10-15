// One size rulebook for every customer page. Screens import these instead of picking numbers.
// Scale: 4 8 12 16 20. Card corner 24, inner corner 16. Section gap 20, inside a section 12.
export const metrics = {
  sectionGap: 20,
  innerGap: 12,
  cardPad: 16,
  cardRadius: 24,
  innerRadius: 16,
  rowPadV: 14,
  rowPadH: 16,
  thumb: 44,
  heroTall: 200,
  heroCompact: 128,
  heroStage: 260,
  story: 56,
} as const;

/** Allowed values on the 4-point scale; the guard test checks the shared metrics against it. */
export const SCALE = [0, 4, 8, 12, 14, 16, 20, 24, 32, 44, 56, 64, 128, 200, 260] as const;
