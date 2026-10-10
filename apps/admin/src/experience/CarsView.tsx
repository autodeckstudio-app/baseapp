"use client";

// Cars for sale. Three tabs: Listings (studio stock and approved cars), To review (customer submissions),
// Leads (people who tapped "I'm interested" or reported a listing). Seller phone numbers stay here, never in the customer app.
import { useState } from "react";
import type { CarLead } from "@autodeck/core";
import type { AdminListing, ListingInput } from "../lib/carsale-service";
import { PageHead } from "./Office";

const rupees = (paise: number) => `Rs ${(paise / 100).toLocaleString("en-IN")}`;
const STATUS: Record<string, string> = { draft: "Draft", pending: "Waiting for review", live: "Live", reserved: "Reserved", sold: "Sold", rejected: "Rejected", expired: "Expired" };

type Form = { id?: string; make: string; model: string; variant: string; year: string; km: string; fuel: ListingInput["fuel"]; gearbox: ListingInput["gearbox"]; body: string; owners: string; colour: string; area: string; price: string; description: string; insurance: string; status: ListingInput["status"]; sellerName: string; sellerPhone: string; reg: string; reserve: string; notes: string; paths: string[] };
const blank = (): Form => ({ make: "", model: "", variant: "", year: String(new Date().getFullYear() - 3), km: "", fuel: "petrol", gearbox: "manual", body: "", owners: "1", colour: "", area: "", price: "", description: "", insurance: "", status: "live", sellerName: "", sellerPhone: "", reg: "", reserve: "", notes: "", paths: [] });
const thumb = (u: string): string => (/^https:\/\/(firebasestorage|storage)\.googleapis\.com\//.test(u) ? `/_next/image?url=${encodeURIComponent(u)}&w=640&q=70` : u);
const fromListing = (l: AdminListing): Form => ({ id: l.id, make: l.make, model: l.model, variant: l.variant ?? "", year: String(l.year), km: String(l.kmDriven), fuel: l.fuel, gearbox: l.gearbox, body: l.bodyType ?? "", owners: String(l.owners), colour: l.colour, area: l.area, price: String(l.askingPrice / 100), description: l.description ?? "", insurance: l.insuranceValidTill ?? "", status: (["draft", "live", "reserved", "sold"].includes(l.status) ? l.status : "draft") as Form["status"], sellerName: l.sellerName ?? "", sellerPhone: l.sellerPhone ?? "", reg: l.registrationNumber ?? "", reserve: l.reservePrice ? String(l.reservePrice / 100) : "", notes: l.adminNotes ?? "", paths: l.photoPaths });

export function CarsView(p: {
  listings: AdminListing[]; leads: CarLead[]; loading: boolean; busy: boolean; error: string | null; message: string | null;
  onSave: (input: ListingInput, newFiles: File[]) => void;
  onReview: (l: AdminListing, decision: "approve" | "reject", reason?: string) => void;
  onLead: (l: CarLead, status: CarLead["status"]) => void;
}) {
  const [tab, setTab] = useState<"listings" | "review" | "leads">("listings");
  const [form, setForm] = useState<Form | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const pending = p.listings.filter((l) => l.status === "pending");
  const others = p.listings.filter((l) => l.status !== "pending");
  const newLeads = p.leads.filter((l) => l.status === "new").length;
  const byId = new Map(p.listings.map((l) => [l.id, l]));
  const set = (k: keyof Form, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const num = (s: string) => Number(s.replace(/,/g, ""));
  const ok = form && form.make.trim() && form.model.trim() && form.colour.trim() && form.area.trim() && num(form.price) >= 1000 && num(form.km) >= 0 && (form.paths.length + files.length) > 0;

  function save() {
    if (!form) return;
    p.onSave({
      ...(form.id ? { listingId: form.id } : {}), status: form.status, make: form.make.trim(), model: form.model.trim(), variant: form.variant.trim() || null,
      year: num(form.year), kmDriven: num(form.km), fuel: form.fuel, gearbox: form.gearbox, bodyType: (form.body || null) as NonNullable<ListingInput["bodyType"]> | null, owners: num(form.owners), colour: form.colour.trim(), area: form.area.trim(),
      askingPrice: Math.round(num(form.price) * 100), description: form.description.trim() || null, insuranceValidTill: form.insurance || null, photoPaths: form.paths,
      sellerName: form.sellerName.trim() || null, sellerPhone: form.sellerPhone.trim() || null, registrationNumber: form.reg.trim() || null,
      reservePrice: form.reserve ? Math.round(num(form.reserve) * 100) : null, adminNotes: form.notes.trim() || null,
    }, files);
    setForm(null); setFiles([]);
  }

  const row = (l: AdminListing, review: boolean) => (
    <li key={l.id} className="ax-car">
      <div className="ax-car-img">
        {l.photoUrls[0] ? <img src={thumb(l.photoUrls[0])} alt="" loading="lazy" decoding="async" /> : null}
        <span className={`ax-car-status ax-car-status--${l.status}`}>{STATUS[l.status]}</span>
      </div>
      <div className="ax-car-body">
        <span className="ax-car-title">{l.year} {l.make} {l.model}{l.variant ? ` ${l.variant}` : ""}</span>
        <span className="ax-car-price">{rupees(l.askingPrice)}</span>
        <span className="ax-car-meta">{l.kmDriven.toLocaleString("en-IN")} km{l.source === "customer" ? ` · from ${l.sellerName ?? "a customer"}` : ""}</span>
        {review && <span className="ax-sub ax-car-note">Seller phone {l.sellerPhone ?? "none"}{l.registrationNumber ? ` · ${l.registrationNumber}` : ""}. Check the RC and any open loan before approving.</span>}
        {l.status === "rejected" && l.rejectionReason && <span className="ax-sub ax-car-note">Reason: {l.rejectionReason}</span>}
      </div>
      <div className="ax-car-actions">
        {review ? (
          rejectId === l.id ? (
            <>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for the seller" aria-label="Reason" maxLength={300} />
              <button type="button" className="ax-button ax-button--danger" disabled={p.busy || !reason.trim()} onClick={() => { p.onReview(l, "reject", reason.trim()); setRejectId(null); setReason(""); }}>Reject</button>
              <button type="button" className="ax-button" onClick={() => setRejectId(null)}>Cancel</button>
            </>
          ) : (
            <>
              <button type="button" className="ax-button ax-button--primary" disabled={p.busy} onClick={() => p.onReview(l, "approve")}>Approve</button>
              <button type="button" className="ax-button" onClick={() => setRejectId(l.id)}>Reject</button>
            </>
          )
        ) : null}
        <button type="button" className="ax-button" onClick={() => { setForm(fromListing(l)); setFiles([]); }}>Edit</button>
      </div>
    </li>
  );

  return (
    <div className="ax-page">
      <PageHead eyebrow="Office" title="Cars for sale" kpis={[{ value: p.listings.filter((l) => l.status === "live").length, label: "Live" }, { value: pending.length, label: "To review", tone: pending.length ? "accent" : undefined }, { value: newLeads, label: "New leads", tone: newLeads ? "accent" : undefined }]} />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}
      <div className="ax-row-actions" role="tablist" style={{ marginBottom: 12 }}>
        {([["listings", "Listings"], ["review", `To review (${pending.length})`], ["leads", `Leads (${p.leads.length})`]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "ax-button ax-button--primary" : "ax-button"} onClick={() => setTab(k)}>{label}</button>
        ))}
        <button type="button" className="ax-button" onClick={() => { setForm(blank()); setFiles([]); setTab("listings"); }}>Add a car</button>
      </div>

      <div className="ax-detail">
        <div className="ax-detail-main">
          <section className="ax-panel">
            {p.loading ? [0, 1, 2].map((i) => <div key={i} className="ax-skel ax-skel--row" />) : tab === "listings" ? (
              others.length === 0 ? <p className="ax-note">No cars yet. Use Add a car to list the first one.</p> : <ul className="ax-cars">{others.map((l) => row(l, false))}</ul>
            ) : tab === "review" ? (
              pending.length === 0 ? <p className="ax-note">Nothing waiting. Customer cars show here before anyone else can see them.</p> : <ul className="ax-cars">{pending.map((l) => row(l, true))}</ul>
            ) : p.leads.length === 0 ? <p className="ax-note">No enquiries yet.</p> : (
              <ul className="ax-list">
                {p.leads.map((ld) => {
                  const l = byId.get(ld.listingId);
                  return (
                    <li key={ld.id} className="ax-list-row">
                      <span className="ax-slot-main">
                        <span className="ax-person-name">{ld.kind === "report" ? "Report" : "Interested"}: {l ? `${l.year} ${l.make} ${l.model}` : "a car"}</span>
                        <span className="ax-sub">{ld.buyerName}{ld.buyerPhone ? ` · ${ld.buyerPhone}` : ""} · {new Date(ld.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {ld.status}</span>
                        {ld.note && <span className="ax-sub">{ld.note}</span>}
                      </span>
                      <span className="ax-row-actions">
                        {ld.status !== "contacted" && <button type="button" className="ax-button" disabled={p.busy} onClick={() => p.onLead(ld, "contacted")}>Mark contacted</button>}
                        {ld.status !== "closed" && <button type="button" className="ax-button" disabled={p.busy} onClick={() => p.onLead(ld, "closed")}>Close</button>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        {form && (
          <div className="ax-detail-side">
            <section className="ax-panel">
              <span className="ax-label">{form.id ? "Edit car" : "Add a car"}</span>
              <div className="ax-form-section">
                <div className="ax-form-pair"><input value={form.make} onChange={(e) => set("make", e.target.value)} placeholder="Make" aria-label="Make" /><input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="Model" aria-label="Model" /></div>
                <input value={form.variant} onChange={(e) => set("variant", e.target.value)} placeholder="Variant (optional)" aria-label="Variant" />
                <div className="ax-form-pair"><input value={form.year} onChange={(e) => set("year", e.target.value)} inputMode="numeric" placeholder="Year" aria-label="Year" /><input value={form.km} onChange={(e) => set("km", e.target.value)} inputMode="numeric" placeholder="Km driven" aria-label="Km driven" /></div>
                <div className="ax-form-pair">
                  <select value={form.fuel} onChange={(e) => set("fuel", e.target.value)} aria-label="Fuel">{["petrol", "diesel", "cng", "electric", "hybrid"].map((x) => <option key={x}>{x}</option>)}</select>
                  <select value={form.gearbox} onChange={(e) => set("gearbox", e.target.value)} aria-label="Gearbox"><option>manual</option><option>automatic</option></select>
                </div>
                <select value={form.body} onChange={(e) => set("body", e.target.value)} aria-label="Body type"><option value="">Body type (optional)</option>{["hatchback", "sedan", "suv", "muv", "coupe", "other"].map((x) => <option key={x}>{x}</option>)}</select>
                <div className="ax-form-pair"><input value={form.owners} onChange={(e) => set("owners", e.target.value)} inputMode="numeric" placeholder="Owners" aria-label="Owners" /><input value={form.colour} onChange={(e) => set("colour", e.target.value)} placeholder="Colour" aria-label="Colour" /></div>
                <input value={form.area} onChange={(e) => set("area", e.target.value)} placeholder="Area or city (not a full address)" aria-label="Area" />
                <input value={form.price} onChange={(e) => set("price", e.target.value)} inputMode="numeric" placeholder="Asking price in rupees" aria-label="Asking price" />
                <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Short description. No phone numbers or links." aria-label="Description" maxLength={1000} rows={3} />
                <label className="ax-sub">Insurance valid till<input type="date" value={form.insurance} onChange={(e) => set("insurance", e.target.value)} aria-label="Insurance valid till" /></label>
                <label className="ax-sub">Photos ({form.paths.length} saved{files.length ? `, ${files.length} to upload` : ""}). First one is the cover.
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Photos" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 12 - form.paths.length))} />
                </label>
                <select value={form.status} onChange={(e) => set("status", e.target.value)} aria-label="Status"><option value="live">Live</option><option value="draft">Draft (hidden)</option><option value="reserved">Reserved</option><option value="sold">Sold</option></select>
                <span className="ax-label">Private, never shown to customers</span>
                <div className="ax-form-pair"><input value={form.sellerName} onChange={(e) => set("sellerName", e.target.value)} placeholder="Seller name" aria-label="Seller name" /><input value={form.sellerPhone} onChange={(e) => set("sellerPhone", e.target.value)} placeholder="Seller phone" aria-label="Seller phone" /></div>
                <div className="ax-form-pair"><input value={form.reg} onChange={(e) => set("reg", e.target.value)} placeholder="Registration number" aria-label="Registration number" /><input value={form.reserve} onChange={(e) => set("reserve", e.target.value)} inputMode="numeric" placeholder="Lowest price" aria-label="Lowest price" /></div>
                <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notes" aria-label="Notes" maxLength={500} rows={2} />
                <button type="button" className="ax-button ax-button--primary" disabled={p.busy || !ok} onClick={save}>Save car</button>
                <button type="button" className="ax-button" onClick={() => setForm(null)}>Cancel</button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
