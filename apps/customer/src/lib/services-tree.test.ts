import { describe, expect, it } from "vitest";
import visibility from "../../../../packages/core/src/customer-offering-visibility.json";
import { customerOfferingVisible } from "./customer-offering-visibility";
import { MENU_GROUPS, MENU_SEED } from "@autodeck/core";
import { type TreeNode, SERVICE_TYPES, buildTree, leafServices, matchesQuery, pathToLabel, resolvePath } from "./services-tree";

const svc = (m: (typeof MENU_SEED)[number]) => ({ id: m.id, tenantId: "t", name: m.name, category: m.category, brand: m.brand, description: m.description, basePrice: m.rupees * 100, priceOnRequest: m.consult === true, estimatedDurationMinutes: m.minutes, coverageLevel: m.coverageLevel, warrantyLabel: m.warrantyLabel, active: true, requiredBayType: m.bay }) as never;
const all = MENU_SEED.map(svc);
const group = (k: string) => MENU_GROUPS.find((g) => g.key === k)!;

const labels = (ns: ReturnType<typeof buildTree>) => ns.map((n) => (n.kind === "leaf" ? n.service.name : n.label));
const kinds = (g: string) => buildTree(group(g), all).map((n) => n.kind);

describe("services type level", () => {
  it("every category opens on types; bookable types first, enquiry-only types last", () => {
    for (const k of ["wash", "coatings", "ppf", "garage", "mods"]) {
      const ks = kinds(k);
      expect(ks.every((x) => x !== "leaf")).toBe(true);
      const firstAsk = ks.indexOf("enquiry");
      if (firstAsk >= 0) expect(ks.slice(firstAsk).every((x) => x === "enquiry")).toBe(true);
    }
  });
  it("coatings: ceramic and graphene are separate types, ceramic goes brand > product", () => {
    const t = buildTree(group("coatings"), all);
    expect(labels(t).slice(0, 2)).toEqual(["Ceramic paint coating", "Graphene paint coating"]);
    expect(resolvePath(t, ["ceramic"]).nodes.map((n) => (n.kind === "branch" ? n.label : ""))).toEqual(["Fireball", "Kovalent", "3M", "AutoDeck Care", "Koch-Chemie"]);
    expect(resolvePath(t, ["ceramic", "Fireball"]).nodes.length).toBe(3);
    const graphene = leafServices(t.find((n) => n.kind === "branch" && n.key === "graphene")!);
    expect(graphene.map((s) => s.id)).toEqual(["menu-coat-kovalent-graphene"]);
  });
  it("unconfirmed tyre and dashboard protection have no enquiry offer or year tier", () => {
    const t = buildTree(group("coatings"), all);
    for (const k of ["tyre", "dashboard"]) expect(t.find((n) => n.kind === "enquiry" && n.key === k)).toBeUndefined();
    const years = leafServices({ kind: "branch", key: "x", label: "x", children: t.filter((n) => n.kind === "branch") }).filter((s) => /year/i.test(s.warrantyLabel ?? ""));
    expect(years.every((s) => /^menu-coat-(autodeck|fireball|kovalent)/.test(s.id))).toBe(true);
  });
  it("ppf: colour is a film type, never a brand; service brands are the four real ones", () => {
    const t = buildTree(group("ppf"), all);
    const nodes = resolvePath(t, ["brand-film"]).nodes;
    // Brand-level enquiry entries merge into brand branches; only branches
    // with bookable leaves count as service brands.
    const serviceBrands = nodes
      .filter((n) => n.kind === "branch" && leafServices(n).length > 0)
      .map((n) => (n.kind === "branch" ? n.label : ""));
    expect(serviceBrands).toEqual(["Garware", "XPEL", "LLumar", "3M"]);
    const film = nodes.map((n) => (n.kind === "branch" ? n.label : ""));
    expect(film).not.toContain("Colour films");
    expect(t.some((n) => n.kind === "branch" && n.key === "colour")).toBe(true);
  });
  it("window film, tyres-style invented work and seating stay enquiry or quote-only, never priced", () => {
    const film = leafServices(buildTree(group("mods"), all).find((n) => n.kind === "branch" && n.key === "film")!);
    expect(film.every((s) => s.priceOnRequest === true)).toBe(true);
    const t = buildTree(group("mods"), all);
    expect(t.find((n) => n.kind === "enquiry" && n.key === "seats")).toBeTruthy();
  });
  it("enquiry nodes carry no price, term or warranty", () => {
    for (const g of MENU_GROUPS) for (const n of buildTree(g, all)) if (n.kind === "enquiry") expect(Object.keys(n).sort()).toEqual(["blurb", ...(n.infoKey ? ["infoKey"] : []), "key", "kind", "label"].filter((k) => k in n).sort());
  });
  it("every service in a group is reachable exactly once", () => {
    for (const g of MENU_GROUPS) {
      const ids = buildTree(g, all).flatMap(leafServices).map((s) => s.id).sort();
      const want = all.filter((s: { category: string }) => (g.categories as string[]).includes(s.category)).map((s: { id: string }) => s.id).sort();
      expect(ids).toEqual(want);
    }
  });
  it("type ids named in the vocabulary exist in the menu", () => {
    const real = new Set([...MENU_SEED.map((m) => m.id), ...visibility.ordinaryServiceIds]);
    for (const defs of Object.values(SERVICE_TYPES)) for (const d of defs) for (const id of d.ids ?? []) expect(real.has(id)).toBe(true);
  });
  it("a single child branch opens by itself; old ?brand= links resolve", () => {
    const only = [{ kind: "branch" as const, key: "a", label: "A", children: [{ kind: "branch" as const, key: "b", label: "B", children: [] }] }];
    expect(resolvePath(only, []).trail.map((t) => t.key)).toEqual(["a", "b"]);
    expect(pathToLabel(buildTree(group("coatings"), all), "Kovalent")).toEqual(["ceramic", "Kovalent"]);
  });
  it("search words land in the right type", () => {
    const hit = (q: string) => all.filter((s: never) => matchesQuery(s, q)).map((s: { id: string }) => s.id);
    expect(hit("graphene")).toContain("menu-coat-kovalent-graphene");
    expect(hit("upholstery")).toContain("menu-coat-fabric");
    expect(hit("tint")).toContain("menu-mods-tint");
    expect(hit("tyre")).toContain("menu-garage-alignment");
    expect(hit("dashboard")).toEqual([]);
  });
});

