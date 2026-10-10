"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { useLabels } from "../../../lib/use-labels";
import { listenToTenantVehicles } from "../../../lib/customers-service";
import type { Vehicle, Protection, ProtectionStatus } from "@autodeck/core";
import { VehiclesView, KIND_LABEL, type ProtectionDraft } from "../../../experience/VehiclesView";
import { studioToday } from "../../../lib/format";
import { useAdminAuth } from "../../../lib/auth-context";
import {
  findVehicleByRegistration,
  getVehicleProtections,
  createProtection,
  updateProtection,
} from "../../../lib/protection-service";

export default function VehicleLookupPage() {
  const { claims } = useAdminAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [protections, setProtections] = useState<Protection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  useEffect(() => {
    if (!claims) return undefined;
    return listenToTenantVehicles(claims.tenantId, setFleet, () => undefined);
  }, [claims]);
  const ownerNames = useLabels(COLLECTIONS.customers(), [...fleet.map((v) => v.ownerId), vehicle?.ownerId ?? ""], (d) => (d as Customer).name || (d as Customer).phone || "Customer");
  async function pick(v: Vehicle) {
    setError(null); setStatus(null); setVehicle(v);
    try { await refreshProtections(v.id); } catch { setError("Couldn't load this car's papers."); }
  }

  async function refreshProtections(vehicleId: string) {
    setProtections(await getVehicleProtections(vehicleId));
  }

  async function handleSearch(plate: string) {
    if (!claims || !plate.trim()) return;
    setError(null);
    setStatus(null);
    setLoading(true);
    try {
      const found = await findVehicleByRegistration(claims.tenantId, plate.trim());
      setVehicle(found);
      if (found) {
        await refreshProtections(found.id);
      } else {
        setProtections([]);
        setError(`No car with plate ${plate.trim()} is on file.`);
      }
    } catch {
      setError("Search failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddProtection(form: ProtectionDraft) {
    if (!vehicle) return;
    setError(null);
    setStatus(null);
    try {
      await createProtection({
        vehicleId: vehicle.id,
        kind: form.kind,
        provider: form.provider || undefined,
        policyNumber: form.policyNumber || undefined,
        startDate: form.startDate || undefined,
        expiryDate: form.expiryDate || undefined,
        notes: form.notes || undefined,
      });
      setStatus(`${KIND_LABEL[form.kind]} saved.`);
      await refreshProtections(vehicle.id);
    } catch {
      setError("Couldn't save that. Try again.");
    }
  }

  async function handleStatusChange(p: Protection, nextStatus: ProtectionStatus) {
    if (!vehicle) return;
    setError(null);
    try {
      await updateProtection({ vehicleId: vehicle.id, protectionId: p.id, status: nextStatus });
      await refreshProtections(vehicle.id);
    } catch {
      setError("Couldn't update that record.");
    }
  }

  return (
    <VehiclesView
      today={studioToday()}
      searching={loading}
      fleet={fleet}
      ownerNames={ownerNames}
      onPick={(v) => void pick(v)}
      onOpenOwner={(id) => router.push(`/customers/${id}`)}
      vehicle={vehicle}
      protections={protections}
      error={error}
      message={status}
      onSearch={(plate) => void handleSearch(plate)}
      onAdd={(draft) => void handleAddProtection(draft)}
      onStatus={(prot, next) => void handleStatusChange(prot, next)}
    />
  );
}
