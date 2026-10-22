import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { goBackOrTo, notePageView } from "./go-back";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("admin back", () => {
  it("a fresh tab (one page seen) goes to the list; after moving between pages it goes back", () => {
    const s = mem(); const r = { back: vi.fn(), push: vi.fn() };
    notePageView(s); goBackOrTo(r, "/bookings", s);
    expect(r.push).toHaveBeenCalledWith("/bookings"); expect(r.back).not.toHaveBeenCalled();
    notePageView(s); goBackOrTo(r, "/bookings", s);
    expect(r.back).toHaveBeenCalledTimes(1);
  });
  it("no storage available falls back to the list", () => {
    const r = { back: vi.fn(), push: vi.fn() };
    goBackOrTo(r, "/jobs", null); expect(r.push).toHaveBeenCalledWith("/jobs");
  });
  it("detail pages use it, and the layout counts page changes", () => {
    const rd = (p: string) => readFileSync(`${__dirname}/../app/(admin)/${p}`, "utf8");
    expect(rd("bookings/[id]/page.tsx")).toContain('goBackOrTo(router, "/bookings")');
    expect(rd("jobs/[id]/page.tsx")).toContain('goBackOrTo(router, "/jobs")');
    expect(rd("invoices/[id]/page.tsx")).toContain('goBackOrTo(router, "/invoices")');
    expect(rd("customers/[id]/page.tsx")).toContain('goBackOrTo(router, "/customers")');
    expect(rd("layout.tsx")).toContain("notePageView()");
  });
});
