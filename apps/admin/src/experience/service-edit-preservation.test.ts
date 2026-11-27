import { it, expect } from "vitest";
import { preserveUneditedServiceFields } from "./service-edit-preservation";
import { draftFromService, toServicePayload } from "./services-draft";
import { catalogueChangeLines } from "./catalogue-publish-review";
const source: any = {
  id: "svc-wash-regular",
  name: "Regular Wash",
  brand: "Standard",
  description: "Foam wash",
  category: "washing",
  basePrice: 60000,
  estimatedDurationMinutes: 60,
  warrantyLabel: null,
  warrantyDurationValue: null,
  warrantyDurationUnit: null,
  requiredBayType: "wash",
  displayOrder: 1,
  membershipWashEligible: true,
  vehicleCategoryPricing: [],
  customerMenu: {
    home: "washing",
    family: "Exterior wash",
    priceMode: "fixed",
    priceNote: "",
    priceCondition: "",
  },
};
it("price-only edits do not materialize five absent optional defaults or change any accepted field", () => {
  const d = draftFromService(source);
  d.priceRupees = "650";
  const result = toServicePayload(d);
  if (!result.ok) throw Error();
  const payload = preserveUneditedServiceFields(result.payload, source);
  const changes = Object.entries(payload).filter(
    ([k, v]) => JSON.stringify(v) !== JSON.stringify(source[k]),
  );
  expect(changes).toEqual([["basePrice", 65000]]);
  for (const key of [
    "priceEstimate",
    "careTips",
    "coverageLevel",
    "priceFrom",
    "priceOnRequest",
  ])
    expect(Object.hasOwn(payload, key)).toBe(false);
  expect(catalogueChangeLines({ payload } as any, source)).toEqual([
    "Price: ₹600 → ₹650",
  ]);
});
it("meaningful description edits remain visible; unedited fixed-mode notes survive family edits", () => {
  const s = {
    ...source,
    name: "Regular Wash",
    description: "Foam wash",
    customerMenu: { ...source.customerMenu, priceNote: "Accepted note" },
  };
  const d = draftFromService(s);
  d.priceRupees = "650";
  const result = toServicePayload(d);
  if (!result.ok) throw Error();
  const payload = preserveUneditedServiceFields(result.payload, s);
  expect(payload.description).toBe("Foam wash");
  expect(payload.customerMenu).toEqual(s.customerMenu);
  d.customerMenu!.family = "Updated wash family";
  d.description = "New included work";
  const edited = toServicePayload(d);
  if (!edited.ok) throw Error();
  const changed = preserveUneditedServiceFields(edited.payload, s);
  expect(changed.description).toBe("New included work");
  expect(changed.customerMenu?.priceNote).toBe("Accepted note");
  expect(changed.customerMenu?.family).toBe("Updated wash family");
});

it("untouched duplicate-wash flags stay absent; a checked flag is saved and shown in review; an unchecked stored flag saves false", () => {
  const d = draftFromService(source);
  d.priceRupees = "650";
  const priceOnly = toServicePayload(d);
  if (!priceOnly.ok) throw Error();
  const kept = preserveUneditedServiceFields(priceOnly.payload, source);
  expect(Object.hasOwn(kept, "standaloneExteriorWash")).toBe(false);
  expect(Object.hasOwn(kept, "includesExteriorWash")).toBe(false);

  const checked = toServicePayload({ ...draftFromService(source), includesExteriorWash: true });
  if (!checked.ok) throw Error();
  const withFlag = preserveUneditedServiceFields(checked.payload, source);
  expect(withFlag.includesExteriorWash).toBe(true);
  expect(Object.hasOwn(withFlag, "standaloneExteriorWash")).toBe(false);
  expect(catalogueChangeLines({ payload: withFlag } as any, source)).toEqual(["Includes Exterior Wash: None → Yes"]);

  const storedTrue = { ...source, standaloneExteriorWash: true };
  const unchecked = toServicePayload({ ...draftFromService(storedTrue), standaloneExteriorWash: false });
  if (!unchecked.ok) throw Error();
  const cleared = preserveUneditedServiceFields(unchecked.payload, storedTrue);
  expect(cleared.standaloneExteriorWash).toBe(false);
  expect(catalogueChangeLines({ payload: cleared } as any, storedTrue)).toEqual(["Standalone Exterior Wash: Yes → No"]);
});
