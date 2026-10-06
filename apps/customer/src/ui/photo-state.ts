// A photo response belongs to exactly one path + saved version. Async results
// from a previous car or photo must never be visible during a new render.
export function photoKey(path: string | null, version: string | null): string {
  return JSON.stringify([path, version]);
}
export function currentPhoto(resolved: { key: string; uri: string } | null, key: string): string | null {
  return resolved?.key === key ? resolved.uri : null;
}
