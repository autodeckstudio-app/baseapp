/** Shown when the full list of open jobs could not be read and the screen only has the newest 300 jobs. */
export function BoundedJobsNotice({ note }: { note: string | null }) {
  if (!note) return null;
  return <div className="ax-panel" role="alert" data-testid="bounded-jobs-notice">{note}</div>;
}
