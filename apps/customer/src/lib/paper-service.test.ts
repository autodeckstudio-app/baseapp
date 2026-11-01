import { describe, expect, it, vi, beforeEach } from "vitest";

const expoFetchMock = vi.hoisted(() => vi.fn());
vi.mock("expo/fetch", () => ({ fetch: expoFetchMock }));
vi.mock("firebase/firestore", () => ({ collection: vi.fn(), query: vi.fn(), where: vi.fn(), onSnapshot: vi.fn() }));
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));
vi.mock("./firebase", () => ({ db: {}, functions: {} }));

import { putPaperPhoto } from "./paper-service";

const headers = { "Content-Type": "image/jpeg", "x-goog-meta-ownerId": "me" };

beforeEach(() => {
  expoFetchMock.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

describe("putPaperPhoto transport choice", () => {
  it("native bytes go through expo/fetch as a raw Uint8Array body (RN cannot build Blobs from bytes)", async () => {
    expoFetchMock.mockResolvedValue({ ok: true, status: 200 });
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
    await putPaperPhoto("https://signed.example/put", headers, { bytes });
    expect(expoFetchMock).toHaveBeenCalledWith("https://signed.example/put", { method: "PUT", headers, body: bytes });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("web blobs keep the global fetch Blob path", async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: true, status: 200 });
    const blob = new Blob(["x"], { type: "image/jpeg", lastModified: 0 } as BlobOptions);
    await putPaperPhoto("https://signed.example/put", headers, { blob });
    expect(globalThis.fetch).toHaveBeenCalledWith("https://signed.example/put", { method: "PUT", headers, body: blob });
    expect(expoFetchMock).not.toHaveBeenCalled();
  });
  it("a failed upload reports the real status on either transport", async () => {
    expoFetchMock.mockResolvedValue({ ok: false, status: 403 });
    await expect(putPaperPhoto("https://signed.example/put", headers, { bytes: new Uint8Array([1]) })).rejects.toThrow("Saved, but the photo did not upload (403).");
  });
});
