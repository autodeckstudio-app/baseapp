"use client";

import { useEffect, useState } from "react";
import type { Service, ServiceCategory, BayType, VehicleCategory, VehicleCategoryPricing } from "@autodeck/core";
import {
  getServiceCatalogue,
  createService,
  updateService,
  setServiceActive,
} from "../../../lib/catalogue-service";

const CATEGORIES: ServiceCategory[] = ["ppf", "ceramic", "washing", "coating", "inspection", "tinting", "other"];
const BAY_TYPES: BayType[] = ["wash", "protection", "general"];
const VEHICLE_CATEGORIES: VehicleCategory[] = ["hatchback", "sedan", "suv", "luxury", "commercial", "van"];

const emptyForm = {
  serviceId: null as string | null,
  name: "",
  category: "washing" as ServiceCategory,
  brand: "",
  description: "",
  basePrice: 0,
  estimatedDurationMinutes: 30,
  warrantyLabel: "",
  requiredBayType: "wash" as BayType,
  displayOrder: 0,
  vehicleCategoryPricing: [] as VehicleCategoryPricing[],
};

export default function ServiceCataloguePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function refresh() {
    setLoading(true);
    try {
      const list = await getServiceCatalogue();
      list.sort((a, b) => a.displayOrder - b.displayOrder);
      setServices(list);
    } catch {
      setError("Failed to load service catalogue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function loadIntoForm(s: Service) {
    setForm({
      serviceId: s.id,
      name: s.name,
      category: s.category,
      brand: s.brand ?? "",
      description: s.description,
      basePrice: s.basePrice,
      estimatedDurationMinutes: s.estimatedDurationMinutes,
      warrantyLabel: s.warrantyLabel ?? "",
      requiredBayType: s.requiredBayType,
      displayOrder: s.displayOrder,
      vehicleCategoryPricing: s.vehicleCategoryPricing,
    });
  }

  async function handleSave() {
    setError(null);
    setStatus(null);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        brand: form.brand || null,
        description: form.description,
        basePrice: form.basePrice,
        estimatedDurationMinutes: form.estimatedDurationMinutes,
        warrantyLabel: form.warrantyLabel || null,
        requiredBayType: form.requiredBayType,
        displayOrder: form.displayOrder,
        vehicleCategoryPricing: form.vehicleCategoryPricing,
      };
      if (form.serviceId) {
        await updateService({ ...payload, serviceId: form.serviceId });
        setStatus("Service updated. Historical bookings and invoices are unaffected.");
      } else {
        await createService(payload);
        setStatus("Service created.");
      }
      setForm(emptyForm);
      await refresh();
    } catch {
      setError("Failed to save service.");
    }
  }

  async function handleToggleActive(s: Service) {
    const verb = s.active ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${verb} "${s.name}"?`)) return;
    setError(null);
    try {
      await setServiceActive(s.id, !s.active);
      await refresh();
    } catch {
      setError(`Failed to ${verb} service.`);
    }
  }

  function addPricingRow() {
    setForm((f) => ({
      ...f,
      vehicleCategoryPricing: [
        ...f.vehicleCategoryPricing,
        { vehicleCategory: "hatchback", additionalPricePaise: 0, additionalMinutes: 0 },
      ],
    }));
  }

  return (
    <div>
      <h1>Service Catalogue</h1>
      <p style={{ fontSize: 13, color: "#555" }}>
        Changes to price, warranty, or description do NOT affect completed bookings or issued invoices —
        historical records are immutable snapshots.
      </p>
      {error && <p className="error">{error}</p>}
      {status && <p>{status}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Name</th>
              <th>Category</th>
              <th>Base price (₹)</th>
              <th>Duration (min)</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>{s.displayOrder}</td>
                <td>{s.name}</td>
                <td>{s.category}</td>
                <td>{(s.basePrice / 100).toFixed(2)}</td>
                <td>{s.estimatedDurationMinutes}</td>
                <td>{s.active ? "Yes" : "No"}</td>
                <td>
                  <button onClick={() => loadIntoForm(s)}>Edit</button>{" "}
                  <button onClick={() => void handleToggleActive(s)}>
                    {s.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>{form.serviceId ? "Edit service" : "New service"}</h2>
      <fieldset>
        <label>
          Name
          <br />
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
      </fieldset>
      <fieldset>
        <label>
          Category
          <br />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as ServiceCategory })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <label>
          Description
          <br />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
      </fieldset>
      <fieldset>
        <label>
          Base price (paise)
          <br />
          <input
            type="number"
            value={form.basePrice}
            onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })}
          />
        </label>
      </fieldset>
      <fieldset>
        <label>
          Duration (minutes)
          <br />
          <input
            type="number"
            value={form.estimatedDurationMinutes}
            onChange={(e) => setForm({ ...form, estimatedDurationMinutes: Number(e.target.value) })}
          />
        </label>
      </fieldset>
      <fieldset>
        <label>
          Required bay type
          <br />
          <select
            value={form.requiredBayType}
            onChange={(e) => setForm({ ...form, requiredBayType: e.target.value as BayType })}
          >
            {BAY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <label>
          Display order
          <br />
          <input
            type="number"
            value={form.displayOrder}
            onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Vehicle category pricing</legend>
        {form.vehicleCategoryPricing.map((p, i) => (
          <div key={i}>
            <select
              value={p.vehicleCategory}
              onChange={(e) => {
                const next = [...form.vehicleCategoryPricing];
                next[i] = { ...p, vehicleCategory: e.target.value as VehicleCategory };
                setForm({ ...form, vehicleCategoryPricing: next });
              }}
            >
              {VEHICLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Additional paise"
              value={p.additionalPricePaise}
              onChange={(e) => {
                const next = [...form.vehicleCategoryPricing];
                next[i] = { ...p, additionalPricePaise: Number(e.target.value) };
                setForm({ ...form, vehicleCategoryPricing: next });
              }}
            />
            <input
              type="number"
              placeholder="Additional minutes"
              value={p.additionalMinutes}
              onChange={(e) => {
                const next = [...form.vehicleCategoryPricing];
                next[i] = { ...p, additionalMinutes: Number(e.target.value) };
                setForm({ ...form, vehicleCategoryPricing: next });
              }}
            />
          </div>
        ))}
        <button onClick={addPricingRow}>Add vehicle category rule</button>
      </fieldset>

      <button onClick={() => void handleSave()}>{form.serviceId ? "Save changes" : "Create service"}</button>{" "}
      {form.serviceId && <button onClick={() => setForm(emptyForm)}>Cancel edit</button>}
    </div>
  );
}
