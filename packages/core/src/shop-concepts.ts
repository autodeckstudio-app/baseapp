/**
 * AutoDeck Store concept catalogue, 23 Oct 2026. BROWSE-ONLY placeholder
 * content: the store is not open, nothing here has a price, and no concept
 * can be ordered. Departments match the public site (Scent, Clothing,
 * Car accessories). Names are working titles — merch name/image pairing is
 * an open owner decision ("Built not bought" vs "Built in silence"), so
 * nothing here commits to final prints, names or imagery.
 */
export interface ShopConcept {
  id: string;
  name: string;
  department: "Scent" | "Clothing" | "Car accessories";
  /** Tile label when it differs from the department (e.g. caps shown as Objects). */
  label?: string;
  /** Limited drops surface only under "All", not under a department chip. */
  limited?: boolean;
  blurb: string;
}

export const SHOP_CONCEPTS: ShopConcept[] = [
  { id: "concept-scent-01", name: "Studio scent No. 1", department: "Scent", blurb: "The way the studio smells on a good day. Concept." },
  { id: "concept-scent-02", name: "Night detail scent", department: "Scent", blurb: "A darker take, for after the late shift. Concept." },
  { id: "concept-tee-01", name: "Heavyweight tee, front print", department: "Clothing", label: "Apparel", blurb: "Thick cotton, small front mark. Concept." },
  { id: "concept-tee-02", name: "Heavyweight tee, back print", department: "Clothing", label: "Apparel", blurb: "The big back statement. Print pairing undecided. Concept." },
  { id: "concept-tee-03", name: "Long-sleeve detail tee", department: "Clothing", label: "Apparel", blurb: "Sleeve hits inspired by panel lines. Concept." },
  { id: "concept-hoodie-01", name: "Studio hoodie", department: "Clothing", label: "Apparel", blurb: "Heavy fleece, tonal logo. Concept." },
  { id: "concept-cap-01", name: "Five-panel cap", department: "Clothing", label: "Objects", blurb: "Low-profile, embroidered mark. Concept." },
  { id: "concept-cap-02", name: "Snapback cap", department: "Clothing", label: "Objects", blurb: "Structured crown, side hit. Concept." },
  { id: "concept-acc-01", name: "Leather key loop", department: "Car accessories", blurb: "For the keys that matter. Concept." },
  { id: "concept-acc-02", name: "Sunshade, AutoDeck print", department: "Car accessories", blurb: "Keeps the cabin cool, looks like ours. Concept." },
  { id: "concept-drop-01", name: "Launch drop tee", department: "Clothing", limited: true, blurb: "First-run limited piece. Concept." },
  { id: "concept-drop-02", name: "Launch drop scent", department: "Scent", limited: true, blurb: "Numbered first batch. Concept." },
];
