import type { JobStatus, ServiceJob } from "@autodeck/core";

const ORDER: JobStatus[] = [
  "PENDING_VEHICLE",
  "VEHICLE_RECEIVED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "READY_FOR_DELIVERY",
  "DELIVERED",
];
const LABEL: Record<JobStatus, string> = {
  PENDING_VEHICLE: "Awaiting arrival",
  VEHICLE_RECEIVED: "Vehicle received",
  IN_PROGRESS: "In progress",
  QUALITY_CHECK: "Quality check",
  READY_FOR_DELIVERY: "Ready for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
export interface VisitTimelineStep {
  status: JobStatus;
  label: string;
  state: "reached" | "current" | "upcoming";
  changedAt?: string;
  notes?: string | null;
}

export function projectVisitTimeline(job: ServiceJob): VisitTimelineStep[] {
  if (job.status === "CANCELLED")
    return [{ status: "CANCELLED", label: LABEL.CANCELLED, state: "current" }];
  const current = ORDER.indexOf(job.status);
  const history = new Map(
    job.statusHistory.map((entry) => [entry.status, entry]),
  );
  return ORDER.map((status, index) => {
    const entry = history.get(status);
    return {
      status,
      label: LABEL[status],
      state:
        index < current
          ? "reached"
          : index === current
            ? "current"
            : "upcoming",
      ...(entry?.changedAt ? { changedAt: entry.changedAt } : {}),
      ...(entry ? { notes: entry.notes } : {}),
    };
  });
}
