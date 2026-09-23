"use client";

// One studio day as a timeline: each booking sits at its start time with
// the car, customer, service, bay and state. Pure view.
import { StatusBadge } from "../components/StatusBadge";

export interface AgendaItem {
  id: string;
  time: string; // "10:30 am"
  endTime?: string | undefined;
  plate: string;
  customer: string;
  service: string;
  bay?: string | undefined;
  status: string;
  payment: string;
  amount: string;
}

export function DayAgenda({ items, loading, onOpen }: { items: AgendaItem[]; loading?: boolean; onOpen: (id: string) => void }) {
  if (loading) {
    return (
      <div className="ad-agenda" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ad-skel" style={{ height: 72 }} />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="ad-empty">
        <p className="ad-title">A clear day</p>
        <p>No bookings on this date. New online and phone bookings appear here as they come in.</p>
      </div>
    );
  }
  return (
    <ol className="ad-agenda">
      {items.map((b) => (
        <li key={b.id}>
          <button type="button" className={`ad-slot ad-slot--${b.status.toLowerCase()}`} onClick={() => onOpen(b.id)}>
            <span className="ad-slot-time">
              <span>{b.time}</span>
              {b.endTime && <span className="ad-slot-end">to {b.endTime}</span>}
            </span>
            <span className="ad-slot-main">
              <span className="ad-slot-line">
                <span className="ad-job-plate">{b.plate}</span>
                <span className="ad-slot-who">{b.customer}</span>
              </span>
              <span className="ad-job-what">
                {b.service}
                {b.bay ? ` · Bay ${b.bay}` : ""}
              </span>
            </span>
            <span className="ad-slot-side">
              <StatusBadge label={b.status} />
              <span className="ad-slot-amt">
                <span className="ad-data">{b.amount}</span>
                <StatusBadge label={b.payment} />
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
