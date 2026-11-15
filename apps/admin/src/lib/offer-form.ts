/** Checks the offer form before it is sent. Local date and time inputs become ISO here. */
export type OfferFormInput = { headline: string; startsAt: string; endsAt: string; linkKind: string; serviceId: string; hasImage: boolean };
export const MAX_OFFER_DAYS = 120;

export function offerFormError(f: OfferFormInput, now = Date.now()): string | null {
  if (!f.hasImage) return "Add an image.";
  if (f.headline.trim().length < 3) return "Write a headline (at least 3 letters).";
  if (f.headline.trim().length > 60) return "Keep the headline under 60 characters.";
  const s = Date.parse(f.startsAt), e = Date.parse(f.endsAt);
  if (Number.isNaN(s) || Number.isNaN(e)) return "Pick a start and an end.";
  if (e <= s) return "The end must be after the start.";
  if (e <= now) return "The end is already in the past.";
  if (e - s > MAX_OFFER_DAYS * 86_400_000) return `An offer can run up to ${MAX_OFFER_DAYS} days.`;
  if (f.linkKind === "service" && !f.serviceId) return "Pick a service for the link.";
  return null;
}
