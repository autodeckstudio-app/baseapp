/** Which of the four steps a progress value sits on (25 = received ... 100 = ready). */
export function liveStep(pct: number | null): number {
  if (pct === null) return 0;
  return Math.min(3, Math.max(0, Math.ceil(pct / 25) - 1));
}
