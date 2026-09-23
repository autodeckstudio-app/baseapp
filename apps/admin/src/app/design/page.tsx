// Theme reference: the AutoDeck experience tokens and glass primitives on
// the dark studio ground. Static, no data, no auth. Used to review M1 and
// as the visual contract screens are checked against.
import type { Metadata } from "next";
import { Ambient, Glass } from "../../experience";

export const metadata: Metadata = { title: "AutoDeck theme" };

const swatches = [
  ["canvas", "--ad-canvas"],
  ["surface", "--ad-surface"],
  ["accent", "--ad-accent"],
  ["accent strong", "--ad-accent-strong"],
  ["premium", "--ad-premium"],
  ["danger", "--ad-danger"],
  ["inactive", "--ad-inactive"],
] as const;

export default function DesignPage() {
  return (
    <Ambient>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "var(--ad-space-section) var(--ad-space-inset)", fontFamily: "var(--ad-font-body), system-ui, sans-serif" }}>
        <p className="ad-label">AutoDeck · Theme</p>
        <h1 className="ad-display" style={{ margin: "var(--ad-space-breath) 0 var(--ad-space-line)" }}>
          Your car, in good hands.
        </h1>
        <p className="ad-muted" style={{ maxWidth: "var(--ad-measure)", margin: 0 }}>
          Dark studio ground, one warm light, glass panes. Amber is the studio working; champagne is what it has already done.
        </p>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--ad-space-gap)", marginTop: "var(--ad-space-section)" }}>
          <Glass round="pane" pad="inset">
            <p className="ad-label">Glass · base</p>
            <p className="ad-title" style={{ margin: "var(--ad-space-breath) 0" }}>GJ 01 AB 1234</p>
            <p className="ad-muted" style={{ margin: 0 }}>Ceramic coat · Bay 2</p>
          </Glass>
          <Glass round="pane" pad="inset" fill="warm" tone="accent">
            <p className="ad-label">Glass · warm (active)</p>
            <p className="ad-title" style={{ margin: "var(--ad-space-breath) 0" }}>In the studio</p>
            <span className="ad-chip ad-chip--accent">● Live · polishing</span>
          </Glass>
          <Glass round="pane" pad="inset" fill="cool">
            <p className="ad-label">Glass · cool (premium)</p>
            <p className="ad-title" style={{ margin: "var(--ad-space-breath) 0" }}>Gold membership</p>
            <span className="ad-chip ad-chip--premium">3 washes left</span>
          </Glass>
          <Glass round="pane" pad="inset" fill="lit" raised>
            <p className="ad-label">Glass · lit, raised</p>
            <p className="ad-data" style={{ fontSize: 28, margin: "var(--ad-space-breath) 0" }}>₹ 18,450</p>
            <p className="ad-muted" style={{ margin: 0 }}>Invoice due today</p>
          </Glass>
        </section>

        <section style={{ marginTop: "var(--ad-space-section)" }}>
          <Glass round="card" pad="inset">
            <p className="ad-label">Actions and status</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ad-space-line)", alignItems: "center", marginTop: "var(--ad-space-line)" }}>
              <button className="ad-button ad-button--primary" type="button">Book a visit</button>
              <button className="ad-button" type="button">View history</button>
              <button className="ad-button" type="button" disabled>Unavailable</button>
              <span className="ad-chip">Booked</span>
              <span className="ad-chip ad-chip--accent">In progress</span>
              <span className="ad-chip ad-chip--premium">Ready</span>
              <span className="ad-chip ad-chip--danger">Payment failed</span>
              <span className="ad-chip ad-chip--inactive">Expired</span>
            </div>
          </Glass>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "var(--ad-space-line)", marginTop: "var(--ad-space-section)" }}>
          {swatches.map(([name, v]) => (
            <div key={name}>
              <div style={{ height: 56, borderRadius: "var(--ad-radius-chip)", background: `var(${v})`, border: "1px solid var(--ad-border-subtle)" }} />
              <p className="ad-label" style={{ marginTop: "var(--ad-space-breath)" }}>{name}</p>
            </div>
          ))}
        </section>
      </main>
    </Ambient>
  );
}
