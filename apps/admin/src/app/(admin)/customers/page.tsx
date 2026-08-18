"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@autodeck/core";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToCustomers, findCustomerIdByRegistration } from "../../../lib/customers-service";
import { formatDate } from "../../../lib/format";

export default function CustomersPage() {
  const { claims } = useAdminAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [regLookup, setRegLookup] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q));
  }, [customers, search]);

  async function handleRegSearch(reg: string) {
    setRegLookup(null);
    if (!claims || reg.trim().length < 4) return;
    const customerId = await findCustomerIdByRegistration(claims.tenantId, reg.trim());
    if (customerId) router.push(`/customers/${customerId}`);
    else setRegLookup("No vehicle found with that registration number.");
  }

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Customers</h1>

      <div className="filter-bar">
        <input placeholder="Search name / phone" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 240 }} />
        <input
          placeholder="Find by registration number"
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleRegSearch(e.currentTarget.value);
          }}
          style={{ minWidth: 220 }}
        />
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtered.length} of {customers.length}</span>
      </div>
      {regLookup && <p className="error">{regLookup}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : filtered.length === 0 ? (
        <p>No customers match this search.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="row-link" onClick={() => router.push(`/customers/${c.id}`)}>
                <td>{c.name}</td>
                <td>{c.phone}</td>
                <td>{formatDate(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
