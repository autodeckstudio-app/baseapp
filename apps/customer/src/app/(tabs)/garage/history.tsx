import { SceneIntro } from "../../../ui/SceneIntro";
// Permanent service history. Keyed by vehicleId only and built from the
// customer's own jobs and invoices, so it still works after the car document
// is deleted (the garage room returns "Vehicle not found" in that case).
// Contract assumed: jobs/invoices keep their vehicleId, tenantId and customerId.
import { visitAlso, visitServices, visitTitle } from "../../../lib/visit-services";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import type { Invoice, ServiceJob, Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { space } from "@autodeck/ui/theme";
import { Button, Kicker, LinkAction, Loading, Notice, Pane, Screen, T } from "../../../ui/kit";
import { HistoryVisitRow } from "../../../ui/HistoryVisitRow";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../hooks/useAuth";
import { listenToJobsForVehicle, listenToMyJobs } from "../../../lib/job-service";
import { listenToInvoicesForVehicle, listenToMyInvoices } from "../../../lib/invoice-service";
import { invoiceHref } from "../../../lib/invoice-display";
import { getServiceCatalogue } from "../../../lib/catalogue-service";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function ServiceHistoryScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const auth = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<ServiceJob[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [vehicle, setVehicle] = useState<{ make: string; model: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const owner=auth.status==='ready'&&auth.customerDocId?`${auth.claims.tenantId}:${auth.customerDocId}`:null;
  useEffect(() => {
    setJobs(null);setInvoices([]);setVehicle(null);
    if (auth.status !== "ready" || !auth.customerDocId) return undefined;
    setError(null);
    let alive=true;const fail = () => {if(alive)setError("Could not load service history. Check your connection and retry.");};
    const a = vehicleId ? listenToJobsForVehicle(vehicleId, auth.claims.tenantId, auth.customerDocId, v=>{if(alive)setJobs(v)}, fail):listenToMyJobs(auth.claims.tenantId,auth.customerDocId,v=>{if(alive)setJobs(v)},fail);
    const b = vehicleId ? listenToInvoicesForVehicle(vehicleId, auth.claims.tenantId, auth.customerDocId, v=>{if(alive)setInvoices(v)}, fail):listenToMyInvoices(auth.claims.tenantId,auth.customerDocId,v=>{if(alive)setInvoices(v)},fail);
    return () => { alive=false;a(); b(); };
  }, [vehicleId, owner, tick]);

  useEffect(() => {
    void getServiceCatalogue().then((all) => setNames(Object.fromEntries(all.map((s) => [s.id, s.name])))).catch(() => undefined);
  }, []);

  // Car label, best effort: live vehicle doc, else deletedVehicles/{id}
  // (owner-readable snapshot, backend contract), else "Removed car".
  useEffect(() => {
    setVehicle(null);if (!vehicleId||!owner) return;
    let alive = true;
    const pick = (d: unknown) => {
      const x = d as Partial<Vehicle> & { vehicleSnapshot?: { make?: string; model?: string }; snapshot?: { make?: string; model?: string } };
      const src = x.make ? x : (x.vehicleSnapshot ?? x.snapshot);
      return src?.make ? { make: src.make, model: src.model ?? "" } : null;
    };
    void getDoc(doc(db, COLLECTIONS.vehicles(), vehicleId))
      .then((s) => (s.exists() ? pick(s.data()) : null), () => null)
      .then(async (live) => {
        if (live) return live;
        return getDoc(doc(db, "deletedVehicles", vehicleId)).then((s) => (s.exists() ? pick(s.data()) : null), () => null);
      })
      .then((v) => { if (alive) setVehicle(v); });
    return () => { alive = false; };
  }, [vehicleId,owner]);

  if (error) return <Screen><Notice title="History unavailable" body={error} action={<Button label="Retry" onPress={() => setTick((n) => n + 1)} />} /></Screen>;
  if (auth.status !== "ready" || jobs === null) return <Loading label="Opening service history" />;

  return (
    <Screen header={<View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.hair }}><View style={{ gap: space.hair, flex: 1, minWidth: 0 }}><SceneIntro compact eyebrow="Service history" title={!vehicleId?"All your visits":vehicle ? `${vehicle.make} ${vehicle.model}` : "Removed car"}/></View><T role="caption" tone="secondary">{jobs.length === 1 ? "1 visit" : `${jobs.length} visits`}</T></View>}>
      {jobs.length === 0 ? (
        <Notice title="No service history" body="No visits are on record for this car." />
      ) : (
        <Pane pad="gap">
          {jobs.map((job, i) => {
            const invoice = invoices.find((x) => x.jobId === job.id);
            const svc = visitServices(job, invoice, names);
            const also = visitAlso(svc);
            return (
              <HistoryVisitRow
                key={job.id}
                at={job.sealedAt ?? job.createdAt}
                title={visitTitle(svc)}
                caption={[fmt(job.sealedAt ?? job.createdAt),also,!vehicleId?((job as unknown as {vehicleSnapshot?:{make:string;model:string;registrationNumber:string}}).vehicleSnapshot?.registrationNumber??"Recorded visit"):null].filter(Boolean).join(" · ")}
                status={job.status}
                first={i === 0}
                onPress={job.bookingId ? () => router.push(`/(tabs)/bookings/${job.bookingId}`) : undefined}
                extra={invoice ? <LinkAction label={`View invoice ${invoice.invoiceNumber}`} testID={`history-invoice-${invoice.id}`} onPress={() => router.push(invoiceHref(invoice.id))} /> : null}
              />
            );
          })}
        </Pane>
      )}
      {invoices.filter(inv=>!jobs.some(j=>j.id===inv.jobId)).map(inv=><Pane key={inv.id} pad="inset"><T role="heading">Invoice {inv.invoiceNumber}</T><T role="caption" tone="secondary">{inv.vehicleSnapshot?.registrationNumber??"Recorded visit"}</T><LinkAction label="View invoice" onPress={()=>router.push(invoiceHref(inv.id))}/></Pane>)}
      <Button label="Back to garage" kind="quiet" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/garage"))} />
    </Screen>
  );
}
