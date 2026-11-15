"use client";

// Static preview of the staff shell with sample content (no data, no auth),
// so the ground, sidebar and legacy-screen remap can be reviewed on any
// preview deployment without signing in.
import { StaffShell } from "../../../experience/StaffShell";
import "../../../experience/shell.css";

export default function ShellPreview() {
  return (
    <StaffShell pathname="/dashboard" office role="admin" who="studio@autodeck.example" home="/design/shell" onSignOut={() => {}}>
      <h1>Dashboard</h1>
      <p>Sample content. Existing screens render inside this frame unchanged until their own milestone.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, margin: "24px 0" }}>
        {[["In the studio", "6"], ["Ready for pickup", "2"], ["Today's revenue", "₹ 18,450"], ["Overdue invoices", "1"]].map(([l, v]) => (
          <div key={l} className="stat-tile">
            <div className="value">{v}</div>
            <div className="label">{l}</div>
          </div>
        ))}
      </div>
      <div className="alert-banner" style={{ background: "var(--color-warning-muted)", color: "var(--color-warning)" }}>
        1 booking is waiting for confirmation.
      </div>
      <div className="filter-bar" style={{ marginTop: 24 }}>
        <input placeholder="Search plate or name" />
        <select defaultValue="all"><option value="all">All statuses</option></select>
        <button type="submit">New booking</button>
        <button type="button">Export</button>
      </div>
      <table>
        <thead><tr><th>Plate</th><th>Customer</th><th>Service</th><th>Status</th></tr></thead>
        <tbody>
          <tr className="row-link"><td>GJ 01 AB 1234</td><td>R. Patel</td><td>Ceramic coat</td><td><span className="badge badge-accent">In progress</span></td></tr>
          <tr className="row-link"><td>GJ 05 CD 9876</td><td>S. Mehta</td><td>Wash + wax</td><td><span className="badge badge-success">Ready</span></td></tr>
          <tr className="row-link"><td>MH 12 EF 4321</td><td>A. Shah</td><td>PPF front</td><td><span className="badge badge-error">Payment failed</span></td></tr>
        </tbody>
      </table>
      <div className="detail-grid" style={{ marginTop: 24 }}>
        <div className="detail-card"><h3>Vehicle</h3><div className="kv"><span>Plate</span><span>GJ 01 AB 1234</span></div><div className="kv"><span>Bay</span><span>2</span></div></div>
        <div className="detail-card"><h3>Invoice</h3><div className="kv"><span>Total</span><span>₹ 18,450</span></div><div className="kv"><span>Due</span><span>Today</span></div></div>
      </div>
    </StaffShell>
  );
}
