import { useState, useEffect, useCallback } from "react";
import { View } from "react-native";
import type { MembershipUsage } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, Kicker, PageHeader, Loading, Notice, Pane, Row, Screen, rupees } from "../../../ui/kit";
import { useAuth } from "../../../hooks/useAuth";
import { listenToMyJobs } from "../../../lib/job-service";
import { listenToMyInvoices } from "../../../lib/invoice-service";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { visitAlso, visitServices, visitTitle } from "../../../lib/visit-services";
import type { Invoice, ServiceJob } from "@autodeck/core";
import { getMyMemberships, getMembershipUsage } from "../../../lib/membership-service";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function MembershipUsageScreen() {
  const auth = useAuth();
  const [usage, setUsage] = useState<MembershipUsage[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (auth.status !== "ready") return undefined;
    const noop = () => undefined;
    const a = listenToMyJobs(auth.claims.tenantId, auth.user.uid, setJobs, noop);
    const b = listenToMyInvoices(auth.claims.tenantId, auth.user.uid, setInvoices, noop);
    void getServiceCatalogue().then((all) => setNames(Object.fromEntries(all.map((x) => [x.id, x.name])))).catch(noop);
    return () => { a(); b(); };
  }, [auth.status]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const memberships = await getMyMemberships();
      const current = memberships.find((m) => m.status === "active" || m.status === "pending");
      if (!current) {
        setUsage([]);
        return;
      }
      setUsage(await getMembershipUsage(current.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load usage.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Opening usage" />;
  if (error) return <Screen><Notice title="Could not load usage" body={error} action={<Button label="Retry" onPress={()=>void load()}/>} /></Screen>;

  return (
    <Screen
      header={
        <PageHeader kicker="Membership" title={usage.length ? `${usage.length} ${usage.length === 1 ? "use" : "uses"} this cycle` : "No washes used yet"} />
      }
    >
      {usage.length === 0 ? (
        <Notice title="No usage yet" body="Book a wash or service to see it here." />
      ) : (
        <Pane pad="gap">
          {usage.map((u, i) => {
            const job = jobs.find((j) => j.id === u.jobId);
            const svc = job ? visitServices(job, invoices.find((x) => x.jobId === job.id), names) : [];
            return (
            <Row
              key={u.id}
              title={svc.length ? visitTitle(svc) : u.usageType === "wash" ? "Wash credit used" : "Discount applied"}
              detail={[u.usageType === "wash" ? "Wash credit" : "Discount", formatDate(u.usedAt), svc.length ? visitAlso(svc) : null].filter(Boolean).join(" · ")}
              trailing={rupees(u.valueRedeemed)}
              last={i === usage.length - 1}
            />
            );
          })}
        </Pane>
      )}
    </Screen>
  );
}
