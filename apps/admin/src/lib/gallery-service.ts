"use client";

import { collection, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { GalleryCategory, GalleryImage } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

/** Live management feed for one studio's gallery (active + inactive). */
export function listenToGallery(
  tenantId: string,
  studioId: string,
  onData: (images: GalleryImage[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.gallery()),
    where("tenantId", "==", tenantId),
    where("studioId", "==", studioId),
  );
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs
          .map((d) => d.data() as GalleryImage)
          .sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.localeCompare(b.createdAt)),
      ),
    onError,
  );
}

export async function addGalleryImage(input: {
  studioId: string;
  imageUrl: string;
  category: GalleryCategory;
  caption?: string;
  vehicleLabel?: string;
}): Promise<{ id: string }> {
  const fn = httpsCallable<typeof input, { id: string }>(functions, "addGalleryImage");
  return (await fn(input)).data;
}

export async function setGalleryImageActive(imageId: string, active: boolean): Promise<void> {
  const fn = httpsCallable<{ imageId: string; active: boolean }, { id: string }>(functions, "updateGalleryImage");
  await fn({ imageId, active });
}

export async function deleteGalleryImage(imageId: string): Promise<void> {
  const fn = httpsCallable<{ imageId: string }, { id: string }>(functions, "deleteGalleryImage");
  await fn({ imageId });
}
