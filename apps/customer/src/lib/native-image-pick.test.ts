import { describe, expect, it, vi, beforeEach } from "vitest";

const launch = vi.hoisted(() => vi.fn());
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: launch }));

import { base64ToBytes, sniffImageContentType, pickImagesFromLibrary } from "./native-image-pick";

// Real magic-byte prefixes, base64-encoded, so tests assert against actual byte patterns.
const B64 = { jpeg: "/9j/4AAQ", png: "iVBORw0KGgo=", webp: "UklGRjQAAABXRUJQ", gif: "R0lGODdh" };
const asset = (o: any = {}) => ({ uri: "file:///tmp/a.jpg", mimeType: "image/jpeg", base64: B64.jpeg, width: 10, height: 10, ...o });

beforeEach(() => launch.mockReset());

describe("base64ToBytes", () => {
  it("decodes without atob/Buffer", () => {
    expect([...base64ToBytes("AQID")]).toEqual([1, 2, 3]);
    expect([...base64ToBytes("AA==")]).toEqual([0]);
    expect([...base64ToBytes("//79")]).toEqual([255, 254, 253]);
  });
});

describe("sniffImageContentType", () => {
  it("detects jpeg, png and webp from magic bytes and rejects anything else", () => {
    expect(sniffImageContentType(base64ToBytes(B64.jpeg))).toBe("image/jpeg");
    expect(sniffImageContentType(base64ToBytes(B64.png))).toBe("image/png");
    expect(sniffImageContentType(base64ToBytes(B64.webp))).toBe("image/webp");
    expect(sniffImageContentType(base64ToBytes(B64.gif))).toBeNull();
    expect(sniffImageContentType(new Uint8Array([1]))).toBeNull();
  });
});

describe("pickImagesFromLibrary", () => {
  it("returns null when the user cancels", async () => {
    launch.mockResolvedValue({ canceled: true, assets: null });
    await expect(pickImagesFromLibrary({ multiple: false, maxFiles: 1 })).resolves.toBeNull();
  });
  it("returns the real bytes with the type sniffed from them (never the claimed mimeType)", async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset({ mimeType: "image/heic" })] }); // claims HEIC, bytes are JPEG
    const picked = await pickImagesFromLibrary({ multiple: false, maxFiles: 1 });
    expect(picked).toHaveLength(1);
    expect(picked?.[0]?.type).toBe("image/jpeg"); // a quality re-encode lying about its format is caught
    expect(picked?.[0]?.previewUri).toBe("file:///tmp/a.jpg");
    expect([...(picked?.[0]?.bytes ?? [])].slice(0, 3)).toEqual([0xff, 0xd8, 0xff]);
  });
  it("rejects bytes that are not a supported image, whatever the picker claims", async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset({ base64: B64.gif, mimeType: "image/jpeg" })] });
    await expect(pickImagesFromLibrary({ multiple: false, maxFiles: 1 })).rejects.toThrow("Choose a supported file type.");
  });
  it("fails honestly when the asset bytes cannot be read", async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset({ base64: null })] });
    await expect(pickImagesFromLibrary({ multiple: false, maxFiles: 1 })).rejects.toThrow("The photo could not be read. Try a different image.");
  });
  it("asks the picker for multiple selection with the caller's limit", async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset(), asset({ uri: "file:///tmp/b.png", base64: B64.png })] });
    const picked = await pickImagesFromLibrary({ multiple: true, maxFiles: 12 });
    expect(launch).toHaveBeenCalledWith(expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 12 }));
    expect(picked?.map((p) => p.type)).toEqual(["image/jpeg", "image/png"]);
  });
});
