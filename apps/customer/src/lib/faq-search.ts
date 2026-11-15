// No-model help search: matches what the customer types against the written FAQ. Runs on the phone only, nothing is sent anywhere.
export type FaqItem = { q: string; a: string };

const STOP = new Set(["the", "a", "an", "is", "are", "to", "of", "for", "my", "me", "i", "do", "does", "can", "how", "what", "and", "or", "in", "on", "it", "we", "you", "your"]);

function words(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\u0900-\u097f\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
}

/** Ranked FAQ matches. A word matches when it starts the same way (first 4 letters), so "cancelling" finds "cancel". Empty query returns everything in the original order. */
export function searchFaq<T extends FaqItem>(items: readonly T[], query: string): T[] {
  const qw = words(query);
  if (!qw.length) return [...items];
  const scored = items.map((it, i) => {
    const qs = words(it.q), as = words(it.a);
    let score = 0;
    for (const w of qw) {
      const stem = w.slice(0, 4);
      if (qs.some((x) => x === w)) score += 4; else if (qs.some((x) => x.startsWith(stem))) score += 3;
      if (as.some((x) => x === w)) score += 2; else if (as.some((x) => x.startsWith(stem))) score += 1;
    }
    return { it, score, i };
  }).filter((x) => x.score > 0);
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.it);
}
