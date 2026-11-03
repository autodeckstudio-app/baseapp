import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ callback: null as null | ((s: unknown) => void), initial: null as string | null, unsub: vi.fn(), browser: vi.fn(async () => ({ type: "cancel" })), os: "android" }));
vi.mock("react-native", () => ({ Platform: { get OS() { return h.os; } } }));
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), getDoc: vi.fn(), onSnapshot: (_ref: unknown, cb: (s: unknown) => void) => { h.callback = cb; if (h.initial) cb({ exists: () => true, data: () => ({ status: h.initial }) }); return h.unsub; } }));
vi.mock("expo-web-browser", () => ({ openBrowserAsync: (...args: unknown[]) => h.browser(...args as []) }));
vi.mock("./firebase", () => ({ db: {}, functions: {} }));
import { payOnline, payWithPaymentLink } from "./razorpay-checkout";
const emit = (status: string) => h.callback?.({ exists: () => true, data: () => ({ status }) });
describe("hosted native payment lifecycle", () => {
  beforeEach(() => { vi.useFakeTimers(); h.initial = null; h.os = "android"; vi.clearAllMocks(); h.browser.mockResolvedValue({ type: "cancel" }); });
  afterEach(() => vi.useRealTimers());
  it("subscribes before browser opens and never treats browser close as paid", async () => {
    h.browser.mockImplementationOnce(async () => { expect(h.callback).toBeTypeOf("function"); return { type: "cancel" }; });
    const p = payWithPaymentLink("p", "https://pay.example"); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(20_000); expect(await p).toBe("pending"); expect(h.unsub).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["completed", "failed", "refunded", "partially_refunded"])("uses server %s only, cleaning listener/timers", async (status) => {
    const p = payWithPaymentLink("p", "https://pay.example"); emit(status);
    expect(await p).toBe(status === "completed" ? "paid" : status); await Promise.resolve(); expect(h.unsub).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it("cleans up a synchronous settled snapshot without opening browser", async () => {
    h.initial = "completed"; expect(await payWithPaymentLink("p", "https://pay.example")).toBe("paid"); expect(h.browser).not.toHaveBeenCalled(); expect(h.unsub).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it("can retry the same payment after pending on iOS", async () => {
    h.os = "ios";
    const input = { paymentId: "same", paymentUrl: "https://pay.example", name: "Studio", description: "Booking" };
    const first = payOnline(input); await vi.advanceTimersByTimeAsync(20_000); expect(await first).toBe("pending");
    const retry = payOnline(input); emit("completed"); expect(await retry).toBe("paid"); expect(h.browser).toHaveBeenCalledTimes(2);
  });
  it("returns failed on browser-open error, not paid", async () => {
    h.browser.mockRejectedValueOnce(new Error("unavailable")); expect(await payWithPaymentLink("p", "https://pay.example")).toBe("failed"); expect(h.unsub).toHaveBeenCalledTimes(1);
  });
});
