"use client";

import { useCallback, useEffect, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import type { OfferView } from "@autodeck/core";
import { listAllOffers, publishOffer, updateOffer } from "../../../lib/offer-service";
import { getServicesIncludingHidden } from "../../../lib/catalogue-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { OffersView } from "../../../experience/OffersView";

export default function OffersPage() {
  const { claims } = useAdminAuth();
  const [offers, setOffers] = useState<OfferView[]>([]);
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const studioId = claims?.studioId ?? FIRST_STUDIO_ID;

  const load = useCallback(async () => {
    try { setOffers(await listAllOffers()); } catch { setError("Couldn't load offers."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (claims) { void load(); void getServicesIncludingHidden().then((l) => setServices(l.map((s) => ({ id: s.id, name: s.name })))).catch(() => undefined); } }, [claims, load]);

  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    setBusy(true); setError(null); setMessage(null);
    try { await action(); setMessage(ok); await load(); }
    catch (err) { setError(err instanceof Error && err.message ? err.message : fail); }
    finally { setBusy(false); }
  }

  return (
    <OffersView
      offers={offers}
      services={services}
      loading={loading}
      busy={busy}
      error={error}
      message={message}
      onPublish={(i) => void run(() => publishOffer({ studioId, file: i.file, headline: i.headline, body: i.body, cta: i.cta, link: { kind: i.linkKind as "none" | "catalogue" | "membership" | "service", serviceId: i.linkKind === "service" ? i.serviceId : null }, startsAt: i.startsAt, endsAt: i.endsAt }), "Offer published.", "Couldn't publish the offer.")}
      onHide={(o) => void run(() => updateOffer({ offerId: o.id, hidden: !o.hidden }), o.hidden ? "Offer shown." : "Offer hidden.", "Couldn't update the offer.")}
      onEndNow={(o) => void run(() => updateOffer({ offerId: o.id, endsAt: new Date().toISOString() }), "Offer ended.", "Couldn't end the offer.")}
    />
  );
}
