import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { viewStillRelevant } from "./list-view-state";
import { clearReturning, goBackOrTo, notePageView, replaceWithoutCounting, wasReturning } from "./go-back";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("admin back", () => {
  it("a fresh tab (one page seen) goes to the list; after moving between pages it goes back", () => {
    const s = mem(); const r = { back: vi.fn(), push: vi.fn() };
    notePageView(s); goBackOrTo(r, "/bookings", s);
    expect(r.push).toHaveBeenCalledWith("/bookings"); expect(r.back).not.toHaveBeenCalled();
    notePageView(s); goBackOrTo(r, "/bookings", s);
    expect(r.back).toHaveBeenCalledTimes(1);
  });
  it("a redirect (replace) on a cold entry does not count as a second page, so Back stays in the app", () => {
    const s = mem(); const r = { back: vi.fn(), push: vi.fn(), replace: vi.fn() };
    notePageView(s);                       // opened /bookings/x directly
    replaceWithoutCounting(r, "/jobs/y", s); // app redirects to the job
    notePageView(s);                       // layout sees the new path
    goBackOrTo(r, "/jobs", s);
    expect(r.back).not.toHaveBeenCalled(); expect(r.push).toHaveBeenCalledWith("/jobs");
    expect(r.replace).toHaveBeenCalledWith("/jobs/y");
  });
  it("a real move after the redirect still goes back", () => {
    const s = mem(); const r = { back: vi.fn(), push: vi.fn(), replace: vi.fn() };
    notePageView(s); replaceWithoutCounting(r, "/jobs/y", s); notePageView(s); notePageView(s);
    goBackOrTo(r, "/jobs", s); expect(r.back).toHaveBeenCalledTimes(1);
  });
  it("the count never goes below zero", () => {
    const s = mem(); const r = { replace: vi.fn() };
    replaceWithoutCounting(r, "/x", s); expect(s.getItem("ax-page-views")).toBe("0");
  });
  it("detail pages say Back, matching what the button does", () => {
    const rd = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");
    for (const f of ["app/(admin)/bookings/[id]/page.tsx", "app/(admin)/jobs/[id]/page.tsx", "experience/CustomerView.tsx", "experience/InvoiceView.tsx"]) {
      expect(rd(f)).toContain("‹ Back</button>");
    }
    expect(rd("app/(admin)/bookings/[id]/page.tsx")).toContain("replaceWithoutCounting(router");
    expect(rd("app/(admin)/layout.tsx")).toContain("replaceWithoutCounting(router");
  });
  it("Back arms a one-use mark that the list clears", () => {
    const s = mem(); const r = { back: vi.fn(), push: vi.fn() };
    expect(wasReturning(s)).toBe(false);
    notePageView(s); notePageView(s); goBackOrTo(r, "/bookings", s);
    expect(wasReturning(s)).toBe(true);
    clearReturning(s); expect(wasReturning(s)).toBe(false);
  });
  it("the saved view only lives between Bookings and a booking or job page", () => {
    for (const ok of ["/bookings", "/bookings/abc", "/jobs/abc"]) expect(viewStillRelevant(ok)).toBe(true);
    for (const no of ["/jobs", "/customers", "/payments", "/dashboard", "/bookingsx"]) expect(viewStillRelevant(no)).toBe(false);
  });
  it("the layout drops the saved view and the mark when leaving that chain", () => {
    const rd = readFileSync(`${__dirname}/../app/(admin)/layout.tsx`, "utf8");
    expect(rd).toContain("viewStillRelevant(pathname)"); expect(rd).toContain("dropListView(BOOKINGS_VIEW_KEY)");
  });
  it("the redirect runs once, guarded by a ref", () => {
    const rd = readFileSync(`${__dirname}/../app/(admin)/bookings/[id]/page.tsx`, "utf8");
    expect(rd).toContain("!redirected.current"); expect(rd).toContain("redirected.current = true");
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
