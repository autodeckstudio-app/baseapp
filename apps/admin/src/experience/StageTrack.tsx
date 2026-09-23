// The car's journey through the studio as a step track. Done steps take
// champagne, the current step amber, later steps stay quiet.
import { statusLabel } from "../lib/status-label";

export const JOB_STAGES = ["PENDING_VEHICLE", "VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY", "DELIVERED"] as const;

export function StageTrack({ current, stages = JOB_STAGES }: { current: string; stages?: readonly string[] }) {
  const at = stages.indexOf(current);
  if (at < 0) {
    return <p className="ad-track-off">{statusLabel(current)}</p>;
  }
  return (
    <ol className="ad-track" aria-label="Progress">
      {stages.map((s, i) => (
        <li key={s} className={i < at ? "is-done" : i === at ? "is-now" : ""} aria-current={i === at ? "step" : undefined}>
          <span className="ad-track-dot" aria-hidden="true" />
          <span className="ad-track-label">{statusLabel(s)}</span>
        </li>
      ))}
    </ol>
  );
}
