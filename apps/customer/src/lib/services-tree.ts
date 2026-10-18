import { COATING_BRANDS, PPF_BRANDS, garageSectionOf, GARAGE_SECTIONS, type MenuGroup, type Service } from "@autodeck/core";

/** One level of the Services drill-down. A branch opens another level; a leaf is a bookable service. */
export type TreeNode =
  | { kind: "branch"; key: string; label: string; blurb?: string; children: TreeNode[] }
  | { kind: "leaf"; service: Service; section?: string };

const byPrice = (a: Service, b: Service) => Number(a.priceOnRequest === true) - Number(b.priceOnRequest === true) || a.basePrice - b.basePrice;
const leaves = (xs: Service[], section?: (s: Service) => string): TreeNode[] => [...xs].sort(byPrice).map((service) => ({ kind: "leaf" as const, service, ...(section ? { section: section(service) } : {}) }));

function byBrand(xs: Service[], order: readonly string[]): TreeNode[] {
  const m = new Map<string, Service[]>();
  for (const s of xs) { const k = s.brand?.trim() || "More"; m.set(k, [...(m.get(k) ?? []), s]); }
  const rank = (k: string) => { const i = order.indexOf(k); return i < 0 ? 99 : i; };
  return [...m.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([k, v]) => ({ kind: "branch" as const, key: k, label: k, children: leaves(v) }));
}

/**
 * The Services hierarchy for one menu group, built only from what the catalogue holds:
 *  Coatings: type (Ceramic and graphene | Add-ons) > brand > product (1-year, 2-year, ...)
 *  PPF: brand > product (coverage tiers)
 *  Garage: one list in sections (a handful of items, nothing to drill into)
 *  Wash, Modifications, Pickup: a short flat list
 * Types the catalogue has no services for (dashboard, tyre care ...) do not appear; they show up once such services exist.
 */
export function buildTree(group: Pick<MenuGroup, "key" | "categories">, all: Service[]): TreeNode[] {
  const xs = all.filter((s) => (group.categories as string[]).includes(s.category));
  if (group.key === "coatings") {
    const ceramic = xs.filter((s) => s.category === "ceramic");
    const addons = xs.filter((s) => s.category !== "ceramic");
    const out: TreeNode[] = [];
    if (ceramic.length) out.push({ kind: "branch", key: "ceramic", label: "Ceramic and graphene", blurb: "Long-life paint protection, by brand.", children: byBrand(ceramic, COATING_BRANDS) });
    if (addons.length) out.push({ kind: "branch", key: "addons", label: "Surface add-ons", blurb: "Glass, wheels, leather, fabric and trim.", children: leaves(addons) });
    return out;
  }
  if (group.key === "ppf") return byBrand(xs, PPF_BRANDS);
  if (group.key === "garage") {
    const rank = (s: Service) => GARAGE_SECTIONS.indexOf(garageSectionOf(s.id));
    return [...xs].sort((a, b) => rank(a) - rank(b) || byPrice(a, b)).map((service) => ({ kind: "leaf" as const, service, section: garageSectionOf(service.id) }));
  }
  return leaves(xs);
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
  return n.kind === "leaf" ? [n.service] : n.children.flatMap(leafServices);
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
