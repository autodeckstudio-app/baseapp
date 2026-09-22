export const experienceColors = {
  dark: {
    canvas: "#08090A",
    surface: "#15161A",
    surfaceElevated: "#1E2024",
    borderSubtle: "rgba(255,255,255,0.08)",
    textPrimary: "#EDEBE7",
    textSecondary: "#ADACA9",
    textTertiary: "#91918F",
    accent: "#E0A45C",
    accentStrong: "#F0C48C",
    premium: "#E8D9BE",
    success: "#E8D9BE",
    warning: "#E0A45C",
    danger: "#E2705A",
    inactive: "#8A8F96",
  },
  light: {
    canvas: "#F7F7F6",
    surface: "#FFFFFF",
    surfaceElevated: "#F4F4F3",
    borderSubtle: "rgba(20,21,23,0.08)",
    textPrimary: "#141517",
    textSecondary: "rgba(20,21,23,0.75)",
    textTertiary: "rgba(20,21,23,0.52)",
    accent: "#7A521E",
    accentStrong: "#5E3F16",
    premium: "#7A521E",
    success: "#1F7A4D",
    warning: "#8A6512",
    danger: "#B93838",
    inactive: "rgba(20,21,23,0.32)",
  },
} as const;

export const experienceSpace = {
  hair: 4,
  breath: 8,
  line: 12,
  gap: 16,
  inset: 24,
  rest: 48,
  scene: 96,
} as const;

export const experienceRadius = {
  chip: 12,
  card: 16,
  pane: 20,
  sheet: 24,
  hero: 32,
  pill: 9999,
} as const;

export const experienceMotion = {
  duration: { tick: 120, move: 280, scene: 480, morph: 620 },
  easing: { ease: [0.22, 1, 0.36, 1] as const, exit: [0.4, 0, 1, 1] as const },
  spring: { stiffness: 420, damping: 38, mass: 1 },
  reduced: { disableTransforms: true, allowOpacity: true, duration: 0 },
} as const;

export type ExperienceThemeName = keyof typeof experienceColors;
export type ExperienceTheme = (typeof experienceColors)[ExperienceThemeName];
