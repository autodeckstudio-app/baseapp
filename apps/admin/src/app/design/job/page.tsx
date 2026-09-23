"use client";

// Static preview of the job detail layout with sample content.
import { StaffShell } from "../../../experience/StaffShell";
import { StageTrack } from "../../../experience/StageTrack";
import { StatusBadge } from "../../../components/StatusBadge";
import "../../../experience/shell.css";

export default function JobPreview() {
  return (
    <StaffShell pathname="/jobs" office role="admin" who="studio@autodeck.example" home="/design/job" onSignOut={() => {}}>
      <div className="ad-page">
        <button type="button" className="ad-back">‹ Studio floor</button>
        <header className="ad-hero">
          <div>
            <p className="ad-label">Booked job · Ceramic coat</p>
            <h1>GJ 01 AB 1234</h1>
            <p className="ad-hero-sub">Hyundai Creta · Riya Patel</p>
          </div>
          <div className="ad-hero-side">
            <StatusBadge label="IN_PROGRESS" />
            <span className="ad-hero-total">₹18,450</span>
            <StatusBadge label="partial" />
          </div>
        </header>
        <StageTrack current="IN_PROGRESS" />
        <div className="ad-detail">
          <div className="ad-detail-main">
            <section className="ad-panel">
              <span className="ad-label">Timeline</span>
              <ol className="ad-timeline">
                <li><span className="ad-timeline-dot" /><span>In progress<span className="ad-timeline-note">Decontamination wash done, polishing started</span></span><span className="ad-timeline-meta">23 Sep, 10:15 am</span></li>
                <li><span className="ad-timeline-dot" /><span>Checked in<span className="ad-timeline-note">Minor swirl marks on bonnet noted</span></span><span className="ad-timeline-meta">23 Sep, 9:02 am</span></li>
                <li><span className="ad-timeline-dot" /><span>Awaiting vehicle</span><span className="ad-timeline-meta">20 Sep, 6:40 pm</span></li>
              </ol>
            </section>
            <section className="ad-panel">
              <span className="ad-label">Extra work approvals</span>
              <table>
                <thead><tr><th>Work</th><th>Status</th><th style={{ textAlign: "right" }}>Price</th></tr></thead>
                <tbody><tr><td>Headlight restoration</td><td><StatusBadge label="approved" /></td><td className="ad-data" style={{ textAlign: "right" }}>₹1,450</td></tr></tbody>
              </table>
            </section>
          </div>
          <aside className="ad-detail-side">
            <section className="ad-panel">
              <span className="ad-label">Car and owner</span>
              <div className="kv"><span>Customer</span><span>Riya Patel</span></div>
              <div className="kv"><span>Phone</span><span><a href="tel:+910000000000">+91 00000 00000</a></span></div>
              <div className="kv"><span>Plate</span><span className="ad-data">GJ 01 AB 1234</span></div>
              <div className="ad-panel-actions"><button type="button" className="ad-button">Open booking</button></div>
            </section>
            <section className="ad-panel">
              <span className="ad-label">Payment</span>
              <div className="kv"><span>UPI</span><span><StatusBadge label="completed" /></span></div>
              <div className="kv"><span>Amount</span><span className="ad-data">₹9,000</span></div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--ad-border-subtle)" }}>
                <p className="ad-label" style={{ margin: "0 0 12px" }}>Record a payment taken at the counter</p>
                <label className="ad-form-row"><span className="ad-label">Method</span><select defaultValue="cash"><option value="cash">Cash</option></select></label>
                <button type="button" className="ad-button ad-button--primary" style={{ width: "100%" }}>Record ₹9,450 received</button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </StaffShell>
  );
}
