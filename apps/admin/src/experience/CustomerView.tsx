"use client";

// One customer, whole relationship: cars and papers, membership, visits,
// money, and one log of changes and messages sent, on one glass page with tabs.
import { useState } from "react";
import { STAFF_SEGMENTS } from "@autodeck/core";
import type { AuditLog, Booking, Customer, Invoice, Membership, Notification, Payment, Protection, Service, ServiceJob, Vehicle, Warranty } from "@autodeck/core";
import { Segmented } from "./Office";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, formatDateTime, formatPaise, studioToday } from "../lib/format";
import { methodLabel, statusLabel } from "../lib/status-label";
import { KIND_LABEL, daysLeft } from "./VehiclesView";

type Tab = "overview" | "visits" | "money" | "log";

export interface CustomerData {
  customer: Customer;
  vehicles: Vehicle[];
  bookings: Booking[];
  jobs: ServiceJob[];
  memberships: Membership[];
  payments: Payment[];
  invoices: Invoice[];
  notifications: Notification[];
  audit: AuditLog[];
  warranties: Warranty[];
  protections: Array<Protection & { vehicleId: string }>;
}

function Row({ onClick, children, log }: { onClick?: () => void; children: React.ReactNode; log?: boolean }) {
  const cls = log ? "ax-crow ax-crow--log" : "ax-crow";
  return onClick ? <button type="button" className={`${cls} is-link`} onClick={onClick}>{children}</button> : <div className={cls}>{children}</div>;
}

/** Old notifications were stored with a broken rupee sign ("â ¹590"). Repair it for display. */
export function fixRupee(text?: string | null): string {
  if (!text) return "";
  return text.replace(/â[\u0080-\u00bf\s]{0,4}(?=\d)/g, "\u20b9");
}

export interface VehiclePatch { registrationNumber?: string; make?: string; model?: string; year?: number; color?: string; category?: "hatchback" | "sedan" | "suv" | "luxury" | "commercial" | "van" }

export interface ContactPatch { name?: string; email?: string; phone?: string }

