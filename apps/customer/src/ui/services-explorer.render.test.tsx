vi.mock("react-native",async importOriginal=>{const m=await importOriginal<any>();return {...m,Image:(props:any)=>React.createElement("img",props)}});
vi.mock('../lib/catalogue-assets',()=>({catalogueAsset:()=>undefined,hasCataloguePhoto:()=>false,spotlightProductPhoto:()=>undefined}));
import React, { useState } from "react";
import { it, expect, vi, afterEach } from "vitest";
import {setCatalogueReferences} from "../lib/catalogue-references";
import {BRAND_ENQUIRIES as reviewedReferenceFixture} from "@autodeck/core";
afterEach(()=>setCatalogueReferences(undefined));
import { act, create } from "react-test-renderer";
import { Pressable } from "react-native";
vi.mock("../lib/service-type-images", () => ({
  serviceTypeImage: () => "existing-ppf-photo",
}));
vi.mock("./ServicePhoto", () => ({ ServicePhoto: () => null }));
vi.mock("../lib/service-home-images", () => ({ serviceHomeImages: {} }));
vi.mock("../lib/brand-logos", () => ({ BRAND_LOGOS: {CarPro:{src:"official-carpro",background:"#15171B"}} }));
vi.mock("./kit", () => ({
  useScreenScrollToTop:()=>()=>{},
  Button: ({ label, onPress }: any) => (
    <Pressable accessibilityLabel={label} onPress={onPress}>
      {label}
    </Pressable>
  ),
  T: "Text",
  Pane: "Pane",
  Row: ({ title, detail }: any) => (
    <>
      {title}
      {detail}
    </>
  ),
}));
vi.mock("./SceneIntro", () => ({
  SceneIntro: ({ title, eyebrow }: any) => (
    <>
      {eyebrow}
      {title}
    </>
  ),
}));
import { ServiceChoiceCard, ServicesExplorer } from "./ServicesExplorer";
import { type ServicesPath } from "../lib/services-navigation";
const rows = [
  {
    id: "svc-brand-kovalent-graphene-matrix",
    name: "Kovalent Graphene Matrix",
    brand: "Kovalent",
    description: "Exact current product",
    category: "ceramic",
    active: true,
    basePrice: 0,
    priceOnRequest: true,
  },
  {
    id: "menu-wash-interior",
    name: "Interior deep clean",
    category: "washing",
    brand: null,
    active: true,
    basePrice: 10000,
  },
  {
    id: "svc-wash-premium",
    name: "Premium Wash",
    category: "washing",
    brand: null,
    active: true,
    basePrice: 20000,
  },
] as any;
const press = async (r: any, label: string) => {
  const p = r.root
    .findAllByType(Pressable)
    .find((candidate: any) => candidate.props.accessibilityLabel === label);
  expect(p, label).toBeTruthy();
  await act(async () => p.props.onPress());
};
it("connected home -> ceramic -> nested product selection -> exact service, explicit reviewed PPF/PPS references", async () => {
  // This fixture represents an explicit fresh reviewed registry, never a bundled fallback.
  setCatalogueReferences(reviewedReferenceFixture as any);
  const opened = vi.fn(),
    help = vi.fn();
  let r: any;
  function App() {
    const [path, set] = useState<ServicesPath>({});
    return (
      <ServicesExplorer
        services={rows}
        path={path}
        query=""
        onPath={set}
        onOpen={opened}
        onHelp={help}
        onReference={vi.fn()}
        priceLabel={() => "Quote on request"}
      />
    );
  }
  await act(async () => {
    r = create(<App />);
  });
  await press(r, "Paint Protection");
  await press(r, "Ceramic");
  await press(r, "Kovalent");
  expect(opened).not.toHaveBeenCalled();
  const cards = r.root
    .findAllByType(Pressable)
    .filter(
      (p: any) =>
        p.props.accessibilityLabel === "Full details for Kovalent Graphene Matrix",
    );
  expect(cards).toHaveLength(1);
  await press(r, "Full details for Kovalent Graphene Matrix");
  expect(opened).toHaveBeenCalledWith(rows[0]);
  expect(JSON.stringify(r.toJSON())).not.toContain("GSWF");
  await act(async () => r.unmount());
  // PPF removal: film ranges belong to full-body fitting only, so removal and
  // replacement never show the film-brand chooser - they confirm with the studio.
  const ppfReference = vi.fn();
  function PpfApp() {
    const [p, setP] = useState<ServicesPath>({ home: "paint", family: "PPF", work: "removal" });
    return (
      <ServicesExplorer
        services={rows}
        path={p}
        query=""
        onPath={setP}
        onOpen={opened}
        onHelp={help}
        onReference={ppfReference}
        priceLabel={() => null}
      />
    );
  }
  await act(async () => {
    r = create(<PpfApp />);
  });
  const ppfText = JSON.stringify(r.toJSON());
  expect(ppfText).toContain('"Ask the studio about ","film removal"');
  expect(ppfText).not.toContain("Choose a brand");
  expect(ppfText).not.toContain("Garware");
  await press(r, "Ask the studio");
  expect(help).toHaveBeenCalledWith("Paint Protection · PPF · Remove existing film");
  await act(async () => r.unmount());
  // Full-body fitting: owner-confirmed film BRANDS (8 Nov) show as a brand
  // chooser; each brand carries one brand-level enquiry. Named ranges stay held.
  help.mockClear();
  function FullBodyApp() {
    const [p, setP] = useState<ServicesPath>({ home: "paint", family: "PPF", work: "full_body" });
    return (
      <ServicesExplorer
        services={rows}
        path={p}
        query=""
        onPath={setP}
        onOpen={opened}
        onHelp={help}
        onReference={ppfReference}
        priceLabel={() => null}
      />
    );
  }
  await act(async () => {
    r = create(<FullBodyApp />);
  });
  const fullText = JSON.stringify(r.toJSON());
  expect(fullText).toContain("Choose a brand to see its current offerings.");
  for (const b of ["LLumar", "Garware", "XPEL", "Avery Dennison", "AVVYX", "NAR", "GSWF", "Rodim"])
    expect(fullText).toContain(b);
  expect(fullText).not.toContain("Ultraguard");
  expect(fullText).not.toContain("SunTek");
  expect(fullText).not.toContain("3M");
  expect(fullText).not.toContain("\u20b9");
  await press(r, "Garware");
  const gText = JSON.stringify(r.toJSON());
  expect(gText).toContain("Garware PPF");
  expect(gText).toContain("Ask the studio about the right coverage");
  expect(gText).not.toContain("Premium PPF");
  expect(gText).not.toContain("\u20b9");
  await press(r, "View Garware PPF");
  expect((ppfReference.mock.calls.at(-1)![0] as any).key).toBe("garware-ppf");
  expect(help).not.toHaveBeenCalled();
  await act(async () => r.unmount());
  // Colour PPF lives under Modifications & Wraps > Colour PPF (owner taxonomy,
  // 5 Nov), not under Paint Protection. Colour film ranges are held too, so the
  // family confirms with the studio until the owner confirms sourcing.
  const colourReference = vi.fn();
  function ColourApp() {
    const [p, setP] = useState<ServicesPath>({ home: "modifications", family: "Colour PPF" });
    return (
      <ServicesExplorer
        services={rows}
        path={p}
        query=""
        onPath={setP}
        onOpen={opened}
        onHelp={help}
        onReference={colourReference}
        priceLabel={() => null}
      />
    );
  }
  await act(async () => {
    r = create(<ColourApp />);
  });
  const cText = JSON.stringify(r.toJSON());
  expect(cText).toContain('"Ask the studio about ","Colour PPF"');
  expect(cText).not.toContain("Choose a brand");
  expect(cText).not.toContain("Garware");
  expect(cText).not.toContain("\u20b9");
  await press(r, "Ask the studio");
  expect(help.mock.calls.at(-1)![0]).toContain("Colour PPF");
  expect(colourReference).not.toHaveBeenCalled();
  await act(async () => r.unmount());
  // PPS: the confirmed brand-less service concept card - quote-to-confirm, enquiry route, no price, no booking.
  const reference = vi.fn();
  await act(async () => {
    r = create(
      <ServicesExplorer
        services={rows}
        path={{ home: "paint", family: "PPS" }}
        query=""
        onPath={vi.fn()}
        onOpen={opened}
        onHelp={help}
        onReference={reference}
        priceLabel={() => null}
      />,
    );
  });
  const ppsText = JSON.stringify(r.toJSON());
  expect(ppsText).toContain("PPS - spray-on paint protection");
  expect(ppsText).toContain("Ask the studio about product and coverage");
  expect(ppsText).toContain("Discuss your requirements");
  expect(ppsText).not.toContain("No confirmed current product");
  expect(ppsText).not.toContain("\u20b9");
  await press(r, "View PPS - spray-on paint protection");
  expect((reference.mock.calls.at(-1)![0] as any).key).toBe("pps-spray");
  await act(async () => r.unmount());
});
it("Washing presents interior once, exact record on action, and search uses the same card callback", async () => {
  const opened = vi.fn();
  for (const props of [
    { path: { home: "washing", family: "Interior cleaning" }, query: "" },
    { path: {}, query: "interior" },
  ]) {
    let r: any;
    await act(async () => {
      r = create(
        <ServicesExplorer
          services={rows}
          {...(props as any)}
          onPath={vi.fn()}
          onOpen={opened}
          onHelp={vi.fn()}
          onReference={vi.fn()}
          priceLabel={() => "₹100"}
        />,
      );
    });
    const action=props.query?"View Interior deep clean":"Review booking for Interior deep clean";
    await press(r, action);
    expect(opened.mock.calls.at(-1)![0]).toBe(rows[1]);
    expect(
      r.root
        .findAllByType(Pressable)
        .filter(
          (p: any) => p.props.accessibilityLabel === action,
        ),
    ).toHaveLength(1);
    await act(async () => r.unmount());
  }
});
it('pickup is never a standalone catalogue card, including search, without editing the original record',async()=>{const pickup={id:'svc-pickup',name:'Pickup and drop',category:'pickup',description:'Old flat rate within the city',basePrice:10000,active:true};const source=[...rows,pickup];for(const query of['','pickup']){let r:any;await act(async()=>{r=create(<ServicesExplorer services={source as any} path={{}} query={query} onPath={vi.fn()} onOpen={vi.fn()} onReference={vi.fn()} onHelp={vi.fn()} priceLabel={()=>'₹100'}/>)});expect(JSON.stringify(r.toJSON())).not.toContain('Old flat rate');expect(r.root.findAllByType(Pressable).some((p:any)=>p.props.accessibilityLabel==='View Pickup and drop')).toBe(false);await act(async()=>r.unmount())}expect(pickup.active).toBe(true);expect(pickup.basePrice).toBe(10000);expect(source).toContain(pickup)});

