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
  { status: "STANDBY", title: "Arrived - standby", tone: "wait" },
  { status: "PENDING_VEHICLE", title: "Awaiting vehicle", tone: "wait" },
  { status: "VEHICLE_RECEIVED", title: "Checked in", tone: "active" },
  { status: "IN_PROGRESS", title: "In progress", tone: "active" },
  { status: "QUALITY_CHECK", title: "Quality check", tone: "active" },
  { status: "READY_FOR_DELIVERY", title: "Ready for pickup", tone: "done" },
];

export function JobBoard({ jobs, loading, onOpen }: { jobs: BoardJob[]; loading?: boolean; onOpen: (id: string) => void }) {
  return (
    <div className="ax-board" aria-busy={loading || undefined}>
      {BOARD_COLUMNS.filter(c => loading || c.status!=="STANDBY" || jobs.some(j=>j.status==="STANDBY")).map((c) => {
        const items = jobs.filter((j) => j.status === c.status);
        return (
          <section key={c.status} className={`ax-col ax-col--${c.tone}`} aria-label={c.title}>
            <header className="ax-col-head">
              <span className="ax-label">{c.title}</span>
              {!loading && <span className="ax-col-n">{items.length}</span>}
            </header>
            {loading ? (
              <>
                <div className="ax-skel" />
                <div className="ax-skel" />
              </>
            ) : items.length === 0 ? (
              <p className="ax-col-empty">Nothing here</p>
            ) : (
              items.map((j) => (
                <button key={j.id} type="button" className="ax-jc" onClick={() => onOpen(j.id)}>
                  <span className="ax-jc-top">
                    <span className="ax-jc-plate">{j.plate}</span>
                    <StatusBadge label={j.payment} />
                  </span>
                  <span className="ax-jc-svc">{j.service}</span>
                  <span className="ax-jc-who">{j.customer}</span>
                  <span className="ax-jc-meta">
                    {j.bay ? <span className="ax-jc-chip">Bay {j.bay}</span> : null}
                    {j.walkIn ? <span className="ax-jc-chip ax-jc-chip--walk">Walk-in</span> : null}
                    <span className="ax-jc-time">{j.when}</span>
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
