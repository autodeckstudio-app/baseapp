"use client";

import { useEffect, useState } from "react";
import type { Service } from "@autodeck/core";
import { ServicesView } from "../../../experience/ServicesView";
import type { ServicePayload } from "../../../experience/services-draft";
import {
  getServiceCatalogue,
  createService,
  updateService,
  setServiceActive,
} from "../../../lib/catalogue-service";

export default function ServiceCataloguePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const list = await getServiceCatalogue();
      list.sort((a, b) => a.displayOrder - b.displayOrder);
      setServices(list);
    } catch {
      setError("Couldn't load services.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // The callables re-validate and re-check the admin role server-side.
  async function handleSave(serviceId: string | null, payload: ServicePayload) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      if (serviceId) {
        await updateService({ ...payload, serviceId });
        setStatus(`${payload.name} saved. Past bookings and invoices keep their prices.`);
      } else {
        await createService(payload);
        setStatus(`${payload.name} is on the menu.`);
      }
      await refresh();
    } catch {
      setError("Couldn't save the service.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(svc: Service) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await setServiceActive(svc.id, !svc.active);
      setStatus(svc.active ? `${svc.name} is hidden from the menu.` : `${svc.name} is back on the menu.`);
      await refresh();
    } catch {
      setError("Couldn't change the service.");
    } finally {
      setBusy(false);
    }
  }

  return <ServicesView services={services} loading={loading} error={error} message={status} busy={busy} onSave={(id, pl) => void handleSave(id, pl)} onToggle={(svc) => void handleToggleActive(svc)} />;
}
