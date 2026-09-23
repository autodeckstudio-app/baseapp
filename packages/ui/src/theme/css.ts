// CSS custom properties for the web (admin). One source of truth: the web
// stylesheet reads these variables; values live in the TS tokens.
import { themeColors, type ThemeName } from "./colors.js";
import { ambient, ambientBackground, glass } from "./glass.js";
import { depth, layout, motion, radius, space, cubicBezier } from "./scale.js";

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

export function themeVariables(name: ThemeName): Record<string, string> {
  const c = themeColors[name];
  const g = glass[name];
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(c)) vars[`--ad-${kebab(k)}`] = v;
  vars["--ad-glass-fill"] = g.fill;
  vars["--ad-glass-fill-lit"] = g.fillLit;
  vars["--ad-glass-fill-warm"] = g.fillWarm;
  vars["--ad-glass-fill-cool"] = g.fillCool;
  vars["--ad-glass-fallback"] = g.fallbackFill;
  vars["--ad-glass-chrome"] = g.chromeFill;
  vars["--ad-glass-edge"] = g.edge;
  vars["--ad-glass-sheen"] = g.sheen;
  vars["--ad-glass-blur"] = `blur(${g.blur}px) saturate(${g.saturate})`;
  vars["--ad-glass-chrome-blur"] = `blur(${g.chromeBlur}px) saturate(${g.saturate})`;
  vars["--ad-ambient"] = ambientBackground(ambient[name], c.canvas);
  vars["--ad-accent-grad"] =
    name === "dark"
      ? "linear-gradient(120deg, #F0C48C 0%, #E0A45C 46%, #E8D9BE 100%)"
      : "linear-gradient(120deg, #8F6326 0%, #7A521E 50%, #5E3F16 100%)";
  return vars;
}

export function scaleVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(space)) vars[`--ad-space-${kebab(k)}`] = `${v}px`;
  for (const [k, v] of Object.entries(radius)) vars[`--ad-radius-${kebab(k)}`] = `${v}px`;
  for (const [k, v] of Object.entries(depth)) vars[`--ad-shadow-${kebab(k)}`] = v.shadow;
  vars["--ad-hit"] = `${layout.minimumHitArea}px`;
  vars["--ad-measure"] = `${layout.readingMeasure}px`;
  vars["--ad-sidebar"] = `${layout.sidebarWidth}px`;
  for (const [k, v] of Object.entries(motion.duration)) vars[`--ad-dur-${k}`] = `${v}ms`;
  vars["--ad-ease"] = cubicBezier(motion.easing.ease);
  vars["--ad-ease-exit"] = cubicBezier(motion.easing.exit);
  return vars;
}

function block(selector: string, vars: Record<string, string>): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `${selector} {\n${body}\n}`;
}

/**
 * Full stylesheet text: dark is the default ground (staff and admin default
 * dark); `[data-theme="light"]` switches roles. Reduced motion zeroes
 * durations.
 */
export function themeStylesheet(): string {
  return [
    block(":root", { ...scaleVariables(), ...themeVariables("dark") }),
    block('[data-theme="light"]', themeVariables("light")),
    `@media (prefers-reduced-motion: reduce) {\n${block(":root", {
      "--ad-dur-tick": "0ms",
      "--ad-dur-move": "0ms",
      "--ad-dur-scene": "0ms",
      "--ad-dur-morph": "0ms",
    })}\n}`,
  ].join("\n\n");
}
