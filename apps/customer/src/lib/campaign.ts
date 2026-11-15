export type Campaign = { headline: string; body?: string; cta?: string; imageUrl: string; onPress: () => void };

/** A campaign shows only with a real headline and image. Never a placeholder. */
export function hasCampaign(c: Campaign | null | undefined): c is Campaign {
  return !!c && c.headline.trim().length > 0 && c.imageUrl.trim().length > 0;
}

/** Most glass surfaces (real backdrop blur) allowed on one screen. Blur is costly on low-end phones. */
export const MAX_BLUR_SURFACES = 3;
