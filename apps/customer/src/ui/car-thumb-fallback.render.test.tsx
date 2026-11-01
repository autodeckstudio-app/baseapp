// CarThumb saved-photo failure fallback: a rejected resolver must not leave the
// thumbnail pending (blank) forever - it falls back to the placeholder and says
// so. The resolver itself (and its security checks) is mocked, not changed.
// Does not establish on-device rendering or styling.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { create, act } from "react-test-renderer";
import { createElement } from "react";

const resolveMock = vi.fn<(path: string, version?: string | null) => Promise<string>>();
vi.mock("../lib/vehicle-service", () => ({ resolveVehiclePhotoUrl: (p: string, v?: string | null) => resolveMock(p, v) }));

import { CarThumb } from "./CarThumb";

function textOf(el: any): string {
  const json = el.toJSON();
  const walk = (n: any): string => {
    if (n === null || n === undefined || typeof n === "boolean") return "";
    if (typeof n === "string") return n;
    if (Array.isArray(n)) return n.map(walk).join(" ");
    return walk(n.children);
  };
  return walk(json).replace(/\s+/g, " ").trim();
}

const car = { photoUrl: "automodz/vehicles/v1/cover.jpg", category: null, updatedAt: "2026-10-31T00:00:00Z" };

async function renderThumb(props: Parameters<typeof CarThumb>[0]) {
  let el!: ReturnType<typeof create>;
  await act(async () => { el = create(createElement(CarThumb, props)); });
  await act(async () => { await Promise.resolve(); });
  return el!;
}

beforeEach(() => { resolveMock.mockReset(); });

describe("CarThumb saved-photo fallback", () => {
  it("resolver rejection falls back to an honest placeholder, not a perpetual blank", async () => {
    resolveMock.mockRejectedValue(new Error("permission-denied"));
    const el = await renderThumb({ car, height: 120 });
    const t = textOf(el);
    expect(t).toContain("PHOTO UNAVAILABLE");
    expect(JSON.stringify(el.toJSON())).not.toContain("cover.jpg?");
  });

  it("genuine no-photo still says NO PHOTO YET", async () => {
    const el = await renderThumb({ car: { photoUrl: null, category: null }, height: 120 });
    expect(textOf(el)).toContain("NO PHOTO YET");
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("resolving photo renders the image, no placeholder", async () => {
    resolveMock.mockResolvedValue("http://127.0.0.1:9199/signed-url");
    const el = await renderThumb({ car, height: 120 });
    const t = textOf(el);
    expect(t).not.toContain("PHOTO UNAVAILABLE");
    expect(t).not.toContain("NO PHOTO YET");
  });

  it("a late success from a previous car is never painted after the car changes", async () => {
    let resolveOld!: (u: string) => void;
    resolveMock.mockImplementation(() => new Promise<string>((res) => { resolveOld = res; }));
    let el!: ReturnType<typeof create>;
    await act(async () => { el = create(createElement(CarThumb, { car, height: 120 })); });
    await act(async () => { el.update(createElement(CarThumb, { car: { photoUrl: null, category: null }, height: 120 })); });
    await act(async () => { resolveOld("http://127.0.0.1:9199/stale-url"); await Promise.resolve(); });
    const t = textOf(el!);
    expect(t).toContain("NO PHOTO YET");
    expect(JSON.stringify(el!.toJSON())).not.toContain("stale-url");
  });
});
