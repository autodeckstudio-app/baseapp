// CarThumb image onError retry budget: keyed to the photo (path+version), not the
// signed URL. A fresh signed URL always differs, so URL-keying retried forever when
// the object was unreadable, and an exhausted same-URL image claimed NO PHOTO YET
// for a car that HAS a saved photo. Exercises the real FadeImage onError wiring.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { create, act } from "react-test-renderer";
import { createElement } from "react";

const resolveMock = vi.fn<(path: string, version?: string | null) => Promise<string>>();
vi.mock("../lib/vehicle-service", () => ({ resolveVehiclePhotoUrl: (p: string, v?: string | null) => resolveMock(p, v) }));

import { CarThumb } from "./CarThumb";

function textOf(el: any): string {
  const walk = (n: any): string => {
    if (n == null || typeof n === "boolean") return "";
    if (typeof n === "string") return n;
    if (Array.isArray(n)) return n.map(walk).join(" ");
    return walk(n.children);
  };
  return walk(el.toJSON()).replace(/\s+/g, " ").trim();
}

const car = { photoUrl: "automodz/vehicles/v1/cover.jpg", category: null, updatedAt: "2026-10-31T00:00:00Z" };

async function renderThumb(props: Parameters<typeof CarThumb>[0]) {
  let el!: ReturnType<typeof create>;
  await act(async () => { el = create(createElement(CarThumb, props)); });
  await act(async () => { await Promise.resolve(); });
  return el!;
}
const fireImgError = async (el: ReturnType<typeof create>) => {
  const img = el.root.findByType("img" as any);
  await act(async () => { img.props.onError(); await Promise.resolve(); });
};

beforeEach(() => { resolveMock.mockReset(); });

describe("CarThumb image onError retry budget", () => {
  it("two distinct failing signed URLs: one retry, then PHOTO UNAVAILABLE, no third resolve", async () => {
    resolveMock.mockResolvedValueOnce("http://x/signed-1").mockResolvedValueOnce("http://x/signed-2");
    const el = await renderThumb({ car, height: 120 });
    expect(el.root.findByType("img" as any).props.src).toBe("http://x/signed-1");
    await fireImgError(el); // first URL fails -> single re-resolve with a fresh URL
    expect(resolveMock).toHaveBeenCalledTimes(2);
    expect(el.root.findByType("img" as any).props.src).toBe("http://x/signed-2");
    await fireImgError(el); // second URL fails -> budget for this photo is exhausted
    expect(resolveMock).toHaveBeenCalledTimes(2);
    expect(textOf(el)).toContain("PHOTO UNAVAILABLE");
  });

  it("same-URL retry exhaustion: saved photo says PHOTO UNAVAILABLE, never NO PHOTO YET", async () => {
    resolveMock.mockResolvedValue("http://x/same-signed");
    const el = await renderThumb({ car, height: 120 });
    await fireImgError(el); // retry once (same URL back, as a cache would return)
    expect(resolveMock).toHaveBeenCalledTimes(2);
    await fireImgError(el); // exhausted
    expect(resolveMock).toHaveBeenCalledTimes(2);
    const t = textOf(el);
    expect(t).toContain("PHOTO UNAVAILABLE");
    expect(t).not.toContain("NO PHOTO YET");
  });

  it("a new saved version gets a fresh budget: old exhaustion does not stick", async () => {
    resolveMock.mockResolvedValue("http://x/same-signed");
    const el = await renderThumb({ car, height: 120 });
    await fireImgError(el); await fireImgError(el);
    expect(textOf(el)).toContain("PHOTO UNAVAILABLE");
    resolveMock.mockResolvedValue("http://x/new-version-signed");
    await act(async () => { el.update(createElement(CarThumb, { car: { ...car, updatedAt: "2026-10-31T01:00:00Z" }, height: 120 })); await Promise.resolve(); });
    expect(el.root.findByType("img" as any).props.src).toContain("new-version-signed");
    expect(textOf(el)).not.toContain("PHOTO UNAVAILABLE");
  });

  it("a late REJECTION from a previous car never marks the current render failed", async () => {
    let rejectOld!: (e: Error) => void;
    resolveMock.mockImplementation(() => new Promise<string>((_, rej) => { rejectOld = rej; }));
    let el!: ReturnType<typeof create>;
    await act(async () => { el = create(createElement(CarThumb, { car, height: 120 })); });
    await act(async () => { el.update(createElement(CarThumb, { car: { photoUrl: null, category: null }, height: 120 })); });
    await act(async () => { rejectOld(new Error("permission-denied")); await Promise.resolve(); });
    const t = textOf(el!);
    expect(t).toContain("NO PHOTO YET");
    expect(t).not.toContain("PHOTO UNAVAILABLE");
  });

  it("rejection after unmount is dropped quietly", async () => {
    let rejectOld!: (e: Error) => void;
    resolveMock.mockImplementation(() => new Promise<string>((_, rej) => { rejectOld = rej; }));
    let el!: ReturnType<typeof create>;
    await act(async () => { el = create(createElement(CarThumb, { car, height: 120 })); });
    await act(async () => { el.unmount(); });
    await act(async () => { rejectOld(new Error("gone")); await Promise.resolve(); });
    expect(true).toBe(true); // reaching here without a thrown setState-after-unmount is the assertion
  });
});
