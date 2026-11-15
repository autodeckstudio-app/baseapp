import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bytesToBase64, md5Bytes, photoContentMd5 } from "./content-md5";

const md5b64 = (b: Uint8Array) => createHash("md5").update(b).digest("base64");

describe("md5Bytes against the independent standard (node:crypto) and pinned vectors", () => {
  // Independent vectors (Python hashlib, reviewer-supplied): raw bytes -> base64 MD5.
  it("pins the known vectors", () => {
    const s = (str: string) => new Uint8Array([...str].map((c) => c.charCodeAt(0)));
    expect(bytesToBase64(md5Bytes(s("")))).toBe("1B2M2Y8AsgTpgAmY7PhCfg==");
    expect(bytesToBase64(md5Bytes(s("abc")))).toBe("kAFQmDzST7DWlj99KOF/cg==");
    expect(bytesToBase64(md5Bytes(new Uint8Array([0, 255, 128, 1])))).toBe("B8mUN2D4JyU5jCp33Tm5Lw==");
    expect(bytesToBase64(md5Bytes(new Uint8Array([1, 2, 3])))).toBe("Uonfc331cyb83SJZevsfrA==");
    // The WRONG behavior (hashing the base64 TEXT) would give a4xF+HttYoci1511zhziMg== for [1,2,3].
    expect(bytesToBase64(md5Bytes(new Uint8Array([1, 2, 3])))).not.toBe("a4xF+HttYoci1511zhziMg==");
  });
  it("matches node:crypto on randomized buffers across padding boundaries", () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    for (const len of [0, 1, 2, 3, 55, 56, 57, 63, 64, 65, 127, 128, 1000]) {
      const b = new Uint8Array(len).map(() => rnd() % 256);
      expect(bytesToBase64(md5Bytes(b))).toBe(md5b64(b));
    }
  });
});

describe("bytesToBase64 (RFC 4648 vectors)", () => {
  it("encodes", () => {
    const s = (str: string) => new Uint8Array([...str].map((c) => c.charCodeAt(0)));
    expect(bytesToBase64(s(""))).toBe("");
    expect(bytesToBase64(s("f"))).toBe("Zg==");
    expect(bytesToBase64(s("fo"))).toBe("Zm8=");
    expect(bytesToBase64(s("foo"))).toBe("Zm9v");
    expect(bytesToBase64(s("foob"))).toBe("Zm9vYg==");
    expect(bytesToBase64(s("fooba"))).toBe("Zm9vYmE=");
    expect(bytesToBase64(s("foobar"))).toBe("Zm9vYmFy");
  });
});

describe("photoContentMd5", () => {
  it("digests raw bytes (native path)", async () => {
    await expect(photoContentMd5({ bytes: new Uint8Array([1, 2, 3]) })).resolves.toBe("Uonfc331cyb83SJZevsfrA==");
  });
  it("digests blob bytes (web path)", async () => {
    await expect(photoContentMd5({ blob: new Blob(["\x01\x02\x03"]) })).resolves.toBe("Uonfc331cyb83SJZevsfrA==");
  });
});
