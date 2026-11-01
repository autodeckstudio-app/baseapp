/** RFC 1321 MD5 over RAW BYTES. A self-contained implementation (no native module, no
 * string-encoding pitfalls): the digest binds the exact photo bytes about to be PUT.
 * MD5 here is a byte-corruption/mismatch binding, not a collision-resistant security
 * control - the generation pin owns version identity. */

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
// K[i] = floor(abs(sin(i + 1)) * 2^32); doubles are exact below 2^53.
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296));

export function md5Bytes(msg: Uint8Array): Uint8Array {
  const bitLen = msg.length * 8;
  const total = (((msg.length + 8) >> 6) + 1) << 6; // padded to a multiple of 64
  const m = new Uint8Array(total);
  m.set(msg);
  m[msg.length] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 8, bitLen >>> 0, true);
  dv.setUint32(total - 4, Math.floor(bitLen / 4294967296), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let off = 0; off < total; off += 64) {
    const M: number[] = [];
    for (let i = 0; i < 16; i++) M.push(dv.getUint32(off + i * 4, true));
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16;
      }
      // Exact integer arithmetic below 2^53; reduce to 32 bits before rotating.
      const x = (A + F + (K[i] as number) + (M[g] as number)) % 4294967296;
      const s = S[i] as number;
      const r = ((x << s) | (x >>> (32 - s))) >>> 0;
      A = D; D = C; C = B; B = (B + r) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  const out = new Uint8Array(16);
  const od = new DataView(out.buffer);
  od.setUint32(0, a0, true); od.setUint32(4, b0, true); od.setUint32(8, c0, true); od.setUint32(12, d0, true);
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** bytes -> base64 without relying on btoa/Buffer (Hermes-safe, jest-safe). */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  const at = (i: number) => bytes[i] ?? 0;
  for (let i = 0; i < bytes.length; i += 3) {
    const a = at(i);
    const hasB = i + 1 < bytes.length, hasC = i + 2 < bytes.length;
    const b = at(i + 1), c = at(i + 2);
    out += B64.charAt(a >> 2) + B64.charAt(((a & 3) << 4) | (b >> 4));
    out += hasB ? B64.charAt(((b & 15) << 2) | (c >> 6)) : "=";
    out += hasC ? B64.charAt(c & 63) : "=";
  }
  return out;
}

/**
 * Base64 MD5 of the exact photo bytes about to be PUT. Sent at mint time so the server can
 * sign it into the upload URL as Content-MD5 (GCS rejects mismatched bytes at the door) and
 * compare it against the object's actual MD5 before the checks run.
 */
export async function photoContentMd5(photo: { blob?: Blob | null; bytes?: Uint8Array }): Promise<string> {
  const bytes = photo.bytes ?? new Uint8Array(await (photo.blob as Blob).arrayBuffer());
  return bytesToBase64(md5Bytes(bytes));
}
