"use client";

import { useEffect, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import type { GalleryCategory, GalleryImage } from "@autodeck/core";
import { listenToGallery, addGalleryImage, setGalleryImageActive, deleteGalleryImage } from "../../../lib/gallery-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { GalleryView } from "../../../experience/GalleryView";

export default function GalleryPage() {
  const { claims } = useAdminAuth();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const studioId = claims?.studioId ?? FIRST_STUDIO_ID;

  useEffect(() => {
    if (!claims) return;
    const unsub = listenToGallery(
      claims.tenantId,
      studioId,
      (imgs) => { setImages(imgs); setLoading(false); },
      () => { setError("Couldn't load the gallery."); setLoading(false); },
    );
    return unsub;
  }, [claims, studioId]);

  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(ok);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fail);
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = claims?.role === "admin" || claims?.role === "superadmin";

  return (
    <GalleryView
      images={images}
      isAdmin={isAdmin}
      loading={loading}
      busy={busy}
      error={error}
      message={message}
      onAdd={(input) =>
        void run(
          () =>
            addGalleryImage({
              studioId,
              imageUrl: input.imageUrl,
              category: input.category as GalleryCategory,
              ...(input.caption ? { caption: input.caption } : {}),
              ...(input.vehicleLabel ? { vehicleLabel: input.vehicleLabel } : {}),
            }),
          "Image published.",
          "Couldn't add the image.",
        )
      }
      onToggle={(img) => void run(() => setGalleryImageActive(img.id, !img.active), img.active ? "Image hidden." : "Image live.", "Couldn't update the image.")}
      onDelete={(img) => void run(() => deleteGalleryImage(img.id), "Image deleted.", "Couldn't delete the image.")}
    />
  );
}
