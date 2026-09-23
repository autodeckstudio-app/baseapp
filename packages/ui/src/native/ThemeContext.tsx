import { createContext, useContext, type ReactNode } from "react";
import { themeColors, glass, type ThemeColors, type GlassRecipe, type ThemeName } from "../theme/index.js";

export interface ExperienceTheme {
  name: ThemeName;
  colors: ThemeColors;
  glass: GlassRecipe;
}

function build(name: ThemeName): ExperienceTheme {
  return { name, colors: themeColors[name], glass: glass[name] };
}

const ThemeContext = createContext<ExperienceTheme>(build("dark"));

/** Staff devices default dark; customers may choose (persisted by the app). */
export function ExperienceThemeProvider({ name = "dark", children }: { name?: ThemeName; children: ReactNode }) {
  return <ThemeContext.Provider value={build(name)}>{children}</ThemeContext.Provider>;
}

export function useExperienceTheme(): ExperienceTheme {
  return useContext(ThemeContext);
}
