// Text saved before the encoding fix shows the rupee sign as "â¹" (the three
// UTF-8 bytes read as Latin-1, the third being an invisible control character).
// Repair it on display. New text is written correctly; this only fixes old rows.
export function repairText(text: string): string {
  if (!text) return text;
  let out = text.replace(/\u00e2\u0082\u00b9|\u00e2[\u0080-\u009f]?\u00b9/g, "\u20b9");
  if (/[\u00c2\u00c3\u00e2][\u0080-\u00bf]/.test(out)) {
    try {
      const bytes = Uint8Array.from(Array.from(out, (c) => c.charCodeAt(0)));
      if (Array.from(out).every((c) => c.charCodeAt(0) < 256)) out = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch { /* leave as is */ }
  }
  return out;
}
