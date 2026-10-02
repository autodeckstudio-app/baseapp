"use client";

// Inventory: consumables and materials with live stock. Every quantity
// change is a recorded movement - staff log usage/purchases, Office can
// true-up with an adjustment.
import { useState } from "react";
import type { InventoryCategory, InventoryItem, InventoryTxn, InventoryTxnType, InventoryUnit } from "@autodeck/core";
import { PageHead } from "./Office";
import { formatDateTime, formatPaise } from "../lib/format";

const CATEGORY_NAME: Record<InventoryCategory, string> = {
  PPF_FILM: "PPF film",
  CERAMIC: "Ceramic",
  WASH: "Wash",
  INTERIOR: "Interior",
  OTHER: "Other",
};

const UNIT_NAME: Record<InventoryUnit, string> = { ML: "ml", FT: "ft", PCS: "pcs", GM: "gm" };

const TXN_NAME: Record<InventoryTxnType, string> = {
  PURCHASE: "Purchase",
  USAGE: "Usage",
  ADJUSTMENT: "Adjustment",
  WASTAGE: "Wastage",
};

export function InventoryView(p: {
  items: InventoryItem[];
  selected: InventoryItem | null;
  txns: InventoryTxn[];
  isAdmin: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  onSelect: (item: InventoryItem | null) => void;
  onAdd: (input: { name: string; category: InventoryCategory; unit: InventoryUnit; stockQty: number; lowStockThreshold: number; costPerUnitPaise: number }) => void;
  onTxn: (item: InventoryItem, type: InventoryTxnType, qtyDelta: number, notes: string) => void;
  onDeactivate: (item: InventoryItem) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("WASH");
  const [unit, setUnit] = useState<InventoryUnit>("ML");
  const [opening, setOpening] = useState("");
  const [threshold, setThreshold] = useState("");
  const [cost, setCost] = useState("");
  const [txnType, setTxnType] = useState<InventoryTxnType>("USAGE");
  const [txnQty, setTxnQty] = useState("");
  const [txnNotes, setTxnNotes] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const lowStock = p.items.filter((i) => i.stockQty <= i.lowStockThreshold);
  const qty = Number(txnQty);
  const qtyOk = Number.isFinite(qty) && qty > 0;

  if (p.selected) {
    const item = p.selected;
    return (
      <div className="ax-page">
        <PageHead eyebrow="Office · Inventory" title={item.name} />
        {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
        {p.message && <p className="ax-status-msg">{p.message}</p>}
        <div className="ax-detail">
          <div className="ax-detail-main">
            <section className="ax-panel">
              <span className="ax-label">Movement log</span>
              {p.txns.length === 0 ? (
                <p className="ax-note">No movements recorded yet.</p>
              ) : (
                <ul className="ax-list">
                  {p.txns.map((t) => (
                    <li key={t.id} className="ax-list-row">
                      <span className="ax-slot-main">
                        <span className="ax-person-name">{TXN_NAME[t.type]}</span>
                        <span className="ax-sub">{formatDateTime(t.createdAt)}{t.notes ? ` · ${t.notes}` : ""}</span>
                      </span>
                      <span className={`ax-slot-amt ${t.qtyDelta < 0 ? "ax-danger" : "ax-success"}`}>
                        {t.qtyDelta > 0 ? "+" : ""}{t.qtyDelta} {UNIT_NAME[item.unit]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <div className="ax-detail-side">
            <section className="ax-panel">
              <span className="ax-label">
                On hand · <strong className="ax-data">{item.stockQty} {UNIT_NAME[item.unit]}</strong>
              </span>
              <div className="ax-form-section">
                <div className="ax-form-pair">
                  <select value={txnType} onChange={(e) => setTxnType(e.target.value as InventoryTxnType)} aria-label="Movement type" disabled={p.busy}>
                    <option value="USAGE">Usage (stock out)</option>
                    <option value="PURCHASE">Purchase (stock in)</option>
                    <option value="WASTAGE">Wastage (stock out)</option>
                    {p.isAdmin && <option value="ADJUSTMENT">Adjustment (Office)</option>}
                  </select>
                  <input value={txnQty} onChange={(e) => setTxnQty(e.target.value)} placeholder={`Qty (${UNIT_NAME[item.unit]})`} inputMode="decimal" aria-label="Quantity" disabled={p.busy} />
                </div>
                <input value={txnNotes} onChange={(e) => setTxnNotes(e.target.value)} placeholder="Note (optional)" aria-label="Note" disabled={p.busy} />
                <button
                  type="button"
                  className="ax-button ax-button--primary"
                  disabled={p.busy || !qtyOk}
                  onClick={() => {
                    const delta = txnType === "PURCHASE" ? qty : txnType === "ADJUSTMENT" ? qty : -qty;
                    p.onTxn(item, txnType, delta, txnNotes.trim());
                    setTxnQty(""); setTxnNotes("");
                  }}
                >
                  Record movement
                </button>
                <p className="ax-note">Stock can't go below zero. Use Adjustment after a physical count.</p>
              </div>
            </section>
            <div className="ax-panel-actions">
              <button type="button" className="ax-button" onClick={() => p.onSelect(null)}>Back to all items</button>
              {p.isAdmin && (
                confirmId === item.id ? (
                  <button type="button" className="ax-button ax-button--danger" disabled={p.busy} onClick={() => { p.onDeactivate(item); setConfirmId(null); }}>
                    Deactivate item
                  </button>
                ) : (
                  <button type="button" className="ax-button" onClick={() => setConfirmId(item.id)}>Deactivate</button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ax-page">
      <PageHead
        eyebrow="Office"
        title="Inventory"
        kpis={[
          { value: p.items.length, label: "Items" },
          { value: lowStock.length, label: "Low stock", tone: lowStock.length > 0 ? "accent" : undefined },
        ]}
      />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      <div className="ax-detail">
        <div className="ax-detail-main">
          <section className="ax-panel">
            <span className="ax-label">Stock on hand</span>
            {p.loading ? (
              [0, 1, 2].map((i) => <div key={i} className="ax-skel ax-skel--row" />)
            ) : p.items.length === 0 ? (
              <p className="ax-note">No items yet. Add the first one from the form.</p>
            ) : (
              <ul className="ax-list">
                {p.items.map((item) => {
                  const low = item.stockQty <= item.lowStockThreshold;
                  return (
                    <li key={item.id} className="ax-list-row">
                      <button type="button" className="ax-slot-main" onClick={() => p.onSelect(item)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer" }}>
                        <span className="ax-person-name">{item.name}</span>
                        <span className="ax-sub">{CATEGORY_NAME[item.category]} · cost {formatPaise(item.costPerUnit)}/{UNIT_NAME[item.unit]}</span>
                      </button>
                      <span className={`ax-expiry ${low ? "ax-expiry--danger" : "ax-expiry--ok"}`}>
                        {item.stockQty} {UNIT_NAME[item.unit]}{low ? " · low" : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {p.isAdmin && (
          <div className="ax-detail-side">
            <section className="ax-panel">
              <span className="ax-label">Add item</span>
              <div className="ax-form-section">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" aria-label="Item name" disabled={p.busy} />
                <div className="ax-form-pair">
                  <select value={category} onChange={(e) => setCategory(e.target.value as InventoryCategory)} aria-label="Category" disabled={p.busy}>
                    {(Object.keys(CATEGORY_NAME) as InventoryCategory[]).map((c) => (
                      <option key={c} value={c}>{CATEGORY_NAME[c]}</option>
                    ))}
                  </select>
                  <select value={unit} onChange={(e) => setUnit(e.target.value as InventoryUnit)} aria-label="Unit" disabled={p.busy}>
                    {(Object.keys(UNIT_NAME) as InventoryUnit[]).map((u) => (
                      <option key={u} value={u}>{UNIT_NAME[u]}</option>
                    ))}
                  </select>
                </div>
                <div className="ax-form-pair">
                  <input value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="Opening qty" inputMode="decimal" aria-label="Opening quantity" disabled={p.busy} />
                  <input value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="Low-stock at" inputMode="decimal" aria-label="Low stock threshold" disabled={p.busy} />
                </div>
                <input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Cost per unit ₹ (optional)" inputMode="decimal" aria-label="Cost per unit" disabled={p.busy} />
                <button
                  type="button"
                  className="ax-button ax-button--primary"
                  disabled={p.busy || !name.trim()}
                  onClick={() => {
                    p.onAdd({
                      name: name.trim(),
                      category,
                      unit,
                      stockQty: Number(opening) || 0,
                      lowStockThreshold: Number(threshold) || 0,
                      costPerUnitPaise: Math.round((Number(cost) || 0) * 100),
                    });
                    setName(""); setOpening(""); setThreshold(""); setCost("");
                  }}
                >
                  Add item
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
