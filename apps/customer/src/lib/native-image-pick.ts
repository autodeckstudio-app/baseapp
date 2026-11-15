import * as ImagePicker from "expo-image-picker";

export type PickedUpload = { bytes: Uint8Array; type: string; previewUri: string };

/** base64 -> bytes without relying on atob/Buffer (Hermes-safe, jest-safe). */
export function base64ToBytes(b64: string): Uint8Array {
  const table: Record<string, number> = {};
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let i = 0; i < alphabet.length; i++) table[alphabet.charAt(i)] = i;
  const clean = b64.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = ((table[clean.charAt(i)] ?? 0) << 18) | ((table[clean.charAt(i + 1)] ?? 0) << 12) | ((table[clean.charAt(i + 2)] ?? 0) << 6) | (table[clean.charAt(i + 3)] ?? 0);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/**
 * True content type from the actual returned bytes (magic numbers), never from asset.mimeType:
 * the picker's quality re-encode can change the real format on some platforms, and the upload's
 * signed Content-Type must match the bytes or the write fails / the server rejects the file.
 */
export function sniffImageContentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

/**
 * Native photo picking for FileUploader. Uses the system photo picker (no permission prompt on
 * iOS 16+ / Android 13+; older Android gets READ_EXTERNAL_STORAGE from the expo-image-picker
 * config plugin at prebuild). Returns null when the user cancels.
 *
 * Returns raw BYTES, not a Blob: React Native's BlobManager throws on ArrayBuffer/ArrayBufferView
 * parts, so a Blob cannot be built on device. The upload path PUTs these bytes via expo/fetch,
 * which accepts Uint8Array bodies natively. The type is sniffed from the bytes (see above) and
 * must be in the same accept list the web picker enforces.
 */
export async function pickImagesFromLibrary(opts: { multiple: boolean; maxFiles: number; accept?: string }): Promise<PickedUpload[] | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: opts.multiple,
    selectionLimit: opts.multiple ? opts.maxFiles : 1,
    base64: true,
    quality: 0.8,
  });
  if (result.canceled) return null;
  const allowed = (opts.accept ?? "image/jpeg,image/png,image/webp").split(",");
  const files: PickedUpload[] = [];
  for (const asset of result.assets) {
    if (!asset.base64) throw new Error("The photo could not be read. Try a different image.");
    const bytes = base64ToBytes(asset.base64);
    const type = sniffImageContentType(bytes);
    if (!type || !allowed.includes(type)) throw new Error("Choose a supported file type.");
    files.push({ bytes, type, previewUri: asset.uri });
  }
  return files;
}
