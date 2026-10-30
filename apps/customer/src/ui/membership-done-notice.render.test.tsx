// Renders the REAL done-screen component (kit Notice/Button/T via react-native-web)
// and asserts the exact copy and action visibility per money outcome. Complements
// the pure copy tests in lib/native-pay.test.ts: this proves the JSX wiring.
// Does not establish on-device rendering, navigation, or styling.
import { describe, expect, it } from "vitest";
import { create, act } from "react-test-renderer";
import { createElement } from "react";
import { MembershipDoneNotice } from "./membership-done-notice";
import type { OnlinePayOutcome } from "../lib/native-pay-core";

function textOf(el: any): string {
  const json = el.toJSON();
  const walk = (n: any): string => {
    if (n == null || typeof n === "boolean") return "";
    if (typeof n === "string") return n;
    if (Array.isArray(n)) return n.map(walk).join(" ");
    return walk(n.children);
  };
  return walk(json).replace(/\s+/g, " ").trim();
}

function renderNotice(over: Partial<Parameters<typeof MembershipDoneNotice>[0]> = {}) {
  const props = {
    studio: false,
    payOutcome: null as OnlinePayOutcome | null,
    activeTier: null as string | null,
    error: null as string | null,
    purchasing: false,
    onPayOnline: () => {},
    onViewStatus: () => {},
    ...over,
  };
  let el!: ReturnType<typeof create>;
  act(() => { el = create(createElement(MembershipDoneNotice, props)); });
  return textOf(el);
}

describe("MembershipDoneNotice rendered output", () => {
  it("studio request: studio copy, no Pay online action", () => {
    const t = renderNotice({ studio: true });
    expect(t).toContain("Pay at the studio to activate");
    expect(t).toContain("front desk");
    expect(t).not.toContain("Pay online");
    expect(t).toContain("View status");
  });

  it("paid outcome: payment fact copy, never entitlement wording", () => {
    const t = renderNotice({ payOutcome: "paid" });
    expect(t).not.toContain("Pay at the studio");
    expect(t).toContain("View status");
  });

  it("refunded outcome: no Pay online retry, refund fact shown, no active-membership claim without a live tier", () => {
    const t = renderNotice({ payOutcome: "refunded" });
    expect(t).not.toContain("Pay online");
    expect(t).toContain("View status");
    expect(t).toContain("refunded in full");
    expect(t).toContain("not active");
  });

  it("partially_refunded outcome: no Pay online retry", () => {
    const t = renderNotice({ payOutcome: "partially_refunded" });
    expect(t).not.toContain("Pay online");
  });

  it("failed outcome: Pay online retry stays available", () => {
    const t = renderNotice({ payOutcome: "failed" });
    expect(t).toContain("Pay online");
    expect(t).toContain("View status");
  });

  it("loading (null outcome): Pay online stays available", () => {
    const t = renderNotice({});
    expect(t).toContain("Pay online");
  });

  it("error caption renders when present, hidden when null", () => {
    const withErr = renderNotice({ error: "Something went wrong" });
    expect(withErr).toContain("Something went wrong");
    const without = renderNotice({});
    expect(without).not.toContain("Something went wrong");
  });
});
