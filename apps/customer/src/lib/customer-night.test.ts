import { vi, it, expect } from "vitest";
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
import {
  applyCustomerRaisedTheme,
  lightColors,
  nightColors,
  contrastRatio,material,
} from "@autodeck/ui/theme";
import {
  applyCustomerSoftNight,
  customerNight,
  nightAction,
} from "./customer-night";
import { raised } from "./raised";

/** Alpha-composite a foreground rgba string over a hex ground, for contrast checks on translucent glass. */
function composite(fg: string, bg: string): string {
  const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(fg);
  if (!m) return fg;
  const [, r, g, b, a] = m;
  const alpha = Number(a);
  const gb = parseInt(bg.slice(1, 3), 16), gg = parseInt(bg.slice(3, 5), 16), bb = parseInt(bg.slice(5, 7), 16);
  const mix = (f: number, t: number) => Math.round(f * alpha + t * (1 - alpha));
  return `#${[mix(Number(r), gb), mix(Number(g), gg), mix(Number(b), bb)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

it("Customer soft night leaves day values unchanged and provides readable tonal surfaces/actions", () => {
  applyCustomerRaisedTheme();
  const before = { ...lightColors };
  applyCustomerSoftNight();
  expect(lightColors).toEqual(before);
  expect(nightColors.canvas).toBe(customerNight.canvas);
  expect(raised("night").ground).toBe(customerNight.canvas);
  // The night card is translucent glass: it must lighten the ground, never paint an opaque slab.
  const nightCard = String(raised("night").card.backgroundColor);
  expect(nightCard).toBe(material("night","surface",{reduce:true}).fallback);
  const cardOverCanvas = composite(nightCard, customerNight.canvas);
  for (const background of [
    customerNight.canvas,
    cardOverCanvas,
    customerNight.surface,
    customerNight.surfaceElevated,
  ])
    for (const text of [
      customerNight.textPrimary,
      customerNight.textSecondary,
      customerNight.textTertiary,
    ])
      expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
  expect(
    contrastRatio(nightAction.text, nightAction.background),
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    contrastRatio(nightAction.selectedText, nightAction.selected),
  ).toBeGreaterThanOrEqual(4.5);
  expect(customerNight.accent).toBe("#EC8638");
  for (const background of [customerNight.canvas, cardOverCanvas, customerNight.surface, customerNight.surfaceElevated])
    expect(contrastRatio(customerNight.accent, background)).toBeGreaterThanOrEqual(4.5);
  // Day cards stay white-family glass: translucent white, composited over the white ground it stays bright.
  const dayCard = String(raised("light").card.backgroundColor);
  expect(dayCard).toBe(material("light","surface",{reduce:true}).fallback);
  expect(contrastRatio(lightColors.textPrimary, composite(dayCard, "#FFFFFF"))).toBeGreaterThanOrEqual(4.5);
});
