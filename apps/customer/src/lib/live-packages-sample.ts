// Dev preview only. A read-only copy of how these services looked in the live admin Services page on 22 Oct 2026 (ids, names, prices, descriptions as shown). Not used in production builds.
import type { Service } from "@autodeck/core";

export const LIVE_PACKAGE_SAMPLE = [
  { id: "svc-wash-regular", name: "Regular Wash", description: "Standard exterior wash and dry with foam.", category: "washing", active: true, priceOnRequest: false, basePrice: 50000, durationMinutes: 45 },
  { id: "svc-wash-premium", name: "Premium Wash", description: "Extended premium koach foam wash with additional interior polishing of dashboard and doors.", category: "washing", active: true, priceOnRequest: false, basePrice: 100000, durationMinutes: 60 },
  { id: "svc-wash-detail-spa", name: "Detail SPA", description: "Thorough wash and detailing spa treatment.\n- Engine cleaning\n- Under body cleaning\n- Interior cleaning\n- Dashboard, Tyre and Trims polishing", category: "washing", active: true, priceOnRequest: false, basePrice: 250000, durationMinutes: 120 },
  { id: "svc-wash-headlight-buffing", name: "Headlight Buffing", description: "Headlight restoration and buffing.", category: "washing", active: true, priceOnRequest: false, basePrice: 90000, durationMinutes: 60 },
  { id: "menu-wash-exterior", name: "Ceramic wash", description: "Extended premium koach foam wash with additional polishing of dashboard, doors, tyres and trims\n\n- Includes Ceramic wash & spray", category: "washing", active: true, priceOnRequest: false, basePrice: 200000, durationMinutes: 90 },
  { id: "menu-wash-interior", name: "Interior deep clean", description: "Vacuum, steam clean and conditioning of seats, mats and trim.", category: "washing", active: true, priceOnRequest: false, basePrice: 450000, durationMinutes: 180 },
  { id: "menu-wash-full", name: "Full detail wash", description: "Interior deep clean and exterior detail wash together.", category: "washing", active: true, priceOnRequest: false, basePrice: 575000, durationMinutes: 180 },
] as unknown as Service[];
