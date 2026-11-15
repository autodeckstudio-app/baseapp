"use client";
import { Icon } from "./Icon";
import type { IconName } from "@autodeck/ui/theme";

// Services and pricing: the menu customers book from. Grouped by kind, each
// row shows starting price, time and warranty; the editor opens in a drawer.
import { useState, useEffect } from "react";
import type { BayType, Service, ServiceCategory, VehicleCategory, WarrantyDurationUnit } from "@autodeck/core";
import { formatDuration, alignedCustomerPriceLabel, alignedCustomerWarranty, SERVICE_HOMES, HOME_COPY, alignedCustomerServices, isOnCustomerMenu, servicePlacement, referencePlacement, referenceChoices } from "@autodeck/core";
import { PageHead, Toolbar, Segmented, Drawer } from "./Office";
import { formatPaise } from "../lib/format";
import { uploadServiceImage } from "../lib/service-image";
import { EMPTY_SERVICE, draftFromService, toServicePayload, type ServiceDraft, type ServicePayload } from "./services-draft";

export const CATEGORY_NAME: Record<ServiceCategory, string> = { washing: "Wash and care", ceramic: "Ceramic", ppf: "Paint film", coating: "Coatings", tinting: "Window film", inspection: "Inspection", other: "More", garage: "Garage", modifications: "Modifications and wraps", pickup: "Pickup and drop" };
const CATEGORY_BLURB: Record<ServiceCategory, string> = { washing: "Quick, safe cleans", ceramic: "Deep gloss that lasts", ppf: "Stone-chip armour", coating: "Shine and easy upkeep", tinting: "Heat and privacy", inspection: "Know before you fix", other: "Extras", garage: "Health checks and repairs", modifications: "Consult only", pickup: "Flat-rate pickup and drop" };
const CATEGORY_ICON: Record<ServiceCategory, IconName> = { washing: "wash", ceramic: "ceramic", ppf: "ppf", coating: "coating", tinting: "tint", inspection: "inspect", other: "tools", garage: "inspect", modifications: "tools", pickup: "tools" };
// Same order the customer app shows.
const CATEGORIES: ServiceCategory[] = ["washing", "ceramic", "coating", "ppf", "garage", "modifications", "pickup", "tinting", "inspection", "other"];
const SIZE_NAME: Record<VehicleCategory, string> = { hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", luxury: "SUV (old)", commercial: "Commercial", van: "MUV / XUV" };
const SIZES = Object.keys(SIZE_NAME) as VehicleCategory[];
const BAY_NAME: Record<BayType, string> = { wash: "Wash bay", protection: "Protection bay", general: "Any bay" };
const UNIT_NAME: Record<WarrantyDurationUnit, string> = { days: "Days", months: "Months", years: "Years", lifetime: "Lifetime" };

export function duration(mins: number): string {
  return formatDuration(mins);
}

function warranty(s:Service):string|null{return isOnCustomerMenu(s)?alignedCustomerWarranty(s).warrantyLabel:s.warrantyLabel;}

export function ServicesView(p: {
  services: Service[];
  draftMode?: boolean;
  onOpenLive?:()=>void;
  onCloseDraft?:()=>void;
  incomingDraft?: {key:string;value:ServiceDraft}|null;
  loading: boolean;
  error: string | null;
  message: string | null;
  busy: boolean;
  onSave: (serviceId: string | null, payload: ServicePayload) => void | Promise<boolean>;
  onToggle: (s: Service) => void;
}) {
  const [cat, setCat] = useState<string>("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<ServiceDraft | null>(null);
  useEffect(()=>{if(p.incomingDraft)setDraft(p.incomingDraft.value)},[p.incomingDraft?.key]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const q = search.trim().toLowerCase();
  const menu=alignedCustomerServices(p.services);
  const references=referenceChoices(p.services);
  const storedCount=p.services.filter(s=>s.catalogueEntryKind==='enquiry'?!references.some(r=>r.key===s.referenceKey):!isOnCustomerMenu(s)).length;
  const displayHome=(s:Service)=>isOnCustomerMenu(s)?servicePlacement(s)!.home:'stored';
  const rows=p.services.filter(s=>s.catalogueEntryKind!=='enquiry'&&(cat==='stored'?displayHome(s)==='stored':isOnCustomerMenu(s)&&(!cat||displayHome(s)===cat))&&(!q||`${s.name} ${s.brand??''} ${servicePlacement(s)?.family??''}`.toLowerCase().includes(q)));
  const storedReferences=cat==='stored'?p.services.filter(s=>s.catalogueEntryKind==='enquiry'&&!references.some(r=>r.key===s.referenceKey)&&(!q||`${s.name} ${s.brand??''}`.toLowerCase().includes(q))):[];
  const refRows=(cat==='stored'?[]:references).filter(r=>(!cat||referencePlacement(r).home===cat)&&(!q||`${r.name} ${r.brand??''} ${referencePlacement(r).family}`.toLowerCase().includes(q)));
  const present=[...SERVICE_HOMES.map(h=>h.key)].filter(key=>p.services.some(s=>displayHome(s)===key)||references.some(r=>referencePlacement(r).home===key));
  const groups=(cat==='stored'?['stored']:present).filter(key=>storedReferences.length>0||rows.some(s=>displayHome(s)===key)||refRows.some(r=>referencePlacement(r).home===key));
  const groupLabel=(key:string)=>SERVICE_HOMES.find(h=>h.key===key)?.label??'Stored records';
  const groupCopy=(key:string)=>key==='stored'?'Not shown in the customer catalogue':HOME_COPY[key as keyof typeof HOME_COPY];
  const groupIcon=(key:string):IconName=>key==='paint'?'ceramic':key==='detailing'?'coating':key==='washing'?'wash':key==='garage'?'inspect':'tools';
  const result = draft ? toServicePayload(draft) : null;
  const set = (patch: Partial<ServiceDraft>) => draft && setDraft({ ...draft, ...patch });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try { const url = await uploadServiceImage(file); setDraft((d) => (d ? { ...d, imageUrl: url, imageChanged: true } : d)); }
    catch (e) { setPhotoError(e instanceof Error ? e.message : "Upload failed. Try again."); }
    finally { setPhotoBusy(false); }
  };

  return (
    <div className="ax-page ax-pricing-page">
      <style>{`@media(max-width:480px){.ax-service-fields{grid-template-columns:minmax(0,1fr)!important;}}`}</style>
      <PageHead eyebrow="Office" title="Pricing" kpis={[{ value: menu.length+references.length, label: "On the menu", tone: "premium" }, { value: storedCount, label: "Stored only" }]}>
        <button type="button" className="ax-button ax-button--primary" onClick={() => {p.onOpenLive?.();setDraft(EMPTY_SERVICE)}}>New service</button>
      </PageHead>
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}
      {p.services.length>menu.length?<details style={{margin:'12px 0'}}><summary>Stored history ({storedCount})</summary><p className="ax-sub">Not part of the working menu. Past records stay intact.</p><button type="button" className="ax-button" onClick={()=>setCat(cat==='stored'?'':'stored')}>{cat==='stored'?'Return to working menu':'View stored records'}</button></details>:null}
      <Toolbar count={{ shown: rows.length+refRows.length, total: cat==='stored'?storedCount:menu.length+references.length }}>
        <Segmented value={cat} onChange={setCat} options={[{ value: "", label: "All" }, ...present.map((c) => ({ value: c, label: groupLabel(c) }))]} />
        <input className="ax-search" type="search" placeholder="Search services" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Toolbar>

      {p.loading ? (
        <div className="ax-list">{[0, 1, 2, 3].map((i) => <div key={i} className="ax-skel ax-skel--row" />)}</div>
      ) : rows.length+refRows.length === 0 ? (
        <div className="ax-panel ax-empty">
          <p className="ax-title">{p.services.length ? "Nothing matches" : "Your menu is empty"}</p>
          <p>{p.services.length ? "Try another kind or search." : "Add your first service so customers can book it."}</p>
        </div>
      ) : (
        groups.map((g) => {
          const inCat = rows.filter((s) => displayHome(s) === g);
          const inRefs=refRows.filter(r=>referencePlacement(r).home===g);
          const brands = Array.from(new Set([...inCat.map((s) => s.brand || ""),...inRefs.map(r=>r.brand||"")])).sort((x, y) => (x === "" ? 1 : y === "" ? -1 : x.localeCompare(y)));
          return (
            <section key={g} className="ax-svc-group">
              <div className="ax-cat-head">
                <span className="ax-cat-icon" aria-hidden="true"><Icon name={groupIcon(g)} size={30} /></span>
                <div><p className="ax-cat-name">{groupLabel(g)}</p><p className="ax-sub">{groupCopy(g)} · {inCat.length+inRefs.length}</p></div>
              </div>
              {brands.map((b) => (
                <div key={b || "none"} className="ax-brand-block">
                  {brands.length > 1 || b ? <p className="ax-label">{b || "Other"}</p> : null}
                  <div className="ax-svc-cards">
                    {inCat.filter((s) => (s.brand || "") === b).map((s) => (
                      <div key={s.id} className={`ax-svc-card${s.active ? "" : " is-hidden"}`}>
                        <div className="ax-svc-card-top">
                          <span className="ax-person-name">{s.name}</span>
                          {s.internalRating ? <span className="ax-chip">Internal rating: {s.internalRating}</span> : null}
                          {isOnCustomerMenu(s)?<span className="ax-chip">{servicePlacement(s)?.family}</span>:<span className="ax-chip">{s.active?'Not on customer menu':'Hidden'}</span>}
                        </div>
                        {s.description ? <p className="ax-sub ax-svc-desc">{s.description}</p> : null}
                        <div className="ax-svc-card-price">
                          <span className="ax-data ax-svc-from">{isOnCustomerMenu(s)?alignedCustomerPriceLabel(s):s.priceOnRequest?"Quote on request":`${s.priceFrom||s.vehicleCategoryPricing.length > 0 ? "From " : ""}${formatPaise(s.basePrice)}`}</span>
                          <span className="ax-sub">{duration(s.estimatedDurationMinutes)}{warranty(s) ? ` · ${warranty(s)}` : ""}{s.membershipWashEligible ? " · member wash" : ""}</span>
                        </div>
                        <div className="ax-row-actions">
                          <button type="button" className="ax-button" onClick={() => {p.onOpenLive?.();setDraft(draftFromService(s))}}>Edit</button>
                          {confirmId === s.id ? (
                            <>
                              <button type="button" className={`ax-button${s.active ? " ax-button--danger" : ""}`} disabled={p.busy} onClick={() => { p.onToggle(s); setConfirmId(null); }}>{p.draftMode ? (s.active ? "Draft removal from menu" : "Draft show on menu") : s.active ? "Remove from menu" : "Show on menu"}</button>
                              <button type="button" className="ax-button" onClick={() => setConfirmId(null)}>Cancel</button>
                            </>
                          ) : (
                            <button type="button" className="ax-button" onClick={() => setConfirmId(s.id)}>{s.active ? "Remove from menu" : "Show on menu"}</button>
                          )}
                        </div>
                      </div>
                    ))}
                    {inRefs.filter(r=>(r.brand||'')===b).map(r=><div key={'reference:'+r.key} className="ax-svc-card"><div className="ax-svc-card-top"><span className="ax-person-name">{r.brand&& !r.name.toLowerCase().startsWith(r.brand.toLowerCase())?`${r.brand} ${r.name}`:r.name}</span><span className="ax-chip">{referencePlacement(r).family}</span></div><p className="ax-sub ax-svc-desc">{r.note}</p><div className="ax-svc-card-price"><span className="ax-data ax-svc-from">Quote to confirm</span><span className="ax-sub">Customer enquiry option, not a priced booking</span></div>{(()=>{const record=p.services.find(s=>s.catalogueEntryKind==='enquiry'&&s.referenceKey===r.key);return record?<div className="ax-svc-card-actions"><button type="button" className="ax-button" disabled={p.busy} onClick={()=>setDraft(draftFromService(record))}>Edit</button>{confirmId===record.id?<><p className="ax-sub">Remove from new enquiries? Existing quotes are kept.</p><button type="button" className="ax-button ax-button--danger" disabled={p.busy} onClick={()=>{p.onToggle(record);setConfirmId(null)}}>{p.draftMode?'Draft removal from menu':'Remove from menu'}</button><button type="button" className="ax-button" onClick={()=>setConfirmId(null)}>Cancel</button></>:<button type="button" className="ax-button" onClick={()=>setConfirmId(record.id)}>Remove from menu</button>}</div>:<p className="ax-sub">Available to edit after catalogue setup.</p>})()}</div>)}
                  </div>
                </div>
              ))}
            </section>
          );
        })
      )}

      {storedReferences.map(s=><div className="ax-svc-card" key={s.id}><span className="ax-person-name">{s.name}</span><p className="ax-sub">Removed enquiry. Existing quote records are kept.</p><div className="ax-svc-card-actions"><button type="button" className="ax-button" disabled={p.busy} onClick={()=>setDraft(draftFromService(s))}>Edit</button><button type="button" className="ax-button" disabled={p.busy} onClick={()=>p.onToggle(s)}>{p.draftMode?'Draft show on menu':'Show on menu'}</button></div></div>)}
      {draft && (
        <Drawer portal eyebrow={draft.serviceId ? "Edit service" : "New service"} title={draft.name || "Untitled service"} onClose={() => {setDraft(null);p.onCloseDraft?.()}}>
          <form className="ax-service-editor" onSubmit={async(e) => { e.preventDefault(); if (result?.ok) { const saved=await p.onSave(draft.serviceId, result.payload);if(saved!==false)setDraft(null); } }}>
            <label className="ax-form-row"><span>Customer menu section</span><select value={draft.customerMenu?.home??''} onChange={e=>set({customerMenu:{home:e.target.value as 'paint'|'detailing'|'washing'|'garage'|'modifications',family:draft.customerMenu?.family??'',priceMode:draft.customerMenu?.priceMode??'fixed',priceNote:draft.customerMenu?.priceNote??'',priceCondition:draft.customerMenu?.priceCondition??''}})}><option value="">Choose section</option>{SERVICE_HOMES.map(h=><option key={h.key} value={h.key}>{h.label}</option>)}</select></label>
            <label className="ax-form-row"><span>Service group</span><input value={draft.customerMenu?.family??''} onChange={e=>set({customerMenu:{home:draft.customerMenu?.home??'washing',family:e.target.value,priceMode:draft.customerMenu?.priceMode??'fixed',priceNote:draft.customerMenu?.priceNote??'',priceCondition:draft.customerMenu?.priceCondition??''}})} placeholder="For example, Exterior wash"/></label>
            {draft.customerMenu&&draft.priceMode!=='fixed'?<><label className="ax-form-row"><span>Price note shown to customers</span><textarea value={draft.customerMenu.priceNote} onChange={e=>set({customerMenu:{...draft.customerMenu!,priceNote:e.target.value}})} maxLength={700}/></label><label className="ax-form-row"><span>Price condition</span><input value={draft.customerMenu.priceCondition} onChange={e=>set({customerMenu:{...draft.customerMenu!,priceCondition:e.target.value}})} maxLength={200}/></label></>:null}

            <label className="ax-form-row"><span>Name customers see</span><input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ceramic coat" /></label>
            <label className="ax-form-row"><span>Staff rating</span><select value={draft.internalRating ?? ""} onChange={(e) => set({ratingChanged:true, internalRating: e.target.value ? e.target.value as "A" | "B" | "C" | "D" : null})}><option value="">Unrated</option>{["A", "B", "C", "D"].map(r => <option key={r} value={r}>{r}</option>)}</select><small>Staff only; keep public details factual.</small></label>
            <div className="ax-form-pair ax-service-fields">
              <label className="ax-form-row"><span>Kind</span>
                <select value={draft.category} onChange={(e) => set({ category: e.target.value as ServiceCategory })}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_NAME[c]}</option>)}</select>
              </label>
              <label className="ax-form-row"><span>Brand (optional)</span><input value={draft.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="e.g. Gyeon" /></label>
            </div>
            <div className="ax-form-pair ax-service-fields">
              <label className="ax-form-row"><span>PPF coverage</span>
                <select value={draft.coverageLevel} onChange={(e) => set({ coverageLevel: e.target.value as ServiceDraft["coverageLevel"] })}>
                  <option value="">Not applicable</option><option value="high_impact">High-impact kit</option><option value="full_front">Full front</option><option value="full_body">Full body</option>
                </select>
              </label>
              <label className="ax-form-row"><span>How the price shows</span>
                <select disabled={draft.catalogueEntryKind==='enquiry'} value={draft.priceMode} onChange={(e) => set({ priceMode: e.target.value as ServiceDraft["priceMode"] })}>
                  <option value="fixed">Exact price</option><option value="from">From price</option><option value="consult">Consult (no price shown)</option>
                </select>
              </label>
            </div>
            <div className="ax-form-row">
              <span>Service photo (optional)</span>
              <p className="ax-sub">Customer card photo · wide · 1200px+.</p>
              {draft.imageUrl ? <img src={draft.imageUrl} alt="Service photo" style={{ width: "100%", maxWidth: 280, height: 150, objectFit: "cover", borderRadius: 14 }} /> : <p className="ax-sub">No photo · standard image shown.</p>}
              <input className="ax-service-file" type="file" accept="image/*" disabled={photoBusy} onChange={(e) => void pickPhoto(e.target.files?.[0])} aria-label="Upload service photo" />
              {photoBusy ? <p className="ax-sub">Uploading...</p> : null}
              {photoError ? <p className="ax-status-msg">{photoError}</p> : null}
              {draft.imageUrl ? <button type="button" className="ax-link" onClick={() => set({ imageUrl: "", imageChanged: true })}>Remove photo</button> : null}
            </div>
            <label className="ax-form-row"><span>Included work · customer-facing</span><textarea rows={5} placeholder="Describe the service, then list the included work on separate lines. Only include what the studio actually provides." value={draft.description} onChange={(e) => set({ description: e.target.value })} /></label>
            {draft.internalNotes ? <label className="ax-form-row"><span>Internal notes · staff only</span><textarea rows={3} value={draft.internalNotes} readOnly /></label> : null}

            <p className="ax-label ax-form-section">Price and time</p>{draft.catalogueEntryKind!=='enquiry'?<label className="ax-form-row"><span style={{display:"flex",alignItems:"center",gap:8}}><input style={{width:16,height:16,margin:0,flexShrink:0}} type="checkbox" checked={draft.priceEstimate===true} onChange={e=>set({priceEstimate:e.target.checked})}/> Provisional estimate</span><small>Customers see that the studio must confirm the final amount.</small></label>:null}
            <div className="ax-form-pair ax-service-fields">
              <label className="ax-form-row"><span>{draft.priceMode === "consult" ? "Price reference (₹)" : "Starting price (₹)"}</span><input disabled={draft.catalogueEntryKind==='enquiry'} inputMode="decimal" value={draft.priceRupees} onChange={(e) => set({ priceRupees: e.target.value })} placeholder="1299" /></label>
              <label className="ax-form-row"><span>Time needed (min)</span><input disabled={draft.catalogueEntryKind==='enquiry'} inputMode="numeric" value={draft.minutes} onChange={(e) => set({ minutes: e.target.value })} /></label>
            </div>
            {draft.category === "ppf" ? (
            <>
              <p className="ax-note">Add extra price and time by car size.</p>
              {draft.sizes.length > 0 && <div className="ax-size-rule ax-size-head"><span>Car size</span><span>Extra ₹</span><span>Extra min</span><span /></div>}
              {draft.sizes.map((r, i) => (
                <div key={i} className="ax-size-rule">
                  <select value={r.vehicleCategory} aria-label="Car size" onChange={(e) => set({ sizes: draft.sizes.map((x, j) => (j === i ? { ...x, vehicleCategory: e.target.value as VehicleCategory } : x)) })}>
                    {SIZES.filter((z) => z !== "luxury" || r.vehicleCategory === "luxury").map((z) => <option key={z} value={z}>{SIZE_NAME[z]}</option>)}
                  </select>
                  <input inputMode="decimal" aria-label="Extra price in rupees" placeholder="+₹" value={r.extraRupees} onChange={(e) => set({ sizes: draft.sizes.map((x, j) => (j === i ? { ...x, extraRupees: e.target.value } : x)) })} />
                  <input inputMode="numeric" aria-label="Extra minutes" placeholder="+min" value={r.extraMinutes} onChange={(e) => set({ sizes: draft.sizes.map((x, j) => (j === i ? { ...x, extraMinutes: e.target.value } : x)) })} />
                  <button type="button" className="ax-button" aria-label="Remove rule" onClick={() => set({ sizes: draft.sizes.filter((_, j) => j !== i) })}>×</button>
                </div>
              ))}
              <button type="button" className="ax-button" onClick={() => set({ sizes: [...draft.sizes, { vehicleCategory: SIZES.find((z) => !draft.sizes.some((x) => x.vehicleCategory === z)) ?? "suv", extraRupees: "", extraMinutes: "" }] })}>Add a size rule</button>
            </>
            ) : (
              <p className="ax-note">One price for every car; size rules apply only to PPF.{draft.sizes.length > 0 ? " Size rules saved earlier on this service are kept, not shown, and not used for pricing." : ""}</p>
            )}

            <p className="ax-label ax-form-section">Care tips</p>
            <p className="ax-note">Optional aftercare · shown to customers.</p>
            {draft.careTips.map((tip, i) => (
              <div key={i} className="ax-form-pair ax-service-fields">
                <label className="ax-form-row"><span>Tip {i + 1}</span><input value={tip} maxLength={200} onChange={(e) => set({ careTips: draft.careTips.map((t, j) => (j === i ? e.target.value : t)) })} placeholder="e.g. Wipe bird droppings off early." /></label>
                <div className="ax-form-row">
                  <button type="button" className="ax-button" disabled={i === 0} aria-label={`Move tip ${i + 1} up`} onClick={() => { const n = [...draft.careTips]; [n[i - 1], n[i]] = [n[i]!, n[i - 1]!]; set({ careTips: n }); }}>Up</button>
                  <button type="button" className="ax-button" disabled={i === draft.careTips.length - 1} aria-label={`Move tip ${i + 1} down`} onClick={() => { const n = [...draft.careTips]; [n[i + 1], n[i]] = [n[i]!, n[i + 1]!]; set({ careTips: n }); }}>Down</button>
                  <button type="button" className="ax-button" aria-label={`Remove tip ${i + 1}`} onClick={() => set({ careTips: draft.careTips.filter((_, j) => j !== i) })}>Remove</button>
                </div>
              </div>
            ))}
            {draft.careTips.length < 12 ? <button type="button" className="ax-button" onClick={() => set({ careTips: [...draft.careTips, ""] })}>Add a tip</button> : null}

            <p className="ax-label ax-form-section">Warranty</p>
            <label className="ax-form-row"><span>What it&apos;s called</span><input value={draft.warrantyLabel} onChange={(e) => set({ warrantyLabel: e.target.value })} placeholder="e.g. 5-year film warranty" /></label>
            <div className="ax-form-pair ax-service-fields">
              <label className="ax-form-row"><span>Length</span>
                <select value={draft.warrantyUnit} onChange={(e) => { const u = e.target.value as WarrantyDurationUnit | ""; set({ warrantyUnit: u, warrantyValue: u === "lifetime" || u === "" ? "" : draft.warrantyValue }); }}>
                  <option value="">No warranty</option>
                  {(Object.keys(UNIT_NAME) as WarrantyDurationUnit[]).map((u) => <option key={u} value={u}>{UNIT_NAME[u]}</option>)}
                </select>
              </label>
              <label className="ax-form-row"><span>How many</span><input inputMode="numeric" value={draft.warrantyValue} disabled={!draft.warrantyUnit || draft.warrantyUnit === "lifetime"} onChange={(e) => set({ warrantyValue: e.target.value })} placeholder="5" /></label>
            </div>

            <p className="ax-label ax-form-section">Booking</p>
            <div className="ax-form-pair ax-service-fields">
              <label className="ax-form-row"><span>Needs</span>
                <select value={draft.bay} onChange={(e) => set({ bay: e.target.value as BayType })}>{(Object.keys(BAY_NAME) as BayType[]).map((b) => <option key={b} value={b}>{BAY_NAME[b]}</option>)}</select>
              </label>
              <label className="ax-form-row"><span>Menu position</span><input inputMode="numeric" value={draft.displayOrder} onChange={(e) => set({ displayOrder: e.target.value })} /></label>
            </div>
            <label className="ax-check"><input type="checkbox" checked={draft.washEligible} onChange={(e) => set({ washEligible: e.target.checked })} /> Included member wash</label>

            {result && !result.ok && draft.name && <p className="ax-note" style={{ color: "var(--ad-warning)" }}>{result.problem}</p>}
            <div className="ax-panel-actions">
              <button type="submit" className="ax-button ax-button--primary" disabled={p.busy || !result?.ok}>{p.draftMode ? "Save draft" : draft.serviceId ? "Save changes" : "Add to menu"}</button>
              <button type="button" className="ax-button" onClick={() => {setDraft(null);p.onCloseDraft?.()}}>Cancel</button>
            </div>
            <p className="ax-note">Past bookings, bills and warranties stay unchanged.</p><details><summary>Photo and pricing details</summary><p className="ax-note">Use a real photo of the work, at least 1200px wide. PPF size rules add to the starting price and time; smaller cars pay the starting price. Non-PPF services keep one price per car.</p></details>
          </form>
        </Drawer>
      )}
    </div>
  );
}
