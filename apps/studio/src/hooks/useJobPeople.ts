import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import type { ServiceJob } from "@autodeck/core";
import { db } from "../lib/firebase";
import { jobCar, type VehicleLite } from "../lib/job-people";

/** Only the mounted feed's records are watched. No process-wide cache crosses accounts. */
export function useJobPeople(jobs: ServiceJob[], owner: string | null, tenantId: string | null) {
  const [source, setSource] = useState<{scope:string;vehicles:Record<string,VehicleLite>;customers:Record<string,string>} | null>(null);
  const ids = JSON.stringify([...new Set(jobs.filter(j=>j.tenantId===tenantId).map(j=>`${j.vehicleId}|${j.customerId}`))].sort());
  const scope = `${owner}:${ids}`;
  const current = useRef(scope); current.current=scope;
  useEffect(()=>{
    setSource(null);
    if(!owner||!tenantId)return;
    let active=true;
    const vehicles:Record<string,VehicleLite>={},customers:Record<string,string>={};
    const publish=()=>{if(active&&current.current===scope)setSource({scope,vehicles:{...vehicles},customers:{...customers}})};
    const pairs=JSON.parse(ids) as string[];
    const vehicleIds=new Set(pairs.map(p=>p.split('|')[0]).filter(Boolean));
    const customerIds=new Set(pairs.map(p=>p.split('|')[1]).filter(Boolean));
    const stops=[...Array.from(vehicleIds,id=>onSnapshot(doc(db,COLLECTIONS.vehicles(),id!),snap=>{
      if(!active||current.current!==scope)return;
      const value=snap.exists()?snap.data():null;
      if(value?.tenantId===tenantId)vehicles[id!]=value as VehicleLite;else delete vehicles[id!];publish();
    },()=>{delete vehicles[id!];publish()})),...Array.from(customerIds,id=>onSnapshot(doc(db,COLLECTIONS.customers(),id!),snap=>{
      if(!active||current.current!==scope)return;
      const value=snap.exists()?snap.data():null;
      if(value?.tenantId===tenantId&&typeof value.name==='string')customers[id!]=value.name;else delete customers[id!];publish();
    },()=>{delete customers[id!];publish()}))];
    publish();
    return()=>{active=false;stops.forEach(stop=>stop())};
  },[owner,tenantId,ids,scope]);
  const known=source?.scope===scope?source:null;
  return {
    car:(job:ServiceJob)=>owner&&job.tenantId===tenantId?jobCar(job,known?.vehicles??{}):undefined,
    customer:(job:ServiceJob)=>owner&&job.tenantId===tenantId?known?.customers[job.customerId]:undefined,
  };
}
