"use client";

// Membership plans as the customer will see them: one glass card per tier,
// with price, included washes and member discount. Edits never change
// memberships already sold; their terms are fixed at purchase.
import { useState } from "react";
import type { MembershipPlan, MembershipTier } from "@autodeck/core";
import { PageHead } from "./Office";
import { formatPaise } from "../lib/format";

const TIER_NAME: Record<MembershipTier, string> = { silver: "Silver", gold: "Gold", platinum: "Platinum" };
const TIERS = Object.keys(TIER_NAME) as MembershipTier[];

export interface PlanDraft {
  planId: string | null;
  tier: MembershipTier;
  name: string;
  priceInRupees: string;
  includedWashes: string;
  discountPercent: string;
}
const EMPTY: PlanDraft = { planId: null, tier: "silver", name: "", priceInRupees: "", includedWashes: "", discountPercent: "" };

// Returns a problem to show, or null when the draft can be saved.
export function planProblem(d: PlanDraft): string | null {
  if (!d.name.trim()) return "Give the plan a name.";
  const price = Number(d.priceInRupees);
  if (!Number.isFinite(price) || price <= 0) return "Price must be more than ₹0.";
  const washes = Number(d.includedWashes);
  if (!Number.isInteger(washes) || washes < 0) return "Washes must be a whole number.";
  const disc = Number(d.discountPercent);
  if (!Number.isFinite(disc) || disc < 0 || disc > 100) return "Discount must be between 0 and 100%.";
  return null;
}

export function MembershipsView(p: {
  plans: MembershipPlan[];
  loading: boolean;
  error: string | null;
  message: string | null;
  busy: boolean;
  onSave: (d: PlanDraft) => void;
  onToggle: (plan: MembershipPlan) => void;
}) {
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const active = p.plans.filter((x) => x.active);
  const problem = draft ? planProblem(draft) : null;
  const sorted = [...p.plans].sort((a, b) => Number(b.active) - Number(a.active) || TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.priceInPaise - b.priceInPaise);

  return (
    <div className="ax-page">
      <PageHead eyebrow="Office" title="Memberships" kpis={[{ value: active.length, label: "Plans on sale", tone: "premium" }, { value: p.plans.length - active.length, label: "Paused" }]}>
        <button type="button" className="ax-button ax-button--primary" onClick={() => setDraft(EMPTY)}>New plan</button>
      </PageHead>
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      <div className={draft ? "ax-detail" : undefined}>
        <div className="ax-detail-main">
          {p.loading ? (
            <div className="ax-plans">{[0, 1, 2].map((i) => <div key={i} className="ax-skel" style={{ height: 220 }} />)}</div>
          ) : sorted.length === 0 ? (
            <div className="ax-panel ax-empty">
              <p className="ax-title">No plans yet</p>
              <p>Create a Silver, Gold or Platinum plan so customers can subscribe from the app.</p>
            </div>
          ) : (
            <div className="ax-plans">
              {sorted.map((plan) => (
                <article key={plan.id} className={`ax-plan ax-plan--${plan.tier}${plan.active ? "" : " is-paused"}`}>
                  <div className="ax-plan-top">
                    <span className="ax-label">{TIER_NAME[plan.tier]}</span>
                    {!plan.active && <span className="ax-chip">Paused</span>}
                  </div>
                  <h3 className="ax-plan-name">{plan.name}</h3>
                  <p className="ax-plan-price">{formatPaise(plan.priceInPaise)}<span> / month</span></p>
                  <ul className="ax-plan-perks">
                    <li>{plan.includedWashes} wash{plan.includedWashes === 1 ? "" : "es"} included each month</li>
                    <li>{plan.discountPercent}% off other services</li>
                  </ul>
                  <div className="ax-panel-actions">
                    <button type="button" className="ax-button" onClick={() => setDraft({ planId: plan.id, tier: plan.tier, name: plan.name, priceInRupees: String(plan.priceInPaise / 100), includedWashes: String(plan.includedWashes), discountPercent: String(plan.discountPercent) })}>Edit</button>
                    {confirmId === plan.id ? (
                      <>
                        <button type="button" className={`ax-button${plan.active ? " ax-button--danger" : ""}`} disabled={p.busy} onClick={() => { p.onToggle(plan); setConfirmId(null); }}>{plan.active ? "Stop selling" : "Start selling"}</button>
                        <button type="button" className="ax-button" onClick={() => setConfirmId(null)}>Cancel</button>
                      </>
                    ) : (
                      <button type="button" className="ax-button" onClick={() => setConfirmId(plan.id)}>{plan.active ? "Pause" : "Resume"}</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {draft && (
          <aside className="ax-detail-side">
            <form className="ax-panel" onSubmit={(e) => { e.preventDefault(); if (!problem) { p.onSave(draft); setDraft(null); } }}>
              <span className="ax-label">{draft.planId ? "Edit plan" : "New plan"}</span>
              <div className="ax-form-row">
                <span>Tier</span>
                <div className="ax-seg" role="group">
                  {TIERS.map((t) => (
                    <button key={t} type="button" aria-pressed={draft.tier === t} disabled={!!draft.planId} onClick={() => setDraft({ ...draft, tier: t })}>{TIER_NAME[t]}</button>
                  ))}
                </div>
              </div>
              <label className="ax-form-row"><span>Name customers see</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Gold Shine" /></label>
              <label className="ax-form-row"><span>Price per month (₹)</span><input inputMode="decimal" value={draft.priceInRupees} onChange={(e) => setDraft({ ...draft, priceInRupees: e.target.value })} placeholder="1499" /></label>
              <div className="ax-form-pair">
                <label className="ax-form-row"><span>Washes / month</span><input inputMode="numeric" value={draft.includedWashes} onChange={(e) => setDraft({ ...draft, includedWashes: e.target.value })} placeholder="4" /></label>
                <label className="ax-form-row"><span>Discount (%)</span><input inputMode="decimal" value={draft.discountPercent} onChange={(e) => setDraft({ ...draft, discountPercent: e.target.value })} placeholder="10" /></label>
              </div>
              {problem && draft.name && <p className="ax-note" style={{ color: "var(--ad-warning)" }}>{problem}</p>}
              <div className="ax-panel-actions">
                <button type="submit" className="ax-button ax-button--primary" disabled={p.busy || !!problem}>{draft.planId ? "Save changes" : "Create plan"}</button>
                <button type="button" className="ax-button" onClick={() => setDraft(null)}>Cancel</button>
              </div>
              <p className="ax-note">Members who already bought a plan keep the terms they paid for.</p>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}
