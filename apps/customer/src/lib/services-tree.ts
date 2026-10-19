import { COATING_BRANDS, PPF_BRANDS, type MenuGroup, type Service } from "@autodeck/core";

/** One level of the Services drill-down. A branch opens another level, a leaf is a bookable service, an enquiry is a market type we do not list yet. */
export type TreeNode =
  | { kind: "branch"; key: string; label: string; blurb?: string; children: TreeNode[] }
  | { kind: "leaf"; service: Service }
  | { kind: "enquiry"; key: string; label: string; blurb?: string };

interface TypeDef {
  key: string;
  label: string;
  blurb?: string;
  /** Catalogue services (by id) that belong to this type. */
  ids?: string[];
  /** Fallback match for services whose id is not listed. */
  test?: (s: Service) => boolean;
  /** Split the type's services by brand before showing products. */
  byBrand?: readonly string[];
  /** An AutoDeck offering with no price or booking flow yet. Shown as a normal type with "Get a quote" (opens Help), no price, term or warranty. */
  enquiryOnly?: true;
}

// The type vocabulary comes from the sourced India-market research (docs/SERVICE-TAXONOMY.md). Market existence is not AutoDeck stock:
// only types with a real catalogue service are bookable. The rest are enquiry-only rows with no price, term or warranty.
const E = (key: string, label: string, blurb?: string): TypeDef => ({ key, label, ...(blurb ? { blurb } : {}), enquiryOnly: true });

export const SERVICE_TYPES: Record<string, TypeDef[]> = {
  wash: [
    { key: "exterior", label: "Exterior wash", blurb: "Foam and detail washes.", ids: ["menu-wash-foam", "menu-wash-exterior"], test: (s) => s.category === "washing" },
    { key: "interior", label: "Interior cleaning", blurb: "Vacuum, steam and conditioning.", ids: ["menu-wash-interior"] },
    { key: "complete", label: "Complete detailing", blurb: "Interior and exterior together.", ids: ["menu-wash-full"] },
    E("decon", "Paint decontamination"), E("polish", "Polish and paint correction"), E("glass-clean", "Glass cleaning and water spots"),
    E("leather-care", "Leather cleaning and conditioning"), E("wheel-clean", "Wheel and tyre cleaning"), E("trim-restore", "Trim restoration"),
    E("lamps", "Headlight and tail-light restoration"), E("odour", "Odour treatment"),
  ],
  coatings: [
    { key: "ceramic", label: "Ceramic paint coating", blurb: "Gloss paint protection, by brand.", ids: ["menu-coat-autodeck-1", "menu-coat-autodeck-2", "menu-coat-fireball-1", "menu-coat-fireball-2", "menu-coat-fireball-3", "menu-coat-kovalent-prolong", "menu-coat-kovalent-borophene", "menu-coat-3m-ceramic"], test: (s) => s.category === "ceramic", byBrand: COATING_BRANDS },
    { key: "graphene", label: "Graphene paint coating", blurb: "Graphene-based paint protection.", ids: ["menu-coat-kovalent-graphene"], byBrand: COATING_BRANDS },
    { key: "glass", label: "Glass protection", blurb: "Water-repellent coating for glass.", ids: ["menu-coat-glass"] },
    { key: "wheels", label: "Wheel and alloy protection", blurb: "Coating for wheel faces and barrels.", ids: ["menu-coat-wheels"] },
    { key: "leather", label: "Leather protection", blurb: "Protective coating for leather.", ids: ["menu-coat-leather"] },
    { key: "fabric", label: "Fabric and upholstery protection", blurb: "Stain-repellent coating for fabric.", ids: ["menu-coat-fabric"] },
    { key: "trim", label: "Exterior plastic and trim protection", blurb: "Restores faded trim and seals it.", ids: ["menu-coat-trim"], test: (s) => s.category === "coating" },
    E("matte", "Matte paint protection"), E("tyre", "Tyre protection"), E("dashboard", "Dashboard and interior trim protection"), E("ppf-coat", "PPF coating and aftercare"),
  ],
  ppf: [
    { key: "brand-film", label: "Film by brand", blurb: "Garware, XPEL, LLumar and 3M, by coverage.", test: (s) => s.category === "ppf" && s.priceOnRequest !== true, byBrand: PPF_BRANDS },
    { key: "colour", label: "Colour film", blurb: "Coloured and black films. Priced after we see the car.", ids: ["menu-ppf-colour"], test: (s) => s.category === "ppf" && s.priceOnRequest === true },
    E("matte-ppf", "Matte and satin film"),
  ],
  garage: [
    { key: "checks", label: "Checks and diagnostics", blurb: "Multi-point health check.", ids: ["menu-garage-inspection"], test: (s) => s.category === "garage" || s.category === "inspection" || s.category === "other" },
    { key: "tyres", label: "Wheels and tyres", blurb: "Alignment and balancing.", ids: ["menu-garage-alignment"] },
    { key: "battery", label: "Battery and electrical", blurb: "Battery health and charging test.", ids: ["menu-garage-battery"] },
    { key: "ac", label: "AC service", blurb: "Cooling, gas level and leak check.", ids: ["menu-garage-ac"] },
    { key: "repairs", label: "Repairs and inspection-led work", blurb: "Tell us what is wrong. We inspect, then quote.", ids: ["menu-garage-repairs"] },
    E("periodic", "Periodic service"), E("brakes", "Brakes"), E("suspension", "Suspension"), E("rust", "Anti-rust protection"),
  ],
  mods: [
    { key: "wraps", label: "Vinyl wraps and graphics", blurb: "Full and partial wraps. Quoted after seeing the car.", ids: ["menu-mods-wrap"] },
    { key: "styling", label: "Accessories and styling", blurb: "Quoted per job.", ids: ["menu-mods-styling"], test: (s) => s.category === "modifications" },
    { key: "film", label: "Window film (fitment check first)", blurb: "Quoted by car and film, after a legality and fitment check.", ids: ["menu-mods-tint"], test: (s) => s.category === "tinting" },
    E("audio", "Audio and infotainment"), E("cameras", "Cameras and parking assistance"), E("seats", "Seats and upholstery"),
    E("interior-style", "Interior styling"), E("exterior-style", "Exterior styling"), E("alloys", "Alloy upgrades and refinishing"), E("mats", "Mats and fitted accessories"),
  ],
};

