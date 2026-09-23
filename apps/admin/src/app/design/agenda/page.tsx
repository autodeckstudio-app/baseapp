"use client";

// Static preview of the bookings day agenda (no data, no auth).
import { StaffShell } from "../../../experience/StaffShell";
import { DayAgenda, type AgendaItem } from "../../../experience/DayAgenda";
import "../../../experience/shell.css";

const A = (id: string, time: string, endTime: string, plate: string, customer: string, service: string, bay: string, status: string, payment: string, amount: string): AgendaItem => ({ id, time, endTime, plate, customer, service, bay, status, payment, amount });

const ITEMS: AgendaItem[] = [
  A("1", "9:00 am", "1:00 pm", "GJ 01 AB 1234", "Riya Patel", "Ceramic coat", "2", "ACTIVE", "partial", "₹18,450"),
  A("2", "10:30 am", "11:30 am", "GJ 18 BA 0042", "Karan Joshi", "Wash + wax", "1", "CONFIRMED", "unpaid", "₹1,299"),
  A("3", "12:00 pm", "3:00 pm", "GJ 01 KL 7781", "Nisha Desai", "Full detail", "3", "PENDING", "unpaid", "₹6,500"),
  A("4", "2:30 pm", "3:30 pm", "MH 12 EF 4321", "Aarav Shah", "Interior deep clean", "4", "CONFIRMED", "paid", "₹2,999"),
  A("5", "4:00 pm", "5:00 pm", "GJ 05 CD 9876", "Sahil Mehta", "Wash + wax", "1", "CANCELLED", "refunded", "₹1,299"),
];

export default function AgendaPreview() {
  return (
    <StaffShell pathname="/bookings" office role="admin" who="studio@autodeck.example" home="/design/agenda" onSignOut={() => {}}>
      <div className="ad-page">
        <header className="ad-page-head">
          <div>
            <p className="ad-label">Studio schedule</p>
            <h1>Bookings</h1>
          </div>
          <div className="ad-kpis">
            <div><span className="ad-kpi-v">4</span><span className="ad-label">On this day</span></div>
            <div><span className="ad-kpi-v ad-kpi-v--accent">1</span><span className="ad-label">Need confirming</span></div>
            <div><span className="ad-kpi-v ad-kpi-v--premium">12</span><span className="ad-label">Coming up</span></div>
          </div>
        </header>
        <div className="ad-toolbar">
          <div className="ad-daynav">
            <button type="button" className="ad-button" aria-label="Previous day">‹</button>
            <span className="ad-daynav-date">Today</span>
            <button type="button" className="ad-button" aria-label="Next day">›</button>
          </div>
          <div className="ad-seg"><button type="button" aria-pressed>Day</button><button type="button" aria-pressed={false}>All dates</button></div>
          <input className="ad-search" type="search" placeholder="Search plate, customer or booking" />
        </div>
        <DayAgenda items={ITEMS} onOpen={() => {}} />
      </div>
    </StaffShell>
  );
}
