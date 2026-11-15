export type GalleryCategory = "BEFORE_AFTER" | "PPF" | "CERAMIC" | "WASH" | "STUDIO" | "OTHER";

/**
 * One marketing gallery image. Readable without auth (the legacy gallery was
 * publicly readable on the marketing site); managed admin-only through
 * callables. Contains no customer data — only studio marketing media.
 */
export interface GalleryImage {
  id: string;
  tenantId: string;
  studioId: string;
  imageUrl: string;
  caption: string | null;
  category: GalleryCategory;
  vehicleLabel: string | null; // e.g. "Kia Seltos" — display text only
  active: boolean;
  displayOrder: number;
  createdBy: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