it("detailing service owns product choices with small details controls, no quote button", async () => {
  const leatherRows = [
    {
      id: "svc_fd82917361ed1bbcac06ae7a0d3e256d",
      name: "CarPro CQUARTZ Leather 2.0",
      category: "coating",
      brand: "CarPro",
      description: "CarPro's dedicated leather and vinyl coating",
      active: true,
      basePrice: 0,
      priceOnRequest: true,
    },
    {
      id: "menu-coat-leather",
      name: "Leather coating",
      category: "coating",
      brand: "Add-ons",
      description: "Protective coating for leather seats and trim.",
      active: true,
      basePrice: 600000,
    },
  ] as any;
  const opened = vi.fn(),
    quoted = vi.fn();
  let r: any;
  function App() {
    const [path, set] = useState<ServicesPath>({ home: "detailing" });
    return (
      <ServicesExplorer
        services={leatherRows}
        path={path}
        query=""
        onPath={set}
        onOpen={opened}
        onQuote={quoted}
        onHelp={vi.fn()}
        onReference={vi.fn()}
        priceLabel={(s) => (s.id === "menu-coat-leather" ? "₹6,000" : null)}
      />
    );
  }
  await act(async () => {
    r = create(<App />);
  });
  await press(r, "Leather");
  const text = JSON.stringify(r.toJSON());
  // The service is the page: the fixed-price AutoDeck application is primary.
  expect(text).toContain("Leather coating");
  expect(text).toContain("Choose an option");
  expect(text).toContain("₹6,000");
  expect(text).not.toContain("Choose a brand");
  // The brand product is part of the same service page as a Get quote option.
  expect(text).toContain("CarPro");
  expect(text).toContain("CarPro CQUARTZ Leather 2.0");
  expect(text).not.toContain("Also available at a fixed price");
  // Product selection has no effect beyond selecting. A small details control
  // opens the exact record; it never routes through a remote quote action.
  expect(text).not.toContain("Get quote");
  await press(r, "Select CarPro CQUARTZ Leather 2.0");
  expect(quoted).not.toHaveBeenCalled();
  expect(opened).not.toHaveBeenCalled();
  await press(r, "Full details for CarPro CQUARTZ Leather 2.0");
  expect(opened).toHaveBeenCalledWith(leatherRows[0]);
  await press(r, "Select Leather coating");
  await press(r, "Review booking for Leather coating");
  expect(opened).toHaveBeenCalledWith(leatherRows[1]);
  await act(async () => r.unmount());
});