export function CustomerView({ d, services, onBack, onOpen, onSave, onSaveVehicle, onResolveDoc }: { d: CustomerData; onResolveDoc?: (doc: { kind: "rc"; vehicleId: string; path: string } | { kind: "licence"; path: string }) => Promise<string>; onSaveVehicle?: (vehicleId: string, patch: VehiclePatch) => Promise<void>; services?: Service[]; onBack: () => void; onOpen: (href: string) => void; onSave?: (patch: ContactPatch) => Promise<void> }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [fName, setFName] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [carEdit, setCarEdit] = useState<{ id: string; reg: string; make: string; model: string; year: string; color: string; category: string } | null>(null);
  const [docMsg, setDocMsg] = useState<string | null>(null);
  async function openDoc(doc: { kind: "rc"; vehicleId: string; path: string } | { kind: "licence"; path: string }) {
    if (!onResolveDoc) return;
    setDocMsg(null);
    const win = window.open("", "_blank");
    try { const url = await onResolveDoc(doc); if (win) win.location.href = url; else window.location.href = url; }
    catch { win?.close(); setDocMsg("Could not open that photo."); }
  }
  const [carMsg, setCarMsg] = useState<string | null>(null);
  const [carBusy, setCarBusy] = useState(false);
  async function saveCar() {
    if (!carEdit || !onSaveVehicle) return;
    const year = carEdit.year.trim() ? Number(carEdit.year) : undefined;
    if (year !== undefined && (!Number.isInteger(year) || year < 1980)) { setCarMsg("Year must be a number like 2021."); return; }
    setCarBusy(true); setCarMsg(null);
    try {
      await onSaveVehicle(carEdit.id, {
        ...(carEdit.reg.trim() ? { registrationNumber: carEdit.reg.trim().toUpperCase().replace(/\s+/g, "") } : {}),
        ...(carEdit.make.trim() ? { make: carEdit.make.trim() } : {}),
        ...(carEdit.model.trim() ? { model: carEdit.model.trim() } : {}),
        ...(year !== undefined ? { year } : {}),
        ...(carEdit.color.trim() ? { color: carEdit.color.trim() } : {}),
        ...(carEdit.category ? { category: carEdit.category as NonNullable<VehiclePatch["category"]> } : {}),
      });
      setCarEdit(null);
    } catch (e) { setCarMsg(e instanceof Error ? e.message : "Could not save the car."); }
    finally { setCarBusy(false); }
  }
  const serviceName = (id: string) => services?.find((sv) => sv.id === id)?.name ?? "Service";
  const carLabel = (vehicleId: string, snap?: { registrationNumber?: string; make?: string; model?: string }) => {
    const v = d.vehicles.find((x) => x.id === vehicleId) ?? snap;
    return v ? [v.registrationNumber, [v.make, v.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ") : "";
  };
  function startEdit() {
    setFName(d.customer.name ?? "");
    setFEmail(d.customer.email ?? "");
    setFPhone("");
    setSaveMsg(null);
    setEditing(true);
  }
  async function doSave() {
    if (!onSave) return;
    const patch: ContactPatch = {};
    if (fName.trim() && fName.trim() !== d.customer.name) patch.name = fName.trim();
    if (fEmail.trim() !== (d.customer.email ?? "")) patch.email = fEmail.trim();
    if (!d.customer.phone && fPhone.trim()) patch.phone = fPhone.trim();
    if (Object.keys(patch).length === 0) { setEditing(false); return; }
    setSaving(true);
    setSaveMsg(null);
    try {
      await onSave(patch);
      setEditing(false);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }
  const today = studioToday();
  const paid = d.payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);
  const activeMember = d.memberships.find((m) => m.status === "active");
  const visits = d.jobs.filter((j) => j.status === "DELIVERED").length;
  const delivered = d.jobs.filter((j) => j.status === "DELIVERED");
  const outstanding = d.invoices.filter((i) => i.status !== "paid" && i.status !== "void").reduce((n, i) => n + i.total, 0);
  const lastVisit = delivered.map((j) => j.scheduledAt ?? "").sort().pop() ?? null;
  const nowIso = new Date().toISOString();
  const nextBooking = d.bookings.filter((b) => b.scheduledAt && b.scheduledAt >= nowIso && !["CANCELLED", "COMPLETED", "NO_SHOW", "MISSED"].includes(String(b.status))).map((b) => b.scheduledAt).sort()[0] ?? null;
  const avgTicket = visits > 0 ? Math.round(paid / visits) : 0;
  const waDigits = (d.customer.phone ?? "").replace(/\D/g, "");
  // One row per visit: a booking that became a job shows once, as the job. Walk-ins are jobs with no booking.
  const jobBookingIds = new Set(d.jobs.map((j) => j.bookingId).filter(Boolean) as string[]);
  const log = [
    ...d.audit.map((a) => ({ id: `a-${a.id}`, at: a.createdAt, title: statusLabel(a.action), body: "", who: statusLabel(a.performedByRole) })),
    ...d.notifications.map((n) => ({ id: `n-${n.id}`, at: n.createdAt, title: `Sent: ${fixRupee(n.title) || "message"}`, body: fixRupee(n.body), who: n.readAt ? "Read" : "Not read" })),
  ].sort((x, y) => (x.at < y.at ? 1 : -1));
  const timeline = [
    ...d.bookings.filter((b) => !jobBookingIds.has(b.id)).map((b) => ({
      id: `b-${b.id}`, at: b.scheduledAt, type: "Booked", status: b.status, amount: b.totalAmount, href: `/bookings/${b.id}`,
      services: [serviceName(b.serviceId), ...(b.priceBreakdown?.addOns ?? []).map((a) => a.name)].join(" + "), car: carLabel(b.vehicleId, b.vehicleSnapshot),
    })),
    ...d.jobs.map((j) => ({
      id: `j-${j.id}`, at: j.scheduledAt, type: j.isWalkIn || !j.bookingId ? "Walk-in" : "Booked", status: j.status, amount: j.totalAmount, href: `/jobs/${j.id}`,
      services: [serviceName(j.serviceId), ...(j.priceBreakdown?.addOns ?? []).map((a) => a.name)].join(" + "), car: carLabel(j.vehicleId, j.vehicleSnapshot),
    })),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return (
    <div className="ax-page">
      <button type="button" className="ax-back" onClick={onBack} style={{ background: "none", border: "none", padding: 0, minHeight: 0 }}>‹ Customers</button>
      <div className="ax-hero">
        <div>
          <p className="ax-label">Customer since {formatDate(d.customer.createdAt)}</p>
          <h1 className="ax-hero-name">{d.customer.name || "Unnamed customer"}</h1>
          <p className="ax-hero-sub">{activeMember ? `${statusLabel(activeMember.tier)} member` : "Customer"}{d.vehicles.length ? ` · ${d.vehicles.length} ${d.vehicles.length === 1 ? "car" : "cars"}` : ""}{onSave && !editing ? <> · <button type="button" className="ax-inline-add" onClick={startEdit}>Edit details</button></> : null}</p>
        </div>
        <div className="ax-kpis">
          <div><span className="ax-kpi-v ax-kpi-v--premium">{formatPaise(paid)}</span><span className="ax-label">Paid to date</span></div>
          <div><span className={`ax-kpi-v${outstanding > 0 ? " ax-kpi-v--accent" : ""}`}>{formatPaise(outstanding)}</span><span className="ax-label">Unpaid</span></div>
          <div><span className="ax-kpi-v">{visits}</span><span className="ax-label">Cars delivered</span></div>
          <div><span className="ax-kpi-v">{formatPaise(avgTicket)}</span><span className="ax-label">Avg per visit</span></div>
        </div>
      </div>

      <section className="ax-panel ax-cust-facts" aria-label="Contact and activity">
        {editing ? (
          <>
            <label className="ax-cust-edit"><span className="ax-label">Name</span><input value={fName} onChange={(e) => setFName(e.target.value)} autoComplete="off" /></label>
            <label className="ax-cust-edit"><span className="ax-label">Email</span><input value={fEmail} onChange={(e) => setFEmail(e.target.value)} inputMode="email" autoComplete="off" /></label>
            <label className="ax-cust-edit"><span className="ax-label">Phone</span>
              {d.customer.phone ? <input value={d.customer.phone} disabled aria-label="Phone (their login, cannot be changed)" /> : <input value={fPhone} onChange={(e) => setFPhone(e.target.value)} inputMode="tel" placeholder="10-digit mobile" autoComplete="off" />}
            </label>
            <div className="ax-cust-edit-actions">
              <button type="button" className="ax-button" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
              <button type="button" className="ax-button ax-button--primary" onClick={() => void doSave()} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
            {saveMsg && <p className="ax-status-msg ax-status-msg--warn" role="alert" style={{ gridColumn: "1 / -1", margin: 0 }}>{saveMsg}</p>}
          </>
        ) : (
          <>
            <div><span className="ax-label">Phone</span><p>{d.customer.phone ? <a href={`tel:${d.customer.phone}`}>{d.customer.phone}</a> : <button type="button" className="ax-inline-add" onClick={startEdit}>Add phone</button>}{waDigits ? <> · <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer">WhatsApp</a></> : null}</p></div>
            <div><span className="ax-label">Email</span><p>{d.customer.email ? <a href={`mailto:${d.customer.email}`}>{d.customer.email}</a> : <button type="button" className="ax-inline-add" onClick={startEdit}>Add email</button>}</p></div>
            <div><span className="ax-label">Last visit</span><p>{lastVisit ? formatDate(lastVisit) : "No visit yet"}</p></div>
            <div><span className="ax-label">Next booking</span><p>{nextBooking ? formatDateTime(nextBooking) : "None booked"}</p></div>
            <div><span className="ax-label">Membership</span><p>{activeMember ? `${statusLabel(activeMember.tier)}, ${Math.max(0, activeMember.washesTotal - activeMember.washesUsed)} washes left` : "None"}</p></div>
            <div><span className="ax-label">Alerts</span><p>{d.customer.notificationPrefs?.push ? "Push on" : "Push off"}</p></div>
          </>
        )}
      </section>

      <div className="ax-toolbar">
        <Segmented<Tab> value={tab} onChange={setTab} options={[
          { value: "overview", label: "Overview" },
          { value: "visits", label: `Visits ${timeline.length}` },
          { value: "money", label: "Money" },
          { value: "log", label: "Activity" },
        ]} />
      </div>

      {tab === "overview" && (
        <div className="ax-detail">
          <div className="ax-detail-main">
            <section className="ax-panel">
              <span className="ax-label">Cars</span>
              <p className="ax-sub" style={{ margin: "4px 0 8px" }}>{d.customer.licensePhotoUrl ? <button type="button" className="ax-button" onClick={() => void openDoc({ kind: "licence", path: d.customer.licensePhotoUrl as string })}>View driving licence</button> : "No driving licence on file"}{docMsg ? ` · ${docMsg}` : ""}</p>
              {d.vehicles.length === 0 ? <p className="ax-note" style={{ marginTop: 0 }}>No cars on file.</p> : d.vehicles.map((v) => {
                const papers = d.protections.filter((p) => p.vehicleId === v.id);
                return (
                  <div key={v.id} className="ax-ocar">
                    <div className="ax-car-head">
                      <span className="ax-job-plate" style={{ fontSize: 18 }}>{v.registrationNumber}</span>
                      <span className="ax-sub">{[v.year, v.make, v.model, v.color].filter(Boolean).join(" ")}{v.category ? ` · ${v.category === "suv" ? "SUV" : statusLabel(v.category)}` : ""}</span>
                    </div>
                    <p className="ax-sub" style={{ margin: "6px 0 0" }}>{v.rcPhotoUrl ? <button type="button" className="ax-button" onClick={() => void openDoc({ kind: "rc", vehicleId: v.id, path: v.rcPhotoUrl as string })}>View RC photo</button> : "No RC photo"}</p>
                    {onSaveVehicle && carEdit?.id !== v.id ? <button type="button" className="ax-button" style={{ marginTop: 8 }} onClick={() => { setCarMsg(null); setCarEdit({ id: v.id, reg: v.registrationNumber ?? "", make: v.make ?? "", model: v.model ?? "", year: v.year ? String(v.year) : "", color: v.color ?? "", category: v.category ?? "" }); }}>Edit car</button> : null}
                    {carEdit?.id === v.id ? (
                      <form onSubmit={(e) => { e.preventDefault(); void saveCar(); }} style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        <div className="ax-form-pair">
                          <label className="ax-form-row"><span>Plate</span><input value={carEdit.reg} onChange={(e) => setCarEdit({ ...carEdit, reg: e.target.value })} /></label>
                          <label className="ax-form-row"><span>Size</span>
                            <select value={carEdit.category} onChange={(e) => setCarEdit({ ...carEdit, category: e.target.value })}>
                              <option value="">Not set</option>{STAFF_SEGMENTS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                          </label>
                        </div>
                        <div className="ax-form-pair">
                          <label className="ax-form-row"><span>Make</span><input value={carEdit.make} onChange={(e) => setCarEdit({ ...carEdit, make: e.target.value })} /></label>
                          <label className="ax-form-row"><span>Model</span><input value={carEdit.model} onChange={(e) => setCarEdit({ ...carEdit, model: e.target.value })} /></label>
                        </div>
                        <div className="ax-form-pair">
                          <label className="ax-form-row"><span>Year</span><input inputMode="numeric" value={carEdit.year} onChange={(e) => setCarEdit({ ...carEdit, year: e.target.value })} /></label>
                          <label className="ax-form-row"><span>Colour</span><input value={carEdit.color} onChange={(e) => setCarEdit({ ...carEdit, color: e.target.value })} /></label>
                        </div>
                        {carMsg ? <p className="ax-note" style={{ color: "var(--ad-warning)" }}>{carMsg}</p> : null}
                        <div className="ax-panel-actions">
                          <button type="submit" className="ax-button ax-button--primary" disabled={carBusy}>{carBusy ? "Saving" : "Save car"}</button>
                          <button type="button" className="ax-button" onClick={() => setCarEdit(null)}>Cancel</button>
                        </div>
                      </form>
                    ) : null}
                    <p className="ax-sub" style={{ margin: "6px 0 0" }}>{d.jobs.filter((j) => j.vehicleId === v.id).length} jobs · {d.jobs.filter((j) => j.vehicleId === v.id && j.status === "DELIVERED").length} delivered</p>
                    {papers.length > 0 && (
                      <ul className="ax-chips-list" style={{ marginTop: 8 }}>
                        {papers.map((p) => {
                          const left = p.expiryDate ? daysLeft(p.expiryDate, today) : null;
                          const cls = left === null ? "" : left < 0 ? " ax-chip--danger" : left <= 30 ? " ax-chip--accent" : " ax-chip--premium";
                          return <li key={p.id} className={`ax-chip${cls}`}>{KIND_LABEL[p.kind]}{left === null ? "" : left < 0 ? " · expired" : ` · ${left}d`}</li>;
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>
            <section className="ax-panel">
              <span className="ax-label">Warranties</span>
              {d.warranties.length === 0 ? <p className="ax-note" style={{ marginTop: 0 }}>No warranties issued.</p> : d.warranties.map((w) => (
                <div key={w.id} className="kv"><span>{w.warrantyLabel}</span><span>{w.endDate ? `until ${formatDate(w.endDate)}` : "No fixed end"}</span></div>
              ))}
            </section>
          </div>
          <aside className="ax-detail-side">
            <section className="ax-panel">
              <span className="ax-label">Membership</span>
              {d.memberships.length === 0 ? <p className="ax-note" style={{ marginTop: 0 }}>Not a member.</p> : d.memberships.map((m) => (
                <div key={m.id} style={{ marginBottom: 12 }}>
                  <div className="kv"><span>{statusLabel(m.tier)}</span><StatusBadge label={m.status} /></div>
                  <div className="ax-meter" aria-label={`${m.washesUsed} of ${m.washesTotal} washes used`}><span style={{ width: `${m.washesTotal ? Math.min(100, (m.washesUsed / m.washesTotal) * 100) : 0}%` }} /></div>
                  <span className="ax-sub">{m.washesUsed} of {m.washesTotal} washes used · ends {formatDate(m.endDate)}</span>
                </div>
              ))}
            </section>
            <section className="ax-panel">
              <span className="ax-label">Latest</span>
              {timeline.slice(0, 3).map((t) => (
                <Row key={t.id} onClick={() => onOpen(t.href)}><span className="ax-vrow-main"><strong>{t.services}</strong><span className="ax-sub">{formatDate(t.at)}</span></span><StatusBadge label={t.status} /></Row>
              ))}
              {timeline.length === 0 && <p className="ax-note" style={{ marginTop: 0 }}>No visits yet.</p>}
            </section>
          </aside>
        </div>
      )}

      {tab === "visits" && (
        <section className="ax-panel">
          {timeline.length === 0 ? <p className="ax-note" style={{ margin: 0 }}>No bookings or jobs yet.</p> : timeline.map((t) => (
            <Row key={t.id} onClick={() => onOpen(t.href)}>
              <span className="ax-sub ax-vrow-when">{formatDateTime(t.at)}</span>
              <span className="ax-vrow-main"><strong>{t.services}</strong><span className="ax-sub">{[t.type, t.car].filter(Boolean).join(" · ")}</span></span>
              <StatusBadge label={t.status} />
              <span className="ax-data ax-vrow-amt">{formatPaise(t.amount)}</span>
            </Row>
          ))}
        </section>
      )}

      {tab === "money" && (
        <div className="ax-detail">
          <section className="ax-panel ax-detail-main">
            <span className="ax-label">Payments</span>
            {d.payments.length === 0 ? <p className="ax-note" style={{ marginTop: 0 }}>No payments.</p> : d.payments.map((p) => (
              <Row key={p.id}>
                <span className="ax-sub" style={{ width: 150 }}>{formatDateTime(p.createdAt)}</span>
                <span style={{ flex: 1 }}>{methodLabel(p.method)}</span>
                <StatusBadge label={p.status} />
                <span className="ax-data" style={{ width: 110, textAlign: "right" }}>{formatPaise(p.amount)}</span>
              </Row>
            ))}
          </section>
          <section className="ax-panel ax-detail-side">
            <span className="ax-label">Invoices</span>
            {d.invoices.length === 0 ? <p className="ax-note" style={{ marginTop: 0 }}>No invoices.</p> : d.invoices.map((inv) => (
              <Row key={inv.id} onClick={() => onOpen(`/invoices/${inv.id}`)}>
                <span className="ax-data" style={{ flex: 1 }}>{inv.invoiceNumber || "Draft"}</span>
                <StatusBadge label={inv.status} />
                <span className="ax-data">{formatPaise(inv.total)}</span>
              </Row>
            ))}
          </section>
        </div>
      )}

      {tab === "log" && (
        <section className="ax-panel">
          {log.length === 0 ? <p className="ax-note" style={{ margin: 0 }}>Nothing recorded for this profile yet.</p> : log.map((e) => (
            <Row key={e.id} log>
              <span className="ax-sub ax-vrow-when">{formatDateTime(e.at)}</span>
              <span className="ax-vrow-main"><strong>{e.title}</strong>{e.body ? <span className="ax-sub">{e.body}</span> : null}</span>
              <span className="ax-sub">{e.who}</span>
            </Row>
          ))}
        </section>
      )}
    </div>
  );
}
