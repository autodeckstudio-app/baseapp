"use client";
import { Icon } from "./Icon";
import type { IconName } from "@autodeck/ui/theme";

// Services and pricing: the menu customers book from. Grouped by kind, each
// row shows starting price, time and warranty; the editor opens in a drawer.
import { useState } from "react";
import type { BayType, Service, ServiceCategory, VehicleCategory, WarrantyDurationUnit } from "@autodeck/core";
import { PageHead, Toolbar, Segmented, Drawer } from "./Office";
import { formatPaise } from "../lib/format";
import { EMPTY_SERVICE, draftFromService, toServicePayload, type ServiceDraft, type ServicePayload } from "./services-draft";

export const CATEGORY_NAME: Record<ServiceCategory, string> = { washing: "Wash", ceramic: "Ceramic", ppf: "PPF", coating: "Coating", tinting: "Tint", inspection: "Inspection", other: "Other" };
const CATEGORY_ICON: Record<ServiceCategory, IconName> = { washing: "wash", ceramic: "ceramic", ppf: "ppf", coating: "coating", tinting: "tint", inspection: "inspect", other: "tools" };
const CATEGORIES = Object.keys(CATEGORY_NAME) as ServiceCategory[];
const SIZE_NAME: Record<VehicleCategory, string> = { hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", luxury: "Luxury", commercial: "Commercial", van: "Van" };
const SIZES = Object.keys(SIZE_NAME) as VehicleCategory[];
const BAY_NAME: Record<BayType, string> = { wash: "Wash bay", protection: "Protection bay", general: "Any bay" };
const UNIT_NAME: Record<WarrantyDurationUnit, string> = { days: "Days", months: "Months", years: "Years", lifetime: "Lifetime" };

export function duration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function warranty(s: Service): string | null {
  if (!s.warrantyLabel) return null;
  if (s.warrantyDurationUnit === "lifetime") return `${s.warrantyLabel} · lifetime`;
  if (s.warrantyDurationUnit && s.warrantyDurationValue) return `${s.warrantyLabel} · ${s.warrantyDurationValue} ${s.warrantyDurationUnit}`;
  return s.warrantyLabel;
}

export function ServicesView(p: {
  services: Service[];
  loading: boolean;
  error: string | null;
  message: string | null;
  busy: boolean;
  onSave: (serviceId: string | null, payload: ServicePayload) => void;
  onToggle: (s: Service) => void;
}) {
  const [cat, setCat] = useState<ServiceCategory | "">("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<ServiceDraft | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const q = search.trim().toLowerCase();
  const rows = p.services.filter((s) => (!cat || s.category === cat) && (!q || s.name.toLowerCase().includes(q) || (s.brand ?? "").toLowerCase().includes(q)));
  const present = CATEGORIES.filter((c) => p.services.some((s) => s.category === c));
  const groups = present.filter((c) => rows.some((s) => s.category === c));
  const result = draft ? toServicePayload(draft) : null;
  const set = (patch: Partial<ServiceDraft>) => draft && setDraft({ ...draft, ...patch });

  return (
    <div className="ax-page">
      <PageHead eyebrow="Office" title="Services and pricing" kpis={[{ value: p.services.filter((s) => s.active).length, label: "On the menu", tone: "premium" }, { value: p.services.filter((s) => !s.active).length, label: "Hidden" }]}>
        <button type="button" className="ax-button ax-button--primary" onClick={() => setDraft(EMPTY_SERVICE)}>New service</button>
      </PageHead>
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}
      <Toolbar count={{ shown: rows.length, total: p.services.length }}>
        <Segmented value={cat} onChange={setCat} options={[{ value: "", label: "All" }, ...present.map((c) => ({ value: c, label: CATEGORY_NAME[c] }))]} />
        <input className="ax-search" type="search" placeholder="Search services" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Toolbar>

      {p.loading ? (
        <div className="ax-list">{[0, 1, 2, 3].map((i) => <div key={i} className="ax-skel ax-skel--row" />)}</div>
      ) : rows.length === 0 ? (
        <div className="ax-panel ax-empty">
          <p className="ax-title">{p.services.length ? "Nothing matches" : "Your menu is empty"}</p>
          <p>{p.services.length ? "Try another kind or search." : "Add your first service so customers can book it."}</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g} className="ax-svc-group">
            <p className="ax-label"><Icon name={CATEGORY_ICON[g]} size={14} /> {CATEGORY_NAME[g]} · {rows.filter((s) => s.category === g).length}</p>
            <div className="ax-list">
              {rows.filter((s) => s.category === g).map((s) => (
                <div key={s.id} className={`ax-svc${s.active ? "" : " is-hidden"}`}>
                  <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(242,122,26,0.12)", flex: "none" }}><Icon name={CATEGORY_ICON[s.category]} size={18} /></span>
                  <div className="ax-svc-main">
                    <span className="ax-person-name">{s.name}{s.brand ? <span className="ax-sub" style={{ display: "inline" }}> · {s.brand}</span> : null}</span>
                    <span className="ax-sub">
                      {duration(s.estimatedDurationMinutes)} · {BAY_NAME[s.requiredBayType]}
                      {warranty(s) ? ` · ${warranty(s)}` : ""}
                      {s.membershipWashEligible ? " · counts as a member wash" : ""}
                    </span>
                  </div>
                  <div className="ax-svc-price">
                    <span className="ax-sub">from</span>
                    <span className="ax-data">{formatPaise(s.basePrice)}</span>
                    {s.vehicleCategoryPricing.length > 0 && <span className="ax-sub">{s.vehicleCategoryPricing.length} size rule{s.vehicleCategoryPricing.length === 1 ? "" : "s"}</span>}
                  </div>
                  <span className="ax-row-actions">
                    {!s.active && <span className="ax-chip">Hidden</span>}
                    <button type="button" className="ax-button" onClick={() => setDraft(draftFromService(s))}>Edit</button>
                    {confirmId === s.id ? (
                      <>
                        <button type="button" className={`ax-button${s.active ? " ax-button--danger" : ""}`} disabled={p.busy} onClick={() => { p.onToggle(s); setConfirmId(null); }}>{s.active ? "Hide from menu" : "Show on menu"}</button>
                        <button type="button" className="ax-button" onClick={() => setConfirmId(null)}>Cancel</button>
                      </>
                    ) : (
                      <button type="button" className="ax-button" onClick={() => setConfirmId(s.id)}>{s.active ? "Hide" : "Show"}</button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {draft && (
        <Drawer eyebrow={draft.serviceId ? "Edit service" : "New service"} title={draft.name || "Untitled service"} onClose={() => setDraft(null)}>
          <form onSubmit={(e) => { e.preventDefault(); if (result?.ok) { p.onSave(draft.serviceId, result.payload); setDraft(null); } }}>
            <label className="ax-form-row"><span>Name customers see</span><input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ceramic coat" /></label>
            <div className="ax-form-pair">
              <label className="ax-form-row"><span>Kind</span>
                <select value={draft.category} onChange={(e) => set({ category: e.target.value as ServiceCategory })}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_NAME[c]}</option>)}</select>
              </label>
              <label className="ax-form-row"><span>Brand (optional)</span><input value={draft.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="e.g. Gyeon" /></label>
            </div>
            <label className="ax-form-row"><span>Description (shown to customers)</span><textarea rows={3} value={draft.description} onChange={(e) => set({ description: e.target.value })} /></label>
            {draft.internalNotes ? <label className="ax-form-row"><span>Internal notes (admin only, customers never see this)</span><textarea rows={3} value={draft.internalNotes} readOnly /></label> : null}

            <p className="ax-label ax-form-section">Price and time</p>
            <div className="ax-form-pair">
              <label className="ax-form-row"><span>Starting price (₹)</span><input inputMode="decimal" value={draft.priceRupees} onChange={(e) => set({ priceRupees: e.target.value })} placeholder="1299" /></label>
              <label className="ax-form-row"><span>Time needed (min)</span><input inputMode="numeric" value={draft.minutes} onChange={(e) => set({ minutes: e.target.value })} /></label>
            </div>
            <p className="ax-note">Bigger cars can cost more and take longer. Add a rule per size; smaller cars pay the starting price.</p>
            {draft.sizes.length > 0 && <div className="ax-size-rule ax-size-head"><span>Car size</span><span>Extra ₹</span><span>Extra min</span><span /></div>}
            {draft.sizes.map((r, i) => (
              <div key={i} className="ax-size-rule">
                <select value={r.vehicleCategory} aria-label="Car size" onChange={(e) => set({ sizes: draft.sizes.map((x, j) => (j === i ? { ...x, vehicleCategory: e.target.value as VehicleCategory } : x)) })}>
                  {SIZES.map((z) => <option key={z} value={z}>{SIZE_NAME[z]}</option>)}
                </select>
                <input inputMode="decimal" aria-label="Extra price in rupees" placeholder="+₹" value={r.extraRupees} onChange={(e) => set({ sizes: draft.sizes.map((x, j) => (j === i ? { ...x, extraRupees: e.target.value } : x)) })} />
                <input inputMode="numeric" aria-label="Extra minutes" placeholder="+min" value={r.extraMinutes} onChange={(e) => set({ sizes: draft.sizes.map((x, j) => (j === i ? { ...x, extraMinutes: e.target.value } : x)) })} />
                <button type="button" className="ax-button" aria-label="Remove rule" onClick={() => set({ sizes: draft.sizes.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button type="button" className="ax-button" onClick={() => set({ sizes: [...draft.sizes, { vehicleCategory: SIZES.find((z) => !draft.sizes.some((x) => x.vehicleCategory === z)) ?? "suv", extraRupees: "", extraMinutes: "" }] })}>Add a size rule</button>

            <p className="ax-label ax-form-section">Warranty</p>
            <label className="ax-form-row"><span>What it&apos;s called</span><input value={draft.warrantyLabel} onChange={(e) => set({ warrantyLabel: e.target.value })} placeholder="e.g. 5-year film warranty" /></label>
            <div className="ax-form-pair">
              <label className="ax-form-row"><span>Length</span>
                <select value={draft.warrantyUnit} onChange={(e) => { const u = e.target.value as WarrantyDurationUnit | ""; set({ warrantyUnit: u, warrantyValue: u === "lifetime" || u === "" ? "" : draft.warrantyValue }); }}>
                  <option value="">No warranty</option>
                  {(Object.keys(UNIT_NAME) as WarrantyDurationUnit[]).map((u) => <option key={u} value={u}>{UNIT_NAME[u]}</option>)}
                </select>
              </label>
              <label className="ax-form-row"><span>How many</span><input inputMode="numeric" value={draft.warrantyValue} disabled={!draft.warrantyUnit || draft.warrantyUnit === "lifetime"} onChange={(e) => set({ warrantyValue: e.target.value })} placeholder="5" /></label>
            </div>

            <p className="ax-label ax-form-section">Booking</p>
            <div className="ax-form-pair">
              <label className="ax-form-row"><span>Needs</span>
                <select value={draft.bay} onChange={(e) => set({ bay: e.target.value as BayType })}>{(Object.keys(BAY_NAME) as BayType[]).map((b) => <option key={b} value={b}>{BAY_NAME[b]}</option>)}</select>
              </label>
              <label className="ax-form-row"><span>Menu position</span><input inputMode="numeric" value={draft.displayOrder} onChange={(e) => set({ displayOrder: e.target.value })} /></label>
            </div>
            <label className="ax-check"><input type="checkbox" checked={draft.washEligible} onChange={(e) => set({ washEligible: e.target.checked })} /> Members can use an included wash for this</label>

            {result && !result.ok && draft.name && <p className="ax-note" style={{ color: "var(--ad-warning)" }}>{result.problem}</p>}
            <div className="ax-panel-actions">
              <button type="submit" className="ax-button ax-button--primary" disabled={p.busy || !result?.ok}>{draft.serviceId ? "Save changes" : "Add to menu"}</button>
              <button type="button" className="ax-button" onClick={() => setDraft(null)}>Cancel</button>
            </div>
            <p className="ax-note">Past bookings, invoices and issued warranties keep the terms they were sold with.</p>
          </form>
        </Drawer>
      )}
    </div>
  );
}
