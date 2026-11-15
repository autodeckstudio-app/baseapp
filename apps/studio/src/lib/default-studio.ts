// Admins are not tied to one studio (their claims carry studioId: null), but
// every studio screen is scoped to a studio. Give them the tenant's first studio
// (by id, so the choice is stable) instead of leaving every screen loading.
export function pickDefaultStudio(
  claimStudioId: string | null,
  role: string,
  studios: { id: string }[],
): string | null {
  if (claimStudioId) return claimStudioId;
  if (role !== "admin" && role !== "superadmin") return null;
  const ids = studios.map((s) => s.id).sort();
  return ids[0] ?? null;
}
