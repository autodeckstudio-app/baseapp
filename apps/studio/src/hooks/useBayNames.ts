import { useEffect, useState } from "react";
import { getStudioConfig } from "../lib/studio-service";
import { getActiveServices } from "../lib/approval-service";

/** Bay and service display names for job lists, so staff never see raw ids. */
export function useJobLabels(studioId: string | null): { bays: Record<string, string>; services: Record<string, string> } {
  const [bays, setBays] = useState<Record<string, string>>({});
  const [services, setServices] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!studioId) return;
    let alive = true;
    void getStudioConfig(studioId).then((c) => { if (alive && c) setBays(Object.fromEntries(c.bays.map((b) => [b.id, b.name]))); }).catch(() => undefined);
    void getActiveServices().then((l) => { if (alive) setServices(Object.fromEntries(l.map((s) => [s.id, s.name]))); }).catch(() => undefined);
    return () => { alive = false; };
  }, [studioId]);
  return { bays, services };
}
