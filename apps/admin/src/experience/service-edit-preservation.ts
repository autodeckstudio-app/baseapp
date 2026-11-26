import type { Service } from "@autodeck/core";
import { canonicalReview } from "./catalogue-publish-review";
import {
  draftFromService,
  toServicePayload,
  type ServicePayload,
} from "./services-draft";
/** An unchanged editor control is not permission to normalize its stored field.
 * Required fields retain their accepted values; optional absent fields stay absent.
 * The server accepts those omitted optional fields and merges the reviewed payload.
 */
export function preserveUneditedServiceFields(
  next: ServicePayload,
  source: Service,
): ServicePayload {
  const baseline = toServicePayload(draftFromService(source));
  if (!baseline.ok) throw Error("Current service cannot be safely compared");
  function retain(
    candidate: unknown,
    normalized: unknown,
    before: unknown,
  ): unknown {
    if (canonicalReview(candidate) === canonicalReview(normalized)) return before;
    if (
      candidate &&
      normalized &&
      before &&
      typeof candidate === "object" &&
      typeof normalized === "object" &&
      typeof before === "object" &&
      !Array.isArray(candidate) &&
      !Array.isArray(normalized) &&
      !Array.isArray(before)
    )
      return Object.fromEntries(
        Object.entries(candidate)
          .map(([k, v]) => [
            k,
            retain(
              v,
              (normalized as Record<string, unknown>)[k],
              (before as Record<string, unknown>)[k],
            ),
          ])
          .filter(([, v]) => v !== undefined),
      );
    return candidate;
  }
  return Object.fromEntries(
    Object.entries({...next,...(source.currency!==undefined?{currency:source.currency}:{}),...(source.active!==undefined?{active:source.active}:{})})
      .map(([k, v]) => [
        k,
        retain(
          v,
          baseline.payload[k as keyof ServicePayload],
          source[k as keyof Service],
        ),
      ])
      .filter(([, v]) => v !== undefined),
  ) as unknown as ServicePayload;
}
