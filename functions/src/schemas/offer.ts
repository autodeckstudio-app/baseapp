import { z } from "zod";

const contentType = z.enum(["image/jpeg", "image/png", "image/webp"]);
const iso = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Use a valid date and time.");
const link = z.object({
  kind: z.enum(["none", "catalogue", "membership", "service"]),
  serviceId: z.string().min(1).max(100).nullable().optional(),
}).strict().refine((l) => l.kind !== "service" || !!l.serviceId, "Pick a service for this link.");

/** Longest an offer may run. A forgotten banner should not live for ever. */
export const MAX_OFFER_DAYS = 120;

export const issueOfferUploadUrlSchema = z.object({ studioId: z.string().min(1), contentType }).strict();

export const createOfferSchema = z.object({
  studioId: z.string().min(1),
  path: z.string().min(1).max(300),
  contentType,
  headline: z.string().trim().min(3).max(60),
  body: z.string().trim().max(120).optional(),
  cta: z.string().trim().max(24).optional(),
  link,
  startsAt: iso,
  endsAt: iso,
}).strict().refine((o) => Date.parse(o.endsAt) > Date.parse(o.startsAt), { message: "The end must be after the start.", path: ["endsAt"] })
  .refine((o) => Date.parse(o.endsAt) - Date.parse(o.startsAt) <= MAX_OFFER_DAYS * 86_400_000, { message: `An offer can run up to ${MAX_OFFER_DAYS} days.`, path: ["endsAt"] });

export const updateOfferSchema = z.object({
  offerId: z.string().min(1),
  headline: z.string().trim().min(3).max(60).optional(),
  body: z.string().trim().max(120).nullable().optional(),
  cta: z.string().trim().max(24).nullable().optional(),
  endsAt: iso.optional(),
  hidden: z.boolean().optional(),
}).strict();

export const listOffersSchema = z.object({ includeAll: z.boolean().optional() }).strict();
