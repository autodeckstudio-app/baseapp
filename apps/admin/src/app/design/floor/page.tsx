"use client";

// Static preview of the studio floor with sample jobs (no data, no auth).
import { StaffShell } from "../../../experience/StaffShell";
import { JobBoard, type BoardJob } from "../../../experience/JobBoard";
import "../../../experience/shell.css";

const J = (id: string, status: string, plate: string, customer: string, service: string, bay: string, when: string, payment: string, walkIn = false): BoardJob => ({ id, status, plate, customer, service, bay, when, payment, walkIn });

const SAMPLE: BoardJob[] = [
  J("1", "PENDING_VEHICLE", "GJ 01 KL 7781", "Nisha Desai", "Full detail", "3", "Today, 2:30 pm", "unpaid"),
  J("2", "PENDING_VEHICLE", "GJ 18 BA 0042", "Karan Joshi", "Wash + wax", "1", "Today, 4:00 pm", "unpaid"),
  J("3", "VEHICLE_RECEIVED", "MH 12 EF 4321", "Aarav Shah", "PPF front", "2", "Today, 10:00 am", "partial"),
  J("4", "IN_PROGRESS", "GJ 01 AB 1234", "Riya Patel", "Ceramic coat", "2", "Today, 9:00 am", "partial"),
  J("5", "IN_PROGRESS", "GJ 05 CD 9876", "Sahil Mehta", "Interior deep clean", "4", "Today, 11:30 am", "unpaid", true),
  J("6", "QUALITY_CHECK", "GJ 06 PQ 5510", "Dev Trivedi", "Paint correction", "1", "Yesterday, 3:00 pm", "unpaid"),
  J("7", "READY_FOR_DELIVERY", "GJ 01 ZX 9001", "Mira Kapoor", "Ceramic coat", "5", "Yesterday, 10:00 am", "paid"),
];

export default function FloorPreview() {
  return (
    <StaffShell pathname="/jobs" office role="admin" who="studio@autodeck.example" home="/design/floor" onSignOut={() => {}}>
      <div className="ad-page">
        <header className="ad-page-head">
          <div>
            <p className="ad-label">Studio floor</p>
            <h1>Jobs</h1>
          </div>
          <div className="ad-kpis">
            <div><span className="ad-kpi-v">2</span><span className="ad-label">Arriving today</span></div>
            <div><span className="ad-kpi-v ad-kpi-v--accent">4</span><span className="ad-label">In the studio</span></div>
            <div><span className="ad-kpi-v ad-kpi-v--premium">1</span><span className="ad-label">Ready for pickup</span></div>
          </div>
        </header>
        <div className="ad-toolbar">
          <div className="ad-seg"><button type="button" aria-pressed>Board</button><button type="button" aria-pressed={false}>List</button></div>
          <div className="ad-seg"><button type="button" aria-pressed>Today</button><button type="button" aria-pressed={false}>Upcoming</button><button type="button" aria-pressed={false}>All</button></div>
          <select aria-label="Source" defaultValue=""><option value="">Bookings and walk-ins</option></select>
          <input className="ad-search" type="search" placeholder="Search plate, customer or job" />
          <span className="ad-count">7 of 7</span>
        </div>
        <JobBoard jobs={SAMPLE} onOpen={() => {}} />
      </div>
    </StaffShell>
  );
}
