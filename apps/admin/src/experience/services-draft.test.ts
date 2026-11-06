import { describe, expect, it } from "vitest";
import { EMPTY_SERVICE, toServicePayload } from "./services-draft";

const base = { ...EMPTY_SERVICE, name: "Ceramic coat", description: "Long-lasting gloss.", priceRupees: "18450", minutes: "240" };

describe("toServicePayload", () => {
  it("converts rupees to paise", () => {
    const r = toServicePayload(base);
    expect(r.ok && r.payload.basePrice).toBe(1845000);
  });
  it("needs a positive price", () => expect(toServicePayload({ ...base, priceRupees: "0" }).ok).toBe(false));
  it("lifetime warranty carries no value", () => {
    const r = toServicePayload({ ...base, warrantyUnit: "lifetime", warrantyValue: "5" });
    expect(r.ok && [r.payload.warrantyDurationUnit, r.payload.warrantyDurationValue]).toEqual(["lifetime", null]);
  });
  it("timed warranty needs a whole number", () => expect(toServicePayload({ ...base, warrantyUnit: "years", warrantyValue: "" }).ok).toBe(false));
  it("rejects duplicate size rules", () => {
    const s = { vehicleCategory: "suv" as const, extraRupees: "500", extraMinutes: "30" };
    expect(toServicePayload({ ...base, sizes: [s, s] }).ok).toBe(false);
  });
  it("size rule extra price goes to paise", () => {
    const r = toServicePayload({ ...base, sizes: [{ vehicleCategory: "suv", extraRupees: "1500", extraMinutes: "45" }] });
    expect(r.ok && r.payload.vehicleCategoryPricing[0]).toEqual({ vehicleCategory: "suv", additionalPricePaise: 150000, additionalMinutes: 45 });
  });
});

describe("saved size rules survive on non-PPF services (rules hidden in the editor, not deleted)", () => {
  const rules = [{ vehicleCategory: "suv" as const, extraRupees: "500", extraMinutes: "30" }];
  it("a washing draft with saved rules still builds them into the payload unchanged", () => {
    const r = toServicePayload({ ...base, category: "washing", sizes: rules });
    expect(r.ok && r.payload.vehicleCategoryPricing).toEqual([{ vehicleCategory: "suv", additionalPricePaise: 50000, additionalMinutes: 30 }]);
  });
  it("switching category ppf -> washing -> ppf keeps the same rules (draft spread only changes category)", () => {
    const d0 = { ...base, category: "ppf" as const, sizes: rules };
    const d1 = { ...d0, ...{ category: "washing" as const } };
    const d2 = { ...d1, ...{ category: "ppf" as const } };
    expect(d2.sizes).toEqual(rules);
    const r = toServicePayload(d1);
    expect(r.ok && r.payload.vehicleCategoryPricing.length).toBe(1);
  });
});

it('does not infer or overwrite a staff rating on unrelated saves',()=>{const r=toServicePayload({...base,name:'Ceramic Coating 1-Year B',internalRating:'C',ratingChanged:false});expect(r.ok && r.payload.name).toBe('Ceramic Coating 1-Year');expect(r.ok && Object.prototype.hasOwnProperty.call(r.payload,'internalRating')).toBe(false);const blank=toServicePayload({...base});expect(blank.ok && Object.prototype.hasOwnProperty.call(blank.payload,'internalRating')).toBe(false);});
it('only an explicit staff rating edit sends a value or deliberate clear',()=>{const r=toServicePayload({...base,internalRating:'D',ratingChanged:true});expect(r.ok&&r.payload.internalRating).toBe('D');const clear=toServicePayload({...base,internalRating:null,ratingChanged:true});expect(clear.ok&&clear.payload.internalRating).toBe(null);});

it('allows a quote-only service without an invented price, still rejects negative/invalid money',()=>{for(const priceRupees of ['', '0']){const r=toServicePayload({...base,priceMode:'consult',priceRupees});expect(r.ok&&r.payload.basePrice).toBe(0);expect(r.ok&&r.payload.priceOnRequest).toBe(true);}for(const priceRupees of ['-1','bad'])expect(toServicePayload({...base,priceMode:'consult',priceRupees}).ok).toBe(false);});
it('clears a photo only after an explicit removal and preserves omission on unrelated saves',()=>{const r=toServicePayload({...base,imageUrl:'',imageChanged:true});expect(r.ok&&r.payload.imageUrl).toBe(null);const untouched=toServicePayload({...base,imageUrl:''});expect(untouched.ok&&Object.hasOwn(untouched.payload,'imageUrl')).toBe(false);});