it('owner-confirmed film brands appear as brand-level enquiries only; unconfirmed brands and named ranges stay absent',()=>{
  const eligible=all.filter(customerOfferingVisible);
  const ppf=buildTree(group('ppf'),eligible);
  // Owner confirmation 8 Nov (iMessage): the seven confirmed film BRANDS each
  // carry one brand-level enquiry under Film by brand; named ranges stay held.
  const film=ppf.find(n=>n.kind==='branch'&&n.key==='brand-film') as Extract<TreeNode,{kind:'branch'}>|undefined;
  expect(film).toBeTruthy();
  const brandBranches=film!.children;
  expect(brandBranches.map(b=>b.kind==='branch'?b.label:'')).toEqual(['LLumar','Garware','XPEL','Avery Dennison','AVVYX','NAR','GSWF']);
  for(const b of brandBranches){expect(b.kind).toBe('branch');if(b.kind==='branch')expect(b.children.map(c=>c.kind==='enquiry'?c.key:'')).toHaveLength(1);}
  // pps-spray is the confirmed, brand-less PPS service concept: enquiry-only, no stock/price.
  expect(ppf.filter(n=>n.kind==='enquiry').map(n=>n.kind==='enquiry'?n.key:'')).toEqual(['pps-spray']);
  const tree=buildTree(group('coatings'),eligible);
  for(const key of ['tyre','dashboard','matte','ppf-coat','maintenance-coating']) {
    expect(tree.some(n=>n.kind==='enquiry'&&n.key===key)).toBe(false);
  }
  expect(JSON.stringify(tree)).not.toContain('PowerShield');
  const ppfText=JSON.stringify(buildTree(group('ppf'),all));
  for(const held of ['Ultraguard','SunTek','Defender','ULTIMATE','Premium PPF','Matte and satin film'])expect(ppfText).not.toContain(held);
});

it('every confirmed reference remains an enquiry and all 23 ordinary services remain visible',()=>{
  const trees=MENU_GROUPS.flatMap(g=>buildTree(g,all.filter(customerOfferingVisible)));
  const enquiries=(nodes:TreeNode[]):string[]=>nodes.flatMap(n=>n.kind==='enquiry'?[n.key]:n.kind==='branch'?enquiries(n.children):[]);
  expect(enquiries(trees).filter(k=>visibility.confirmedEnquiryKeys.includes(k)).sort()).toEqual([...visibility.confirmedEnquiryKeys].sort());
  for(const id of visibility.ordinaryServiceIds) expect(customerOfferingVisible({id,active:true})).toBe(true);
  expect(customerOfferingVisible({id:visibility.ordinaryServiceIds[0]!,active:false})).toBe(false);
});

it('source-qualified surface ranges never drift into paint coating and remain unpriced enquiries',()=>{const t=buildTree(group('coatings'),all);for(const [type,name]of [['fabric','Fabric'],['ppf-coat','Overlay'],['wheels','Ceramic Rims Cr0.01']]){const branch=t.find(n=>n.kind==='branch'&&n.key===type)as Extract<TreeNode,{kind:'branch'}>;expect(branch).toBeTruthy();expect(JSON.stringify(branch)).toContain(name);const ceramic=t.find(n=>n.kind==='branch'&&n.key==='ceramic');expect(JSON.stringify(ceramic)).not.toContain('"label":"'+name+'"');}expect(JSON.stringify(t)).not.toContain('Revive');});

it('live explicit identities avoid misleading category fallback',async()=>{const {typeKeyOf}=await import('./services-tree');const row=(id:string,category:string)=>({id,category})as never;expect(typeKeyOf('coatings',row('svc-coating-maintenance','coating'))).toBe('maintenance-coating');expect(typeKeyOf('coatings',row('svc-coating-teflon','coating'))).toBe('sealant');expect(typeKeyOf('wash',row('svc-wash-detail-spa','washing'))).toBe('complete');expect(typeKeyOf('wash',row('svc-wash-headlight-buffing','washing'))).toBe('lamps');});
