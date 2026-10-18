import { SERVICE_TYPES } from "./services-tree";

/**
 * The car-first Services picker. A zone is a place on the car; it only filters the type list, it never adds an offer.
 * The 3D car is one generic coupe, not the customer's own car, so zones are places ("Paint", "Wheels"), never a fit claim.
 */
export type ZoneKey = "paint" | "glass" | "wheels" | "interior" | "body" | "lights" | "rear";

/** Where each zone sits on hero-coupe.glb: a named node in the model, and which way the dot faces so it hides when turned away. */
export const ZONE_NODES: Record<ZoneKey, { node: string; facing: "up" | "side" | "front" | "back" }> = {
  paint: { node: "BodyHood", facing: "up" },
  glass: { node: "BodyWindshield", facing: "up" },
  wheels: { node: "WheelFrontL", facing: "side" },
  interior: { node: "BodyDoorLWindow", facing: "side" },
  body: { node: "BodyDoorLColor1", facing: "side" },
  lights: { node: "BodyHeadlights", facing: "front" },
  rear: { node: "BodyRearPanelsColor1", facing: "back" },
};

type ZoneDef = { label: string; types: string[] };
/** Per menu group: which zones show, what they are called there, and which type keys (from SERVICE_TYPES) they open. */
export const GROUP_ZONES: Record<string, Partial<Record<ZoneKey, ZoneDef>>> = {
  coatings: {
    paint: { label: "Paint", types: ["ceramic", "graphene", "matte", "ppf-coat"] },
    glass: { label: "Glass", types: ["glass"] },
    wheels: { label: "Wheels and tyres", types: ["wheels", "tyre"] },
    interior: { label: "Interior", types: ["leather", "fabric", "dashboard"] },
    body: { label: "Trim", types: ["trim"] },
  },
  ppf: {
    body: { label: "Film by brand", types: ["brand-film"] },
    paint: { label: "Colour and finish", types: ["colour", "matte-ppf"] },
  },
  wash: {
    body: { label: "Body", types: ["exterior", "complete", "trim-restore"] },
    paint: { label: "Paint", types: ["decon", "polish"] },
    glass: { label: "Glass", types: ["glass-clean"] },
    wheels: { label: "Wheels", types: ["wheel-clean"] },
    interior: { label: "Interior", types: ["interior", "leather-care", "odour"] },
    lights: { label: "Lights", types: ["lamps"] },
  },
  garage: {
    paint: { label: "Under the hood", types: ["checks", "periodic", "battery"] },
    interior: { label: "Cabin", types: ["ac"] },
    wheels: { label: "Wheels and brakes", types: ["tyres", "brakes"] },
    body: { label: "Underbody", types: ["suspension", "rust", "repairs"] },
  },
  mods: {
    body: { label: "Body", types: ["wraps", "exterior-style", "styling"] },
    wheels: { label: "Wheels", types: ["alloys"] },
    glass: { label: "Glass", types: ["film"] },
    interior: { label: "Interior", types: ["audio", "seats", "interior-style", "mats"] },
    rear: { label: "Rear", types: ["cameras"] },
  },
};

/** Zones for a group in a stable on-screen order. */
export function zonesOf(group: string): Array<{ key: ZoneKey; label: string; types: string[] }> {
  const order: ZoneKey[] = ["paint", "glass", "wheels", "interior", "body", "lights", "rear"];
  const g = GROUP_ZONES[group] ?? {};
  return order.filter((k) => g[k]).map((k) => ({ key: k, ...g[k]! }));
}

/** "What do you want?" entry for people who do not know the type: a goal opens a category with a zone already picked. */
export const GOALS: Array<{ key: string; label: string; group: string; zone: ZoneKey }> = [
  { key: "protect", label: "Protect", group: "coatings", zone: "paint" },
  { key: "shine", label: "Shine", group: "wash", zone: "paint" },
  { key: "clean", label: "Clean", group: "wash", zone: "interior" },
  { key: "fix", label: "Fix", group: "garage", zone: "paint" },
  { key: "style", label: "Style", group: "mods", zone: "body" },
];

/** Type keys the zone filter leaves out for this group, so nothing is ever unreachable. */
export function unreachableTypes(group: string): string[] {
  const reached = new Set(zonesOf(group).flatMap((z) => z.types));
  return (SERVICE_TYPES[group] ?? []).map((d) => d.key).filter((k) => !reached.has(k));
}
