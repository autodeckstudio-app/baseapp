"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@autodeck/core";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToCustomers, findCustomerIdByRegistration } from "../../../lib/customers-service";
import { CustomersView } from "../../../experience/OfficeViews";

export default function CustomersPage() {
  const { claims } = useAdminAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [plateMessage, setPlateMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!claims) return undefined;
    setLoading(true);
    return listenToCustomers(
      claims.tenantId,
      (data) => {
        setCustomers(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [claims]);

  async function handlePlate(reg: string) {
    setPlateMessage(null);
    if (!claims || reg.trim().length < 4) return;
    const customerId = await findCustomerIdByRegistration(claims.tenantId, reg.trim());
    if (customerId) router.push(`/customers/${customerId}`);
    else setPlateMessage(`No car with plate ${reg.trim()} is on file.`);
  }

  return (
    <CustomersView
      customers={customers}
      loading={loading}
      error={error}
      search={search}
      onSearch={setSearch}
      onPlateLookup={(r) => void handlePlate(r)}
      plateMessage={plateMessage}
      onOpen={(id) => router.push(`/customers/${id}`)}
    />
  );
}
