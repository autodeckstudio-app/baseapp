import { vi, it, expect } from "vitest";
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
import {
  applyCustomerRaisedTheme,
  lightColors,
  nightColors,
  contrastRatio,
} from "@autodeck/ui/theme";
import {
  applyCustomerSoftNight,
  customerNight,
  nightAction,
} from "./customer-night";
import { raised } from "./raised";
it("Customer soft night leaves day values unchanged and provides readable tonal surfaces/actions", () => {
  applyCustomerRaisedTheme();
  const before = { ...lightColors };
  applyCustomerSoftNight();
  expect(lightColors).toEqual(before);
  expect(nightColors.canvas).toBe(customerNight.canvas);
  expect(raised("night").ground).toBe(customerNight.canvas);
  expect(raised("night").card.backgroundColor).toBe(customerNight.surface);
  for (const background of [
    customerNight.canvas,
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
  expect(raised("light").card.backgroundColor).toBe("#FFFFFF");
});
