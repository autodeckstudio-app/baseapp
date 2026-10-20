// The Services "All" view: one card per category, the same categories as the filter pills, each with its approved photo.
// Tapping a card opens that category's filter view. Pure, so the mapping is tested.
import type { MenuGroup, ServiceCategory } from "@autodeck/core";

/** Which approved category photograph each menu group uses. Pickup uses the approved key-handover image (generated/pickup.jpg), never the icon tile. */
export const GROUP_PHOTO_CATEGORY: Record<string, ServiceCategory | null> = {
  wash: "washing",
  coatings: "ceramic",
  ppf: "ppf",
  garage: "garage",
  mods: "modifications",
  pickup: "pickup",
};

/** The categories shown as cards: exactly the ones the filter pills offer (those with at least one service), in the same order. */
export function overviewGroups(groups: MenuGroup[], countIn: (g: MenuGroup) => number): MenuGroup[] {
  return groups.filter((g) => countIn(g) > 0);
}
