import { statusTone, type StatusTone } from "../lib/status-tone";

export function StatusBadge({ label, tone }: { label: string; tone?: StatusTone }) {
  return <span className={`badge badge-${tone ?? statusTone(label)}`}>{label}</span>;
}
