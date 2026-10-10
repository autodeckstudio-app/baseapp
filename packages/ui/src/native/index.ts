// Experience primitives for the AutoDeck mobile app (spec §4). Web
// equivalents live in apps/admin/src/experience.
export { ExperienceThemeProvider, AutoExperienceThemeProvider, useAutoThemeName, useExperienceTheme, type ExperienceTheme } from "./ThemeContext.js";
export { Glass, type GlassProps, type GlassTone } from "./Glass.js";
export { Ambient } from "./Ambient.js";
export { Icon } from "./Icon.js";
export { PillTabBar } from "./PillTabBar.js";
export { Logo } from "./Logo.js";
export { AuthCard, AuthButton } from "./AuthCard.js";
export { installWebFonts } from "./webFonts.js";

export { FadeImage } from "./FadeImage.js";
export { FadeUp } from "./FadeUp.js";
export { onTabPressed, emitTabPressed } from "./tabBus.js";