it('preserves Ceramic brand cards and nests only the tapped brand products',async()=>{
 const source=[{id:'brand-k1',name:'Kovalent Prolong',brand:'Kovalent',category:'ceramic',customerMenu:{home:'paint',family:'Ceramic'},active:true,basePrice:1200000},{id:'brand-k2',name:'Kovalent Matrix',brand:'Kovalent',category:'ceramic',customerMenu:{home:'paint',family:'Ceramic'},active:true,basePrice:2000000},{id:'brand-c1',name:'CarPro SiC',brand:'CarPro',category:'ceramic',customerMenu:{home:'paint',family:'Ceramic'},active:true,basePrice:1700000}] as any;
 const opened=vi.fn();let r:any;function App(){const[path,set]=useState<ServicesPath>({home:'paint',family:'Ceramic'});return <ServicesExplorer services={source} path={path} query="" onPath={set} onOpen={opened} onReference={vi.fn()} onHelp={vi.fn()} priceLabel={s=>s.brand==='Kovalent'?'₹12,000':'₹17,000'}/>}
 await act(async()=>{r=create(<App/>)});expect(JSON.stringify(r.toJSON())).toContain('Choose a brand');expect(JSON.stringify(r.toJSON())).not.toContain('Kovalent Prolong');await press(r,'Kovalent');expect(JSON.stringify(r.toJSON())).toContain('Kovalent products');expect(JSON.stringify(r.toJSON())).not.toContain('CarPro SiC');await press(r,'Select Kovalent Prolong');expect(opened).not.toHaveBeenCalled();await press(r,'Review booking for Kovalent Prolong');expect(opened).toHaveBeenCalledWith(source[0]);await press(r,'Ceramic');await press(r,'CarPro');expect(JSON.stringify(r.toJSON())).not.toContain('Kovalent Prolong');await press(r,'Review booking for CarPro SiC');expect(opened).toHaveBeenLastCalledWith(source[2]);await act(async()=>r.unmount());
});

