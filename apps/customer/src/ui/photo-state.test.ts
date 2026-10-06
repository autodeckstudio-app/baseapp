import { describe, expect, it } from "vitest";
import { photoKey, currentPhoto } from "./photo-state";
describe("photo identity", () => {
  it("does not render an old async response after replacing a photo at the same path", () => {
    const old = { key: photoKey("cover.jpg", "old"), uri: "old-url" };
    expect(currentPhoto(old, photoKey("cover.jpg", "new"))).toBeNull();
    expect(currentPhoto(old, old.key)).toBe("old-url");
  });
  it("does not render the previous car on selection change", () => {
    expect(currentPhoto({ key: photoKey("car-a", "v"), uri: "a" }, photoKey("car-b", "v"))).toBeNull();
  });
  it("stays neutral while resolving or after photo removal", () => {
    expect(currentPhoto(null, photoKey("car", "v"))).toBeNull();
    expect(currentPhoto({ key: photoKey("car", "v"), uri: "old" }, photoKey(null, "v2"))).toBeNull();
  });
});
