import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { membershipOnlinePayCopy, terminalPayOutcome } from "./native-pay-core";

const read = (p: string) => readFileSync(resolve(".", "src", p), "utf8");

describe("terminalPayOutcome", () => {
  it("maps only server-settled statuses to outcomes", () => {
    expect(terminalPayOutcome("completed")).toBe("paid");
    expect(terminalPayOutcome("failed")).toBe("failed");
    expect(terminalPayOutcome("cancelled")).toBe("failed");
  });
  it("keeps full and partial refunds distinct, and never presents returned money as paid", () => {
    expect(terminalPayOutcome("refunded")).toBe("refunded");
    expect(terminalPayOutcome("partially_refunded")).toBe("partially_refunded");
    // "completed" is the only status that may ever read as paid.
    for (const st of ["pending", "processing", "failed", "cancelled", "refunded", "partially_refunded"]) {
      expect(terminalPayOutcome(st)).not.toBe("paid");
    }
  });
  it("never settles in-flight or unknown statuses", () => {
    expect(terminalPayOutcome("pending")).toBeNull();
    expect(terminalPayOutcome("processing")).toBeNull();
    expect(terminalPayOutcome(null)).toBeNull();
    expect(terminalPayOutcome(undefined)).toBeNull();
    expect(terminalPayOutcome("paid")).toBeNull(); // client must not invent a status
  });
});

describe("native payment link flow", () => {
  const s = read("lib/razorpay-checkout.ts");
  it("attaches the Firestore listener before opening the browser", () => {
    expect(s.indexOf("onSnapshot(")).toBeGreaterThan(-1);
    expect(s.indexOf("onSnapshot(")).toBeLessThan(s.indexOf("openBrowserAsync"));
  });
  it("never resolves paid from the browser return", () => {
    const browserBlock = s.split("openBrowserAsync")[1]!;
    expect(browserBlock).not.toContain('finish("paid")');
    expect(browserBlock).not.toContain("finish('paid')");
  });
  it("has a bounded wait: browser-close grace plus an overall cap, both ending in pending", () => {
    expect(s).toContain('setTimeout(() => finish("pending"), 20_000)');
    expect(s).toContain('setTimeout(() => finish("pending"), 180_000)');
  });
  it("recovers the paymentUrl from the Payment doc when the callable replay omits it", () => {
    expect(s).toContain("paymentUrl ?? (await paymentUrlFor(paymentId)");
  });
  it("web keeps Standard Checkout; native uses the hosted link", () => {
    expect(s).toMatch(/if \(Platform\.OS === "web"\) \{\s*return payWithCheckout/);
  });
});

describe("paying screens present refund outcomes truthfully", () => {
  it("no paying screen claims a refund settles what is owed", () => {
    for (const p of ["app/(tabs)/bookings/[id].tsx", "app/(tabs)/book/confirm.tsx", "app/(tabs)/membership/purchase.tsx"]) {
      expect(read(p)).not.toContain("no balance is due");
    }
  });
  it("booking screens distinguish full and partial refunds", () => {
    for (const p of ["app/(tabs)/bookings/[id].tsx", "app/(tabs)/book/confirm.tsx"]) {
      const src = read(p);
      expect(src).toContain('out === "refunded"');
      expect(src).toContain('out === "partially_refunded"');
      expect(src).toContain("refunded in full");
      expect(src).toContain("Part of this payment was refunded");
    }
  });
  it("the membership screen derives its done copy from membershipOnlinePayCopy with the live listener state", () => {
    const src = read("app/(tabs)/membership/purchase.tsx");
    // The screen renders the extracted done-notice with the raw outcome + live tier;
    // the notice component owns the membershipOnlinePayCopy call (render tests in
    // ui/membership-done-notice.render.test.tsx prove the wiring behaviorally).
    expect(src).toContain("<MembershipDoneNotice");
    expect(src).toContain("payOutcome={payOutcome}");
    expect(src).toContain("activeTier={active?.tier ?? null}");
    const notice = read("ui/membership-done-notice.tsx");
    expect(notice).toContain("membershipOnlinePayCopy(payOutcome, activeTier)");
    // No entitlement claim may be hardcoded in the screen or the notice.
    expect(src).not.toContain("The membership is not active");
    expect(src).not.toContain("No membership is active");
    expect(src).not.toContain("membership stays active");
    expect(src).not.toContain("No membership was activated");
    // The "activates on its own" copy lives only in the in-flight branch of the
    // shared copy function (behavioral tests below pin that), not in the screen.
    expect(src).not.toContain("activates on its own once verified");
    expect(read("lib/native-pay-core.ts")).toContain("activates on its own once verified");
    for (const bad of ["The membership is not active", "No membership is active", "membership stays active", "No membership was activated", "activates on its own once verified"]) {
      expect(notice).not.toContain(bad);
    }
  });
});

describe("paying screens use the platform-routing entry point", () => {
  for (const p of ["app/(tabs)/bookings/[id].tsx", "app/(tabs)/book/confirm.tsx", "app/(tabs)/membership/purchase.tsx"]) {
    it(`${p} pays through payOnline and never gates on checkoutSupported`, () => {
      const src = read(p);
      expect(src).toContain("payOnline({");
      expect(src).not.toContain("checkoutSupported");
      expect(src).not.toContain("payWithCheckout(");
    });
  }
});

describe("membershipOnlinePayCopy: payment facts never override entitlement", () => {
  it("refunded upgrade payment keeps an existing active membership in the copy", () => {
    const c = membershipOnlinePayCopy("refunded", "Elite");
    expect(c.title).toBe("Payment refunded");
    expect(c.body).toContain("refunded in full");
    expect(c.body).toContain("Elite membership stays active");
    expect(c.body).not.toContain("not active");
  });
  it("refund with no other active membership states the membership is not active (policy: full refund stops benefits)", () => {
    const c = membershipOnlinePayCopy("refunded", null);
    expect(c.body).toContain("refunded in full");
    expect(c.body).toContain("Any membership linked to this payment is not active");
    expect(c.body).not.toContain("stays active");
  });
  it("partial refund stays distinct and never implies settled dues", () => {
    const c = membershipOnlinePayCopy("partially_refunded", "Elite");
    expect(c.title).toBe("Payment partially refunded");
    expect(c.body).toContain("Part of this payment was refunded");
    expect(c.body).toContain("stays active");
    expect(c.body).not.toContain("refunded in full");
  });
  it("failed payment keeps existing membership and offers retry", () => {
    const c = membershipOnlinePayCopy("failed", "Elite");
    expect(c.title).toBe("Payment failed");
    expect(c.body).toContain("Elite membership stays active");
    expect(c.body).toContain("try again");
  });
  it("failed first payment activates nothing", () => {
    expect(membershipOnlinePayCopy("failed", null).body).toContain("No membership was activated");
  });
  it("in-flight payment says activation happens on verification, never before", () => {
    const c = membershipOnlinePayCopy(null, null);
    expect(c.title).toBe("Almost done");
    expect(c.body).toContain("activates on its own once verified");
    expect(c.body).not.toContain("stays active");
  });
});
