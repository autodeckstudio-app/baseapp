"use client";

// Studio floor board: one column per stage the car moves through. Pure view;
// the Jobs page supplies rows and handles navigation.
import { StatusBadge } from "../components/StatusBadge";

export interface BoardJob {
  id: string;
  status: string;
  plate: string;
  customer: string;
  service: string;
  bay?: string | undefined;
  when: string;
  walkIn: boolean;
  payment: string;
}

export const BOARD_COLUMNS: { status: string; title: string; tone: "wait" | "active" | "done" }[] = [
  { status: "PENDING_VEHICLE", title: "Awaiting vehicle", tone: "wait" },
  { status: "VEHICLE_RECEIVED", title: "Checked in", tone: "active" },
  { status: "IN_PROGRESS", title: "In progress", tone: "active" },
  { status: "QUALITY_CHECK", title: "Quality check", tone: "active" },
  { status: "READY_FOR_DELIVERY", title: "Ready for pickup", tone: "done" },
];

export function JobBoard({ jobs, loading, onOpen }: { jobs: BoardJob[]; loading?: boolean; onOpen: (id: string) => void }) {
  return (
    <div className="ad-board" aria-busy={loading || undefined}>
      {BOARD_COLUMNS.map((c) => {
        const items = jobs.filter((j) => j.status === c.status);
        return (
          <section key={c.status} className={`ad-col ad-col--${c.tone}`} aria-label={c.title}>
            <header className="ad-col-head">
              <span className="ad-label">{c.title}</span>
              {!loading && <span className="ad-col-n">{items.length}</span>}
            </header>
            {loading ? (
              <>
                <div className="ad-skel" />
                <div className="ad-skel" />
              </>
            ) : items.length === 0 ? (
              <p className="ad-col-empty">Nothing here</p>
            ) : (
              items.map((j) => (
                <button key={j.id} type="button" className="ad-job" onClick={() => onOpen(j.id)}>
                  <span className="ad-job-top">
                    <span className="ad-job-plate">{j.plate}</span>
                    {j.bay && <span className="ad-chip">Bay {j.bay}</span>}
                  </span>
                  <span className="ad-job-who">{j.customer}</span>
                  <span className="ad-job-what">{j.service}</span>
                  <span className="ad-job-foot">
                    <span>
                      {j.when}
                      {j.walkIn ? " · Walk-in" : ""}
                    </span>
                    <StatusBadge label={j.payment} />
                  </span>
                </button>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