const byPrice = (a: Service, b: Service) => Number(a.priceOnRequest === true) - Number(b.priceOnRequest === true) || a.basePrice - b.basePrice;
const leaves = (xs: Service[]): TreeNode[] => [...xs].sort(byPrice).map((service) => ({ kind: "leaf" as const, service }));

function byBrand(xs: Service[], order: readonly string[]): TreeNode[] {
  const m = new Map<string, Service[]>();
  for (const s of xs) { const k = s.brand?.trim() || "More"; m.set(k, [...(m.get(k) ?? []), s]); }
  const rank = (k: string) => { const i = order.indexOf(k); return i < 0 ? 99 : i; };
  return [...m.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([k, v]) => ({ kind: "branch" as const, key: k, label: k, children: leaves(v) }));
}

/** The type a service belongs to: listed id first, then the type's fallback test, else the group's last bookable type so nothing drops out of the app. */
export function typeKeyOf(groupKey: string, s: Service): string | null {
  const defs = SERVICE_TYPES[groupKey];
  if (!defs) return null;
  const real = defs.filter((d) => !d.enquiryOnly);
  return (real.find((d) => d.ids?.includes(s.id)) ?? real.find((d) => d.test?.(s)) ?? real[real.length - 1])?.key ?? null;
}

/**
 * The Services hierarchy for one menu group: type > (brand) > product. Types with services are bookable; market types with no
 * service come last as enquiry-only rows. Groups without a type list (pickup) are a flat list.
 */
export function buildTree(group: Pick<MenuGroup, "key" | "categories">, all: Service[]): TreeNode[] {
  const xs = all.filter((s) => (group.categories as string[]).includes(s.category));
  const defs = SERVICE_TYPES[group.key];
  if (!defs) return leaves(xs);
  const offered: TreeNode[] = [];
  for (const d of defs.filter((x) => !x.enquiryOnly)) {
    const mine = xs.filter((s) => typeKeyOf(group.key, s) === d.key);
    if (mine.length === 0) continue;
    offered.push({ kind: "branch", key: d.key, label: d.label, ...(d.blurb ? { blurb: d.blurb } : {}), children: d.byBrand ? byBrand(mine, d.byBrand) : leaves(mine) });
  }
  const asks: TreeNode[] = defs.filter((d) => d.enquiryOnly).map((d) => ({ kind: "enquiry" as const, key: d.key, label: d.label, ...(d.blurb ? { blurb: d.blurb } : {}) }));
  return [...offered, ...asks];
}

/** Descend by path keys; a branch with exactly one branch child is opened automatically so nobody taps through a pointless level. */
export function resolvePath(tree: TreeNode[], path: string[]): { nodes: TreeNode[]; trail: Array<{ key: string; label: string }> } {
  let nodes = tree;
  const trail: Array<{ key: string; label: string }> = [];
  const step = (key: string | undefined) => {
    const hit = nodes.find((n): n is Extract<TreeNode, { kind: "branch" }> => n.kind === "branch" && (key === undefined || n.key === key));
    if (!hit) return false;
    trail.push({ key: hit.key, label: hit.label });
    nodes = hit.children;
    return true;
  };
  for (const k of path) if (!step(k)) break;
  while (nodes.length === 1 && nodes[0]!.kind === "branch") step(undefined);
  return { nodes, trail };
}

