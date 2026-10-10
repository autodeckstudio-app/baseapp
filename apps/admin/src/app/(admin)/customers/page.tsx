"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer, Vehicle } from "@autodeck/core";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToCustomers, listenToTenantVehicles, findCustomerIdByRegistration } from "../../../lib/customers-service";
import { customerIdsForPlate } from "../../../lib/customer-search";
import { CustomersView } from "../../../experience/OfficeViews";

export default function CustomersPage() {
  const { claims } = useAdminAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [plateMessage, setPlateMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!claims) return undefined;
    setLoading(true);
    return listenToCustomers(
      claims.tenantId,
      (data) => {
        setError(null);
        setCustomers(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [claims]);

  useEffect(() => {
    if (!claims) return undefined;
    return listenToTenantVehicles(claims.tenantId, setVehicles, () => setVehicles([]));
  }, [claims]);

  async function handlePlate(reg: string) {
    setPlateMessage(null);
    if (!claims || reg.trim().length < 4) return;
    try {
      const local = customerIdsForPlate(reg, vehicles);
      if (local.length === 1) { router.push(`/customers/${local[0]}`); return; }
      if (local.length > 1) { setSearch(reg.trim()); return; }
      const customerId = await findCustomerIdByRegistration(claims.tenantId, reg.trim());
      if (customerId) router.push(`/customers/${customerId}`);
      else setPlateMessage(`No car with plate ${reg.trim()} is on file.`);
    } catch {
      setPlateMessage("We could not check that plate. Try again.");
    }
  }

  return (
    <CustomersView
      customers={customers}
      loading={loading}
      error={error}
      vehicles={vehicles}
      search={search}
      onSearch={setSearch}
      onPlateLookup={(r) => void handlePlate(r)}
      plateMessage={plateMessage}
      onOpen={(id) => router.push(`/customers/${id}`)}
    />
  );
}
