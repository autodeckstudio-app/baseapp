"use client";

import { useState } from "react";
import type { Vehicle, Protection, ProtectionKind, ProtectionStatus } from "@autodeck/core";
import { useAdminAuth } from "../../../lib/auth-context";
import {
  findVehicleByRegistration,
  getVehicleProtections,
  createProtection,
  updateProtection,
} from "../../../lib/protection-service";

const KINDS: ProtectionKind[] = ["insurance", "fasttag", "puc", "rc", "extended_warranty", "other"];
const STATUSES: ProtectionStatus[] = ["unverified", "verified", "expired"];

const emptyForm = {
  kind: "insurance" as ProtectionKind,
  provider: "",
  policyNumber: "",
  startDate: "",
  expiryDate: "",
  notes: "",
};

export default function VehicleLookupPage() {
  const { claims } = useAdminAuth();
  const [regInput, setRegInput] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [protections, setProtections] = useState<Protection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function refreshProtections(vehicleId: string) {
    setProtections(await getVehicleProtections(vehicleId));
  }

  async function handleSearch() {
    if (!claims || !regInput.trim()) return;
    setError(null);
    setStatus(null);
    setLoading(true);
    try {
      const found = await findVehicleByRegistration(claims.tenantId, regInput.trim());
      setVehicle(found);
      if (found) {
        await refreshProtections(found.id);
      } else {
        setProtections([]);
        setError("No vehicle found with that registration number.");
      }
    } catch {
      setError("Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddProtection() {
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
      setForm(emptyForm);
      setStatus("Protection added.");
      await refreshProtections(vehicle.id);
    } catch {
      setError("Failed to add protection.");
    }
  }

  async function handleStatusChange(p: Protection, nextStatus: ProtectionStatus) {
    if (!vehicle) return;
    setError(null);
    try {
      await updateProtection({ vehicleId: vehicle.id, protectionId: p.id, status: nextStatus });
      await refreshProtections(vehicle.id);
    } catch {
      setError("Failed to update protection.");
    }
  }

  return (
    <div>
      <h1>Vehicles</h1>
      <p>Look up a vehicle by registration number to manage its protection records.</p>
      {error && <p className="error">{error}</p>}
      {status && <p>{status}</p>}

      <fieldset>
        <label>
          Registration number
          <br />
          <input
            value={regInput}
            onChange={(e) => setRegInput(e.target.value.toUpperCase())}
            placeholder="GJ01AB1234"
          />
        </label>
      </fieldset>
      <button onClick={() => void handleSearch()} disabled={loading}>
        {loading ? "Searching…" : "Search"}
      </button>

      {vehicle && (
        <>
          <h2>
            {vehicle.year} {vehicle.make} {vehicle.model} — {vehicle.registrationNumber}
          </h2>

          <table>
            <thead>
              <tr>
                <th>Kind</th>
                <th>Provider</th>
                <th>Policy #</th>
                <th>Expiry</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {protections.map((p) => (
                <tr key={p.id}>
                  <td>{p.kind}</td>
                  <td>{p.provider ?? "—"}</td>
                  <td>{p.policyNumber ?? "—"}</td>
                  <td>{p.expiryDate ?? "—"}</td>
                  <td>{p.status}</td>
                  <td>
                    <select value={p.status} onChange={(e) => void handleStatusChange(p, e.target.value as ProtectionStatus)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {protections.length === 0 && (
                <tr>
                  <td colSpan={6}>No protections on file.</td>
                </tr>
              )}
            </tbody>
          </table>

          <h2>Add protection</h2>
          <fieldset>
            <label>
              Kind
              <br />
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ProtectionKind })}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          <fieldset>
            <label>
              Provider
              <br />
              <input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
            </label>
          </fieldset>
          <fieldset>
            <label>
              Policy number
              <br />
              <input value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} />
            </label>
          </fieldset>
          <fieldset>
            <label>
              Start date
              <br />
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </label>
          </fieldset>
          <fieldset>
            <label>
              Expiry date
              <br />
              <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </label>
          </fieldset>
          <fieldset>
            <label>
              Notes
              <br />
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </fieldset>
          <button onClick={() => void handleAddProtection()}>Add protection</button>
        </>
      )}
    </div>
  );
}
