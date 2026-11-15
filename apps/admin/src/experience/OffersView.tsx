"use client";

// Offers: one banner on the customer Home between a start and an end. You write the words and pick the image.
import { useRef, useState } from "react";
import type { OfferView } from "@autodeck/core";
import { PageHead } from "./Office";
import { offerFormError } from "../lib/offer-form";

const MAX_MB = 5;
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function state(o: OfferView, now: number): "live" | "scheduled" | "ended" | "hidden" {
  if (o.hidden) return "hidden";
  if (Date.parse(o.endsAt) <= now) return "ended";
  if (Date.parse(o.startsAt) > now) return "scheduled";
  return "live";
}
const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function OffersView(p: {
  offers: OfferView[];
  services: Array<{ id: string; name: string }>;
  loading: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  onPublish: (i: { file: File; headline: string; body: string; cta: string; linkKind: string; serviceId: string; startsAt: string; endsAt: string }) => void;
  onHide: (o: OfferView) => void;
  onEndNow: (o: OfferView) => void;
}) {
  const now = Date.now();
  const [file, setFile] = useState<File | null>(null);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("");
  const [linkKind, setLinkKind] = useState("catalogue");
  const [serviceId, setServiceId] = useState("");
  const [startsAt, setStartsAt] = useState(localInput(new Date()));
  const [endsAt, setEndsAt] = useState(localInput(new Date(Date.now() + 14 * 86400000)));
  const input = useRef<HTMLInputElement>(null);
  const badFile = file && (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > MAX_MB * 1024 * 1024);
  const formError = offerFormError({ headline, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), linkKind, serviceId, hasImage: !!file && !badFile }, now);
  const byNewest = [...p.offers].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const live = byNewest.filter((o) => state(o, now) === "live");
  const upcoming = byNewest.filter((o) => state(o, now) === "scheduled");
  const earlier = byNewest.filter((o) => ["ended", "hidden"].includes(state(o, now)));

  const card = (o: OfferView) => (
    <li key={o.id} className="ax-story">
      <div className="ax-story-media" style={{ aspectRatio: "16 / 9" }}><img src={o.url} alt={o.headline} loading="lazy" /></div>
      <div className="ax-story-body">
        <span className="ax-person-name">{o.headline}</span>
        <span className="ax-sub">{fmt(o.startsAt)} to {fmt(o.endsAt)} · {state(o, now)}</span>
      </div>
      <div className="ax-story-actions">
        {state(o, now) === "live" || state(o, now) === "scheduled" ? <button type="button" className="ax-button" disabled={p.busy} onClick={() => p.onEndNow(o)}>End now</button> : null}
        <button type="button" className="ax-button" disabled={p.busy} onClick={() => p.onHide(o)}>{o.hidden ? "Show" : "Hide"}</button>
      </div>
    </li>
  );
  const section = (label: string, note: string, list: OfferView[], empty: string) => (
    <section className="ax-panel">
      <span className="ax-label">{label}</span>
      <p className="ax-note" style={{ marginTop: 4 }}>{note}</p>
      {p.loading ? [0, 1].map((i) => <div key={i} className="ax-skel ax-skel--row" />) : list.length === 0 ? <p className="ax-note">{empty}</p> : <ul className="ax-story-grid">{list.map(card)}</ul>}
    </section>
  );

  return (
    <div className="ax-page">
      <PageHead eyebrow="Studio" title="Offers" kpis={[{ value: live.length, label: "Live now" }, { value: upcoming.length, label: "Scheduled" }]} />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}
      <div className="ax-detail">
        <div className="ax-detail-main">
          {section("Live now", "Shown as the banner on the customer Home. If two are live, the newest one shows first.", live, "Nothing live. Add an offer.")}
          {upcoming.length ? section("Scheduled", "These start later and show on their own.", upcoming, "") : null}
          {earlier.length ? section("Earlier", "Ended or hidden offers. Nothing is deleted.", earlier, "") : null}
        </div>
        <div className="ax-detail-side">
          <section className="ax-panel">
            <span className="ax-label">Add an offer</span>
            <div className="ax-form-section">
              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Offer image" disabled={p.busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {badFile && <p className="ax-note" role="alert">Use a JPG, PNG or WebP under {MAX_MB} MB.</p>}
              <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline" aria-label="Headline" maxLength={60} disabled={p.busy} />
              <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="One short line (optional)" aria-label="Short line" maxLength={120} disabled={p.busy} />
              <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Small label above the headline (optional)" aria-label="Label" maxLength={24} disabled={p.busy} />
              <label className="ax-note">Opens
                <select value={linkKind} onChange={(e) => setLinkKind(e.target.value)} disabled={p.busy} aria-label="Where it opens">
                  <option value="catalogue">All services</option>
                  <option value="membership">Membership</option>
                  <option value="service">One service</option>
                  <option value="none">Nothing (just an announcement)</option>
                </select>
              </label>
              {linkKind === "service" ? (
                <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={p.busy} aria-label="Service">
                  <option value="">Pick a service</option>
                  {p.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : null}
              <label className="ax-note">Starts<input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} disabled={p.busy} /></label>
              <label className="ax-note">Ends<input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} disabled={p.busy} /></label>
              {formError && file ? <p className="ax-note" role="status">{formError}</p> : null}
              <button
                type="button"
                className="ax-button ax-button--primary"
                disabled={p.busy || !!formError}
                onClick={() => { if (!file) return; p.onPublish({ file, headline: headline.trim(), body: body.trim(), cta: cta.trim(), linkKind, serviceId, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() }); setFile(null); setHeadline(""); setBody(""); setCta(""); if (input.current) input.current.value = ""; }}
              >
                Publish offer
              </button>
              <p className="ax-note">Write only what is true and what you will honour. A wide image (about 16:9) looks best.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