it("missing registry renders the loaded PPS service without the legacy enquiry",async()=>{
 setCatalogueReferences(undefined);let r:any;
 await act(async()=>{r=create(<ServicesExplorer services={[{...rows[0],id:"priced-pps",name:"Standard PPS",brand:"Standard",category:"pps",basePrice:4000000,priceOnRequest:false,customerMenu:{home:"paint",family:"PPS",priceMode:"fixed"}}] as any} path={{home:"paint",family:"PPS"}} query="" onPath={vi.fn()} onOpen={vi.fn()} onHelp={vi.fn()} onReference={vi.fn()} priceLabel={()=>"₹40,000"}/>)});
 const text=JSON.stringify(r.toJSON());expect(text).toContain("Standard");expect(text).not.toContain("PPS - spray-on paint protection");expect(text).not.toContain("Inspection first");await act(async()=>r.unmount());
});

it("PPF family explains the service then exposes full-body brands directly, keeping removal separate",async()=>{
 setCatalogueReferences([]);let r:any;const go=vi.fn();
 const ppf={...rows[0],id:"priced-ppf",name:"Film option",brand:"Test film",category:"ppf",coverageLevel:"full_body",ppfWork:"full_body",priceOnRequest:false,basePrice:9500000,customerMenu:{home:"paint",family:"PPF",work:"full_body",priceMode:"fixed"}};
 await act(async()=>{r=create(<ServicesExplorer services={[ppf] as any} path={{home:"paint",family:"PPF"}} query="" onPath={go} onOpen={vi.fn()} onHelp={vi.fn()} onReference={vi.fn()} priceLabel={()=>"₹95,000"}/>)});
 const text=JSON.stringify(r.toJSON());expect(text.indexOf("family-intro-PPF")).toBeLessThan(text.indexOf('"Test film"'));expect(text).toContain("Other film work");await press(r,"Test film");expect(go).toHaveBeenLastCalledWith({home:"paint",family:"PPF",brand:"Test film"});await press(r,"Remove existing film");expect(go).toHaveBeenLastCalledWith({home:"paint",family:"PPF",work:"removal"});await act(async()=>r.unmount());
});
it('maintenance links open only exact current services; PPS and unavailable targets use help, never a substitute',async()=>{
 const fixture=[{brand:'Test',id:'cer',name:'Ceramic',category:'ceramic',active:true,basePrice:100,customerMenu:{home:'paint',family:'Ceramic'}},{brand:'Test',id:'film',name:'Film',category:'ppf',active:true,basePrice:100,customerMenu:{home:'paint',family:'PPF'}},{brand:'Standard',id:'spray',name:'PPS',category:'pps',active:true,basePrice:100,customerMenu:{home:'paint',family:'PPS'}},{id:'svc-coating-maintenance',name:'Maintenance Coat',category:'coating',active:true,basePrice:350000,customerMenu:{home:'detailing',family:'Maintenance'}},{id:'svc-brand-kovalent-overlay',name:'Kovalent Overlay',category:'coating',active:true,basePrice:600000,customerMenu:{home:'detailing',family:'Film aftercare'}}] as any;
 for(const [family,label,id] of [['Ceramic','Maintenance Coat','svc-coating-maintenance'],['PPF','Kovalent Overlay','svc-brand-kovalent-overlay'],['PPS','Ask about PPS care',null]] as const){const open=vi.fn(),help=vi.fn();let r:any;await act(async()=>{r=create(<ServicesExplorer services={fixture} path={{home:'paint',family}} query="" onPath={()=>{}} onOpen={open} onReference={()=>{}} onHelp={help} priceLabel={()=>null}/>)});const action=r.root.findAll((x:any)=>!!x.props.onPress&&x.props.accessibilityRole==='link').find((x:any)=>x.props.accessibilityLabel===label);expect(action, family+JSON.stringify(r.toJSON()).slice(-1200)).toBeTruthy();await act(async()=>action!.props.onPress());if(id){expect(open).toHaveBeenCalledWith(fixture.find((x:any)=>x.id===id));expect(help).not.toHaveBeenCalled()}else{expect(open).not.toHaveBeenCalled();expect(help).toHaveBeenCalledWith('PPS aftercare and maintenance')}await act(async()=>r.unmount())}
 const open=vi.fn(),help=vi.fn();let r:any;await act(async()=>{r=create(<ServicesExplorer services={fixture.filter((x:any)=>x.id!=='svc-coating-maintenance')} path={{home:'paint',family:'Ceramic'}} query="" onPath={()=>{}} onOpen={open} onReference={()=>{}} onHelp={help} priceLabel={()=>null}/>)});expect(r.root.findAll((x:any)=>!!x.props.onPress&&x.props.accessibilityRole==='link').some((x:any)=>x.props.accessibilityLabel==='Maintenance Coat')).toBe(false);const a=r.root.findAll((x:any)=>!!x.props.onPress&&x.props.accessibilityRole==='link').find((x:any)=>x.props.accessibilityLabel==='Ask about maintenance');await act(async()=>a!.props.onPress());expect(open).not.toHaveBeenCalled();expect(help).toHaveBeenCalledWith('Ceramic aftercare and maintenance');await act(async()=>r.unmount());
});