/** Services under a node, for the "n options, from price" line on a tile. */
export function leafServices(n: TreeNode): Service[] {
  return n.kind === "leaf" ? [n.service] : n.kind === "branch" ? n.children.flatMap(leafServices) : [];
}

/** Path to the first branch with this label, for old ?brand= links. */
export function pathToLabel(tree: TreeNode[], label: string, prefix: string[] = []): string[] | null {
  for (const n of tree) {
    if (n.kind !== "branch") continue;
    if (n.label === label || n.key === label) return [...prefix, n.key];
    const sub = pathToLabel(n.children, label, [...prefix, n.key]);
    if (sub) return sub;
  }
  return null;
}

/** Words people type that name a type rather than a product. A service matches when its name, brand or type label has the word, or an alias points at its type. */
export const TYPE_ALIASES: Record<string, string[]> = {
  graphene: ["graphene"], ceramic: ["ceramic", "nano"], glass: ["glass", "windshield", "windscreen"], wheels: ["wheel", "alloy", "rim"],
  leather: ["leather"], fabric: ["fabric", "upholstery", "seat cover"], trim: ["trim", "plastic", "bumper"], tyres: ["tyre", "tire", "alignment", "balancing"],
  battery: ["battery", "electrical"], ac: ["ac", "a/c", "air con", "cooling"], checks: ["check", "inspection", "diagnostic"], wraps: ["wrap", "vinyl", "colour change", "color change"],
  film: ["tint", "window film", "sun film"], colour: ["colour", "color", "black ppf"], exterior: ["wash", "foam"], interior: ["interior", "vacuum"], complete: ["detail", "detailing"],
};

export function matchesQuery(s: Service, q: string): boolean {
  if (`${s.name} ${s.brand ?? ""}`.toLowerCase().includes(q)) return true;
  const groups = Object.keys(SERVICE_TYPES);
  for (const g of groups) {
    const key = typeKeyOf(g, s);
    if (!key || !SERVICE_TYPES[g]!.some((d) => !d.enquiryOnly && d.key === key && (d.ids?.includes(s.id) || d.test?.(s)))) continue;
    if ((TYPE_ALIASES[key] ?? []).some((a) => a.includes(q) || q.includes(a))) return true;
  }
  return false;
}

// Sub-headings inside a category, by the part of the car the work is on (Meet picked this grouping, 19 Oct). Types are placed by key,
// so no stored data changes. Every type of a sectioned category must be listed exactly once (guarded in services-tree.test.ts).
export const AREA_SECTIONS: Record<string, Array<{ label: string; keys: string[] }>> = {
  wash: [
    { label: "Exterior", keys: ["exterior", "complete", "trim-restore"] },
    { label: "Interior", keys: ["interior", "leather-care", "odour"] },
    { label: "Wheels and tyres", keys: ["wheel-clean"] },
    { label: "Glass and lights", keys: ["glass-clean", "lamps"] },
    { label: "Paint", keys: ["decon", "polish"] },
  ],
  coatings: [
    { label: "Paint", keys: ["ceramic", "graphene", "matte", "ppf-coat"] },
    { label: "Exterior", keys: ["trim"] },
    { label: "Interior", keys: ["leather", "fabric", "dashboard"] },
    { label: "Wheels and tyres", keys: ["wheels", "tyre"] },
    { label: "Glass and lights", keys: ["glass"] },
  ],
  garage: [
    { label: "Health checks", keys: ["checks", "battery", "ac", "periodic"] },
    { label: "Wheels and tyres", keys: ["tyres"] },
    { label: "Repairs", keys: ["repairs", "brakes", "suspension", "rust"] },
  ],
};

/** Split a category's top-level nodes into area sections, in section order. A category with no sections, or a node with an unknown key, stays visible (unknown keys go last, unlabelled). */
export function areaSections(groupKey: string, nodes: TreeNode[]): Array<{ label: string; nodes: TreeNode[] }> {
  const defs = AREA_SECTIONS[groupKey];
  if (!defs) return [{ label: "", nodes }];
  const keyOf = (n: TreeNode): string => (n.kind === "leaf" ? n.service.id : n.key);
  const out = defs.map((d) => ({ label: d.label, nodes: nodes.filter((n) => d.keys.includes(keyOf(n))) })).filter((s) => s.nodes.length > 0);
  const placed = new Set(defs.flatMap((d) => d.keys));
  const rest = nodes.filter((n) => !placed.has(keyOf(n)));
  return rest.length ? [...out, { label: out.length ? "More" : "", nodes: rest }] : out;
}
