import type { JobStatus } from "@autodeck/core";

export interface SavedJobsView {
  status?: JobStatus | "" | undefined;
  when?: "" | "today" | "upcoming" | undefined;
  view?: "board" | "list" | undefined;
  source?: "" | "booking" | "walkin" | undefined;
}

export const JOBS_VIEW_KEY = "ax-jobs-view";
const STATUS_VALUES = ["", "STANDBY", "PENDING_VEHICLE", "VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as const;

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

/** Reads the per-tab Jobs view. Anything missing, corrupt, from an older build or not an object is ignored field by field. */
export function parseSavedJobsView(raw: string | null): SavedJobsView {
  try {
    const v: unknown = JSON.parse(raw ?? "null");
    if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
    const r = v as Record<string, unknown>;
    return {
      status: pick(r["status"], STATUS_VALUES),
      when: pick(r["when"], ["", "today", "upcoming"] as const),
      view: pick(r["view"], ["board", "list"] as const),
      source: pick(r["source"], ["", "booking", "walkin"] as const),
    };
  } catch {
    return {};
  }
}
