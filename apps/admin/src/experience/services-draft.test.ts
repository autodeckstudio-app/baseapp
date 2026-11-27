import { describe, expect, it } from "vitest";
import { EMPTY_SERVICE, toServicePayload, draftFromService, promoteEnquiryDraft } from "./services-draft";

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
it('enquiry edits preserve identity and cannot add booking money or duration',()=>{const source={id:'enquiry-test',tenantId:'automodz',name:'Reference',brand:null,description:'Reference enquiry only',category:'coating',currency:'INR',vehicleCategoryPricing:[],requiredBayType:'general',membershipWashEligible:false,displayOrder:1,active:true,createdAt:'old',updatedAt:'old',catalogueEntryKind:'enquiry',referenceKey:'checked-reference',referenceGroup:'coatings',estimatedDurationMinutes:0,basePrice:0,priceOnRequest:true}as any;const draft=draftFromService(source);const result=toServicePayload(draft);expect(result.ok).toBe(true);if(result.ok)expect(result.payload).toMatchObject({catalogueEntryKind:'enquiry',referenceKey:'checked-reference',referenceGroup:'coatings',basePrice:0,estimatedDurationMinutes:0});expect(toServicePayload({...draft,minutes:'60'}).ok).toBe(false);expect(toServicePayload({...draft,priceMode:'fixed',priceRupees:'100'}).ok).toBe(false)});

it('round-trips an inspection-only service without creating a quote booking',()=>{const r=toServicePayload({...base,priceMode:'inspection',priceRupees:'0',minutes:'0',customerMenu:{home:'garage',family:'Inspection',priceMode:'inspection',priceNote:'Visit the studio',priceCondition:''}});expect(r.ok).toBe(true);if(!r.ok)return;expect(r.payload).toMatchObject({basePrice:0,estimatedDurationMinutes:0,priceOnRequest:true,priceFrom:false,customerMenu:{priceMode:'inspection'}});const d=draftFromService({...r.payload,id:'inspection-only',tenantId:'automodz',active:true,createdAt:'now',updatedAt:'now',currency:'INR'});expect(d.priceMode).toBe('inspection');expect(toServicePayload(d)).toEqual(r);});
it('refuses priced or timed inspection-only payloads',()=>{for(const patch of[{priceRupees:'10',minutes:'0'},{priceRupees:'0',minutes:'30'}])expect(toServicePayload({...base,priceMode:'inspection',customerMenu:{home:'garage',family:'Inspection',priceMode:'inspection',priceNote:'',priceCondition:''},...patch}).ok).toBe(false)});
it('explicit enquiry promotion strips enquiry bindings from the draft only',()=>{const enquiry={...base,serviceId:'pps',catalogueEntryKind:'enquiry' as const,referenceKey:'pps',referenceGroup:'ppf' as const,referenceSurface:'paint',priceMode:'consult' as const,priceRupees:'0',minutes:'0',customerMenu:{home:'paint' as const,family:'PPS',priceMode:'quote' as const,priceNote:'',priceCondition:''}};const d=promoteEnquiryDraft(enquiry);expect(enquiry.catalogueEntryKind).toBe('enquiry');const r=toServicePayload({...d,priceRupees:'40000',minutes:'480'});expect(r.ok).toBe(true);if(!r.ok)return;expect(r.payload).toMatchObject({basePrice:4000000,estimatedDurationMinutes:480,priceOnRequest:false,customerMenu:{priceMode:'fixed'}});for(const key of['catalogueEntryKind','referenceKey','referenceGroup','referenceSurface'])expect(r.payload).not.toHaveProperty(key)});

it('fixed selling prices and inspection mode clear a legacy estimate flag in the submitted draft',()=>{for(const priceMode of ['fixed','inspection']as const){const r=toServicePayload({...base,priceEstimate:true,priceMode,...(priceMode==='inspection'?{priceRupees:'0',minutes:'0',customerMenu:{home:'garage' as const,family:'Inspection',priceMode:'inspection' as const,priceNote:'',priceCondition:''}}:{})});expect(r.ok).toBe(true);if(r.ok)expect(r.payload.priceEstimate).toBe(false)}});

it.each(['walk_in','coordination']as const)('retains %s booking semantics in ordinary draft edits',bookingMode=>{const source={...base,vehicleCategoryPricing:[],careTips:[],membershipWashEligible:false,priceOnRequest:false,brand:null,warrantyLabel:null,warrantyDurationUnit:null,warrantyDurationValue:null,requiredBayType:'general',displayOrder:0,id:'mode',tenantId:'automodz',active:true,createdAt:'now',updatedAt:'now',currency:'INR',basePrice:bookingMode==='walk_in'?0:180000,estimatedDurationMinutes:0,customerMenu:{home:'garage',family:'Assessment',priceMode:'fixed',priceNote:'',priceCondition:'',bookingMode}}as any;const d=draftFromService(source);const r=toServicePayload({...d,name:'Updated name',description:'Updated scope'});expect(r.ok).toBe(true);if(r.ok){expect(r.payload.customerMenu?.bookingMode).toBe(bookingMode);expect(r.payload.estimatedDurationMinutes).toBe(0);expect(r.payload.basePrice).toBe(source.basePrice)}});

describe("duplicate-wash flags", () => {
  const stored = (() => { const r = toServicePayload(base); if (!r.ok) throw Error(r.problem); const rest: any = { ...r.payload }; delete rest.standaloneExteriorWash; delete rest.includesExteriorWash; return { ...rest, id: "svc-ceramic", tenantId: "automodz", currency: "INR", active: true, createdAt: "t", updatedAt: "t" } as any; })();
  it("a new service starts with both flags off and the payload carries them explicitly", () => {
    expect([EMPTY_SERVICE.standaloneExteriorWash, EMPTY_SERVICE.includesExteriorWash]).toEqual([false, false]);
    const r = toServicePayload(base);
    expect(r.ok && [r.payload.standaloneExteriorWash, r.payload.includesExteriorWash]).toEqual([false, false]);
  });
  it("absent stored flags read as false; set flags round-trip individually", () => {
    expect(draftFromService(stored)).toMatchObject({ standaloneExteriorWash: false, includesExteriorWash: false });
    const d = draftFromService({ ...stored, includesExteriorWash: true });
    expect(d).toMatchObject({ standaloneExteriorWash: false, includesExteriorWash: true });
    const r = toServicePayload({ ...d, standaloneExteriorWash: true });
    expect(r.ok && [r.payload.standaloneExteriorWash, r.payload.includesExteriorWash]).toEqual([true, true]);
  });
  it("flags are never derived from the service category or name", () => {
    expect(draftFromService({ ...stored, category: "ppf", name: "PPF with Exterior Wash" })).toMatchObject({ standaloneExteriorWash: false, includesExteriorWash: false });
    expect(draftFromService({ ...stored, category: "washing", name: "Exterior Wash", requiredBayType: "wash" })).toMatchObject({ standaloneExteriorWash: false, includesExteriorWash: false });
  });
});
