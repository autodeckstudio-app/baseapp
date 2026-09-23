"use client";

import { useEffect, useState } from "react";
import type { MembershipPlan } from "@autodeck/core";
import { MembershipsView, type PlanDraft } from "../../../experience/MembershipsView";
import {
  getMembershipPlans,
  createMembershipPlan,
  updateMembershipPlan,
  setMembershipPlanActive,
} from "../../../lib/membership-service";

export default function MembershipPlansPage() {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const list = await getMembershipPlans();
      setPlans(list);
    } catch {
      setError("Couldn't load plans.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSave(d: PlanDraft) {
    setBusy(true);
    setError(null);
    setStatus(null);
    const priceInPaise = Math.round(Number(d.priceInRupees) * 100);
    const includedWashes = Number(d.includedWashes);
    const discountPercent = Number(d.discountPercent);
    try {
      if (d.planId) {
        await updateMembershipPlan({ planId: d.planId, name: d.name.trim(), priceInPaise, includedWashes, discountPercent });
        setStatus("Plan saved. Existing members keep the terms they bought.");
      } else {
        await createMembershipPlan({ tier: d.tier, name: d.name.trim(), priceInPaise, includedWashes, discountPercent });
        setStatus(`${d.name.trim()} is on sale.`);
      }
      await refresh();
    } catch {
      setError("Couldn't save the plan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(plan: MembershipPlan) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await setMembershipPlanActive(plan.id, !plan.active);
      setStatus(plan.active ? `${plan.name} is paused. Existing members are not affected.` : `${plan.name} is on sale again.`);
      await refresh();
    } catch {
      setError("Couldn't change the plan.");
    } finally {
      setBusy(false);
    }
  }

  return <MembershipsView plans={plans} loading={loading} error={error} message={status} busy={busy} onSave={(d) => void handleSave(d)} onToggle={(pl) => void handleToggleActive(pl)} />;
}
