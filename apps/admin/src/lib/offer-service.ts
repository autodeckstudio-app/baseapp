"use client";

import { httpsCallable } from "firebase/functions";
import type { OfferLink, OfferView } from "@autodeck/core";
import { functions } from "./firebase";

export async function listAllOffers(): Promise<OfferView[]> {
  const fn = httpsCallable<{ includeAll: boolean }, { offers: OfferView[] }>(functions, "listOffers");
  return (await fn({ includeAll: true })).data.offers;
}

/** Upload the image with a signed PUT, then publish it as an offer. */
export async function publishOffer(input: { studioId: string; file: File; headline: string; body?: string; cta?: string; link: OfferLink; startsAt: string; endsAt: string }): Promise<{ id: string }> {
  const contentType = input.file.type;
  const issue = httpsCallable<{ studioId: string; contentType: string }, { uploadUrl: string; path: string; requiredHeaders: Record<string, string> }>(functions, "issueOfferUploadUrl");
  const { uploadUrl, path, requiredHeaders } = (await issue({ studioId: input.studioId, contentType })).data;
  const put = await fetch(uploadUrl, { method: "PUT", headers: requiredHeaders, body: input.file });
  if (!put.ok) throw new Error("The upload did not go through. Try again.");
  const create = httpsCallable<Record<string, unknown>, { id: string }>(functions, "createOffer");
  return (
    await create({
      studioId: input.studioId,
      path,
      contentType,
      headline: input.headline,
      ...(input.body ? { body: input.body } : {}),
      ...(input.cta ? { cta: input.cta } : {}),
      link: input.link,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    })
  ).data;
}

export async function updateOffer(input: { offerId: string; hidden?: boolean; endsAt?: string; headline?: string }): Promise<void> {
  const fn = httpsCallable<typeof input, { id: string }>(functions, "updateOffer");
  await fn(input);
}
