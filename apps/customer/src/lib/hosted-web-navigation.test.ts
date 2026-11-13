import { beforeEach, afterEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ assign: vi.fn(), native: vi.fn(), snapshot: vi.fn(), getDoc: vi.fn() }));
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), getDoc: (...args: unknown[]) => h.getDoc(...args), onSnapshot: (...args: unknown[]) => h.snapshot(...args) }));
vi.mock("expo-web-browser", () => ({ openBrowserAsync: (...args: unknown[]) => h.native(...args) }));
vi.mock("./firebase", () => ({ db: {}, functions: {} }));
import { payWithPaymentLink } from "./razorpay-checkout";
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("location", { assign: h.assign }); });
afterEach(() => vi.unstubAllGlobals());
it("web advance uses same-tab navigation after asynchronous preparation, not a silently blocked popup", async () => {
  await Promise.resolve();
  expect(await payWithPaymentLink("advance-book", "https://rzp.io/i/existing", {webSameTab:true})).toBe("pending");
  expect(h.assign).toHaveBeenCalledWith("https://rzp.io/i/existing");
  expect(h.native).not.toHaveBeenCalled(); expect(h.snapshot).not.toHaveBeenCalled();
});
it.each(["http://rzp.io/i/a", "https://rzp.io.attacker.invalid/a", "javascript:alert(1)", "https://user:secret@rzp.io/a", "https://rzp.io:8443/a"])("invalid destination never opens: %s", async url => {
  await expect(payWithPaymentLink("p", url, {webSameTab:true})).rejects.toThrow(); expect(h.assign).not.toHaveBeenCalled();
});
it("missing stored URL fails, navigation errors are explicit rather than confirmed/pending", async () => {
  h.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ paymentUrl: null }) });
  expect(await payWithPaymentLink("p", null, {webSameTab:true})).toBe("failed");
  h.assign.mockImplementationOnce(() => { throw new Error("navigation blocked"); });
  await expect(payWithPaymentLink("p", "https://rzp.io/i/existing", {webSameTab:true})).rejects.toThrow("navigation blocked");
});
