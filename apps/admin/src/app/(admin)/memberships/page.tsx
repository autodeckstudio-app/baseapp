"use client";

import { useEffect, useState } from "react";
import type { MembershipPlan, MembershipTier } from "@autodeck/core";
import {
  getMembershipPlans,
  createMembershipPlan,
  updateMembershipPlan,
  setMembershipPlanActive,
} from "../../../lib/membership-service";

const TIERS: MembershipTier[] = ["silver", "gold", "platinum"];

const emptyForm = {
  planId: null as string | null,
  tier: "silver" as MembershipTier,
  name: "",
  priceInRupees: 0,
  includedWashes: 0,
  discountPercent: 0,
};

export default function MembershipPlansPage() {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function refresh() {
    setLoading(true);
    try {
      const list = await getMembershipPlans();
      setPlans(list);
    } catch {
      setError("Failed to load membership plans.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function loadIntoForm(p: MembershipPlan) {
    setForm({
      planId: p.id,
      tier: p.tier,
      name: p.name,
      priceInRupees: p.priceInPaise / 100,
      includedWashes: p.includedWashes,
      discountPercent: p.discountPercent,
    });
  }

  async function handleSave() {
    setError(null);
    setStatus(null);
    try {
      if (form.planId) {
        await updateMembershipPlan({
          planId: form.planId,
          name: form.name,
          priceInPaise: Math.round(form.priceInRupees * 100),
          includedWashes: form.includedWashes,
          discountPercent: form.discountPercent,
        });
        setStatus("Plan updated. Already-purchased memberships are unaffected — their terms were snapshotted at purchase time.");
      } else {
        await createMembershipPlan({
          tier: form.tier,
          name: form.name,
          priceInPaise: Math.round(form.priceInRupees * 100),
          includedWashes: form.includedWashes,
          discountPercent: form.discountPercent,
        });
        setStatus("Plan created.");
      }
      setForm(emptyForm);
      await refresh();
    } catch {
      setError("Failed to save plan.");
    }
  }

  async function handleToggleActive(p: MembershipPlan) {
    const verb = p.active ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${verb} "${p.name}"?`)) return;
    setError(null);
    try {
      await setMembershipPlanActive(p.id, !p.active);
      await refresh();
    } catch {
      setError(`Failed to ${verb} plan.`);
    }
  }

  return (
    <div>
      <h1>Membership Plans</h1>
      <p style={{ fontSize: 13, color: "#555" }}>
        Changes to price, washes, or discount do NOT affect already-purchased memberships —
        those terms were snapshotted at purchase time and are immutable once activated.
      </p>
      {error && <p className="error">{error}</p>}
      {status && <p>{status}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tier</th>
              <th>Name</th>
              <th>Price</th>
              <th>Washes</th>
              <th>Discount</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>{p.tier}</td>
                <td>{p.name}</td>
                <td>₹{(p.priceInPaise / 100).toFixed(2)}</td>
                <td>{p.includedWashes}</td>
                <td>{p.discountPercent}%</td>
                <td>{p.active ? "Yes" : "No"}</td>
                <td>
                  <button onClick={() => loadIntoForm(p)}>Edit</button>{" "}
                  <button onClick={() => void handleToggleActive(p)}>
                    {p.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>{form.planId ? "Edit plan" : "New plan"}</h2>
      <fieldset>
        <label>
          Tier
          <br />
          <select
            value={form.tier}
            disabled={!!form.planId}
            onChange={(e) => setForm({ ...form, tier: e.target.value as MembershipTier })}
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <label>
          Name
          <br />
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
      </fieldset>
      <fieldset>
        <label>
          Price (₹ / month)
          <br />
          <input
            type="number"
            value={form.priceInRupees}
            onChange={(e) => setForm({ ...form, priceInRupees: Number(e.target.value) })}
          />
        </label>
      </fieldset>
      <fieldset>
        <label>
          Included washes / month
          <br />
          <input
            type="number"
            value={form.includedWashes}
            onChange={(e) => setForm({ ...form, includedWashes: Number(e.target.value) })}
          />
        </label>
      </fieldset>
      <fieldset>
        <label>
          Discount on other services (%)
          <br />
          <input
            type="number"
            value={form.discountPercent}
            onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
          />
        </label>
      </fieldset>

      <button onClick={() => void handleSave()}>{form.planId ? "Save changes" : "Create plan"}</button>{" "}
      {form.planId && <button onClick={() => setForm(emptyForm)}>Cancel edit</button>}
    </div>
  );
}