it('missing brand images have a neutral static fallback, and failed official image also falls back',async()=>{let r:any;await act(async()=>{r=create(<ServiceChoiceCard title="Cosmo" detail="Full-body paint protection" brand onPress={()=>{}}/>)});const image=r.root.findByType('img');expect(image.props.accessibilityLabel).toBe('Cosmo: brand image unavailable');expect(image.props.source).toBeTruthy();await act(async()=>r.unmount());});

it('official marks stay intact and failed loads use the same static fallback',async()=>{let r:any;await act(async()=>{r=create(<ServiceChoiceCard title="CarPro" detail="Coatings" brand onPress={()=>{}}/>)});expect(r.root.findByType('img').props.source).toBe('official-carpro');await act(async()=>r.root.findByType('img').props.onError());expect(r.root.findByType('img').props.accessibilityLabel).toBe('CarPro: brand image unavailable');expect(r.root.findByType('img').props.source).toBeTruthy();await act(async()=>r.unmount());});

it('brand and other-work images share the same choice-image dimensions',async()=>{let a:any,b:any;await act(async()=>{a=create(<ServiceChoiceCard title="Cosmo" detail="Brand" brand onPress={()=>{}}/>);b=create(<ServiceChoiceCard title="Remove film" detail="Other work" photo={{uri:"existing-ppf-photo"}} onPress={()=>{}}/>)});const logoBox=a.root.findAll((n:any)=>typeof n.props.style?.width==='number'&&n.props.style?.padding===10)[0];const photo=b.root.findAll((n:any)=>n.props.size!==undefined).find((n:any)=>n.props.label==='Remove film');expect(photo?.props.size).toBe(logoBox?.props.style.width);expect(logoBox?.props.style.height).toBe(photo?.props.size);await act(async()=>{a.unmount();b.unmount()});});
it('restored Paint brand products feed the shared cart without bypassing PPS explanation',async()=>{
 setCatalogueReferences([]);const add=vi.fn(),open=vi.fn();const pps:any={id:'enquiry_pps-spray',name:'Standard PPS',brand:'Standard',category:'pps',description:'Spray-on protective film.',active:true,basePrice:4000000,estimatedDurationMinutes:480,customerMenu:{home:'paint',family:'PPS',priceMode:'fixed'}};let r:any;
 await act(async()=>{r=create(<ServicesExplorer services={[pps]} path={{home:'paint',family:'PPS'}} query="" onPath={()=>{}} onOpen={open} onHelp={()=>{}} onReference={()=>{}} priceLabel={()=>'₹40,000'} onSelectForVisit={add} selectedForVisit={[]}/>)});
 expect(JSON.stringify(r.toJSON())).toContain('Spray-applied paint protection.');expect(r.root.findAllByType(Pressable).some((p:any)=>p.props.accessibilityLabel==='Standard')).toBe(true);expect(add).not.toHaveBeenCalled();await act(async()=>r.unmount());
 await act(async()=>{r=create(<ServicesExplorer services={[pps]} path={{home:'paint',family:'PPS',brand:'Standard'}} query="" onPath={()=>{}} onOpen={open} onHelp={()=>{}} onReference={()=>{}} priceLabel={()=>'₹40,000'} onSelectForVisit={add} selectedForVisit={[]}/>)});
 await press(r,'Add Standard PPS');expect(add).toHaveBeenCalledWith(pps);expect(open).not.toHaveBeenCalled();await act(async()=>r.unmount());
});
