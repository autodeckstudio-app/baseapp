import { useState, useEffect, useCallback, useRef } from "react";
import { listOwnerKey } from "../../../lib/owner-key";
import { View } from "react-native";
import { useRouter } from "expo-router";
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
  const router = useRouter();
  const auth = useAuth();
  const ownerKey=listOwnerKey(auth);
  const owner=auth.status==='ready'&&ownerKey?`${auth.claims.tenantId}:${auth.user.uid}:${ownerKey.key}`:null;const currentOwner=useRef(owner);currentOwner.current=owner;const generation=useRef(0);
  const [usage, setUsage] = useState<MembershipUsage[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    setJobs([]);setInvoices([]);setNames({});if (auth.status !== "ready" || !ownerKey) return undefined;let alive=true;
    const noop = () => undefined;
    const a = listenToMyJobs(auth.claims.tenantId, ownerKey.key, rows=>{if(alive)setJobs(rows)}, noop);
    const b = listenToMyInvoices(auth.claims.tenantId, ownerKey.key, rows=>{if(alive)setInvoices(rows)}, noop);
    void getServiceCatalogue().then((all) => alive&&setNames(Object.fromEntries(all.map((x) => [x.id, x.name])))).catch(noop);
    return () => {alive=false; a(); b(); };
  }, [owner]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const gen=++generation.current;setUsage([]);if(!owner){setLoading(false);setError("Sign in to see your membership usage.");return;}setLoading(true);
    setError(null);
    try {
      const memberships = await getMyMemberships();if(gen!==generation.current||currentOwner.current!==owner)return;
      const current = memberships.find((m) => m.status === "active");
      if (!current) {
        setUsage([]);
        return;
      }
      const rows=await getMembershipUsage(current.id);if(gen===generation.current&&currentOwner.current===owner)setUsage(rows);
    } catch (err) {
      if(gen===generation.current&&currentOwner.current===owner)setError("Your membership usage could not load. Try again.");
    } finally {
      if(gen===generation.current&&currentOwner.current===owner)setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    void load();return()=>{generation.current++};
  }, [load]);

  if (loading) return <Loading label="Opening usage" />;
  if (error) return <Screen><Notice title="Could not load usage" body={error} action={<Button label="Retry" onPress={()=>void load()}/>} /></Screen>;

  return (
    <Screen
      header={
        <PageHeader kicker="Membership" title={usage.length ? `${usage.length} ${usage.length === 1 ? "use" : "uses"} this cycle` : "No usage recorded"} />
      }
    >
      {usage.length === 0 ? (
        <Notice title="No usage yet" body="Recorded use of an active plan appears here. A pending plan does not provide benefits yet." />
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
      <Button label="Plan history" kind="quiet" onPress={() => router.push("/(tabs)/membership/history")} />
    </Screen>
  );
}
