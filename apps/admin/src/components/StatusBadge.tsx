import { statusTone, type StatusTone } from "../lib/status-tone";
import { statusLabel } from "../lib/status-label";

// Takes the stored status value; shows its people-facing name.
export function StatusBadge({ label, tone }: { label: string; tone?: StatusTone }) {
  return (
    <span className={`badge badge-${tone ?? statusTone(label)}`} title={label}>
      {statusLabel(label)}
    </span>
  );
}
