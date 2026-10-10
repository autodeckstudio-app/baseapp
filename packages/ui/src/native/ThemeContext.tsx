import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { currentMode, watchMode, themeColors, glass, type ThemeColors, type GlassRecipe, type ThemeName } from "../theme/index.js";

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

/** Day (light) or night by the device setting and local clock; re-evaluates while the app is open. */
export function useAutoThemeName(): "light" | "night" {
  const [mode, setMode] = useState<"light" | "night">(currentMode);
  useEffect(() => {
    setMode(currentMode());
    return watchMode(setMode);
  }, []);
  return mode;
}

export function AutoExperienceThemeProvider({ children }: { children: ReactNode }) {
  const name = useAutoThemeName();
  return <ExperienceThemeProvider name={name}>{children}</ExperienceThemeProvider>;
}
