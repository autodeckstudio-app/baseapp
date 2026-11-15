"use client";

// Static preview of the job detail layout with sample content.
import { StaffShell } from "../../../experience/StaffShell";
import { StageTrack } from "../../../experience/StageTrack";
import { StatusBadge } from "../../../components/StatusBadge";
import "../../../experience/shell.css";

export default function JobPreview() {
  return (
    <StaffShell pathname="/jobs" office role="admin" who="studio@autodeck.example" home="/design/job" onSignOut={() => {}}>
      <div className="ax-page">
        <button type="button" className="ax-back">‹ Studio floor</button>
        <header className="ax-hero">
          <div>
            <p className="ax-label">Booked job · Ceramic coat</p>
            <h1>GJ 01 AB 1234</h1>
            <p className="ax-hero-sub">Hyundai Creta · Riya Patel</p>
          </div>
          <div className="ax-hero-side">
            <StatusBadge label="IN_PROGRESS" />
            <span className="ax-hero-total">₹18,450</span>
            <StatusBadge label="partial" />
          </div>
        </header>
        <StageTrack current="IN_PROGRESS" />
        <div className="ax-detail">
          <div className="ax-detail-main">
            <section className="ax-panel">
              <span className="ax-label">Timeline</span>
              <ol className="ax-timeline">
                <li><span className="ax-timeline-dot" /><span>In progress<span className="ax-timeline-note">Decontamination wash done, polishing started</span></span><span className="ax-timeline-meta">23 Sep, 10:15 am</span></li>
                <li><span className="ax-timeline-dot" /><span>Checked in<span className="ax-timeline-note">Minor swirl marks on bonnet noted</span></span><span className="ax-timeline-meta">23 Sep, 9:02 am</span></li>
                <li><span className="ax-timeline-dot" /><span>Awaiting vehicle</span><span className="ax-timeline-meta">20 Sep, 6:40 pm</span></li>
              </ol>
            </section>
            <section className="ax-panel">
              <span className="ax-label">Extra work approvals</span>
              <table>
                <thead><tr><th>Work</th><th>Status</th><th style={{ textAlign: "right" }}>Price</th></tr></thead>
                <tbody><tr><td>Headlight restoration</td><td><StatusBadge label="approved" /></td><td className="ax-data" style={{ textAlign: "right" }}>₹1,450</td></tr></tbody>
              </table>
            </section>
          </div>
          <aside className="ax-detail-side">
            <section className="ax-panel">
              <span className="ax-label">Car and owner</span>
              <div className="kv"><span>Customer</span><span>Riya Patel</span></div>
              <div className="kv"><span>Phone</span><span><a href="tel:+910000000000">+91 00000 00000</a></span></div>
              <div className="kv"><span>Plate</span><span className="ax-data">GJ 01 AB 1234</span></div>
              <div className="ax-panel-actions"><button type="button" className="ax-button">Open booking</button></div>
            </section>
            <section className="ax-panel">
              <span className="ax-label">Payment</span>
              <div className="kv"><span>UPI</span><span><StatusBadge label="completed" /></span></div>
              <div className="kv"><span>Amount</span><span className="ax-data">₹9,000</span></div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--ad-border-subtle)" }}>
                <p className="ax-label" style={{ margin: "0 0 12px" }}>Record a payment taken at the counter</p>
                <label className="ax-form-row"><span className="ax-label">Method</span><select defaultValue="cash"><option value="cash">Cash</option></select></label>
                <button type="button" className="ax-button ax-button--primary" style={{ width: "100%" }}>Record ₹9,450 received</button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </StaffShell>
  );
}
