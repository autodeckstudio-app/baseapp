import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { goBackOrTo } from "./go-back";

describe("admin back", () => {
  it("goes back when this tab has history, otherwise to the list", () => {
    const r = { back: vi.fn(), push: vi.fn() };
    goBackOrTo(r, "/bookings", 3); expect(r.back).toHaveBeenCalledTimes(1); expect(r.push).not.toHaveBeenCalled();
    goBackOrTo(r, "/bookings", 1); expect(r.push).toHaveBeenCalledWith("/bookings");
  });
  it("detail pages no longer hard-code their list as the back target", () => {
    const rd = (p: string) => readFileSync(`${__dirname}/../app/(admin)/${p}`, "utf8");
    expect(rd("bookings/[id]/page.tsx")).toContain('goBackOrTo(router, "/bookings")');
    expect(rd("jobs/[id]/page.tsx")).toContain('goBackOrTo(router, "/jobs")');
    expect(rd("invoices/[id]/page.tsx")).toContain('goBackOrTo(router, "/invoices")');
    expect(rd("customers/[id]/page.tsx")).toContain('goBackOrTo(router, "/customers")');
  });
});
