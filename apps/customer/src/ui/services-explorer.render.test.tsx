vi.mock('../lib/catalogue-assets',()=>({catalogueAsset:()=>undefined,hasCataloguePhoto:()=>false,spotlightProductPhoto:()=>undefined}));
import React, { useState } from "react";
import { it, expect, vi } from "vitest";
import { act, create } from "react-test-renderer";
import { Pressable } from "react-native";
vi.mock("../lib/service-type-images", () => ({
  serviceTypeImage: () => undefined,
}));
vi.mock("./ServicePhoto", () => ({ ServicePhoto: () => null }));
vi.mock("../lib/service-home-images", () => ({ serviceHomeImages: {} }));
vi.mock("../lib/brand-logos", () => ({ BRAND_LOGOS: {} }));
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
import { ServicesExplorer } from "./ServicesExplorer";
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
it("connected home -> ceramic -> nested product selection -> exact service, PPF/PPS honest empty states", async () => {
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
  await press(r, "Select Kovalent Graphene Matrix");
  expect(opened).not.toHaveBeenCalled();
  const cards = r.root
    .findAllByType(Pressable)
    .filter(
      (p: any) =>
        p.props.accessibilityLabel === "View Kovalent Graphene Matrix",
    );
  expect(cards).toHaveLength(1);
  await press(r, "View Kovalent Graphene Matrix");
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
  expect(ppsText).toContain("Inspection first");
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
    await press(r, "View Interior deep clean");
    expect(opened.mock.calls.at(-1)![0]).toBe(rows[1]);
    expect(
      r.root
        .findAllByType(Pressable)
        .filter(
          (p: any) => p.props.accessibilityLabel === "View Interior deep clean",
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
  expect(text).toContain("Leather products");
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
  await press(r, "View CarPro CQUARTZ Leather 2.0");
  expect(opened).toHaveBeenCalledWith(leatherRows[0]);
  await press(r, "Select Leather coating");
  await press(r, "View Leather coating");
  expect(opened).toHaveBeenCalledWith(leatherRows[1]);
  await act(async () => r.unmount());
});

it('preserves Ceramic brand cards and nests only the tapped brand products',async()=>{
 const source=[{id:'brand-k1',name:'Kovalent Prolong',brand:'Kovalent',category:'ceramic',customerMenu:{home:'paint',family:'Ceramic'},active:true,basePrice:1200000},{id:'brand-k2',name:'Kovalent Matrix',brand:'Kovalent',category:'ceramic',customerMenu:{home:'paint',family:'Ceramic'},active:true,basePrice:2000000},{id:'brand-c1',name:'CarPro SiC',brand:'CarPro',category:'ceramic',customerMenu:{home:'paint',family:'Ceramic'},active:true,basePrice:1700000}] as any;
 const opened=vi.fn();let r:any;function App(){const[path,set]=useState<ServicesPath>({home:'paint',family:'Ceramic'});return <ServicesExplorer services={source} path={path} query="" onPath={set} onOpen={opened} onReference={vi.fn()} onHelp={vi.fn()} priceLabel={s=>s.brand==='Kovalent'?'₹12,000':'₹17,000'}/>}
 await act(async()=>{r=create(<App/>)});expect(JSON.stringify(r.toJSON())).toContain('Choose a brand');expect(JSON.stringify(r.toJSON())).not.toContain('Kovalent Prolong');await press(r,'Kovalent');expect(JSON.stringify(r.toJSON())).toContain('Kovalent products');expect(JSON.stringify(r.toJSON())).not.toContain('CarPro SiC');await press(r,'Select Kovalent Prolong');expect(opened).not.toHaveBeenCalled();await press(r,'View Kovalent Prolong');expect(opened).toHaveBeenCalledWith(source[0]);await press(r,'Ceramic');await press(r,'CarPro');expect(JSON.stringify(r.toJSON())).not.toContain('Kovalent Prolong');await press(r,'Select CarPro SiC');await press(r,'View CarPro SiC');expect(opened).toHaveBeenLastCalledWith(source[2]);await act(async()=>r.unmount());
});
