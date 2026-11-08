import React, { useState } from "react";
import { it, expect, vi } from "vitest";
import { act, create } from "react-test-renderer";
import { Pressable } from "react-native";
vi.mock("../lib/service-type-images", () => ({
  serviceTypeImage: () => undefined,
}));
vi.mock("./ServicePhoto", () => ({ ServicePhoto: () => null }));
vi.mock("../lib/service-home-images", () => ({ serviceHomeImages: {} }));
vi.mock("../lib/imagery", () => ({ BRAND_LOGOS: {} }));
vi.mock("./kit", () => ({
  Button: ({ label, onPress }: any) => (
    <Pressable accessibilityLabel={label} onPress={onPress}>
      {label}
    </Pressable>
  ),
  T: "Text",
  Pane: "Pane",
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
it("connected home -> ceramic -> brand -> exact service, PPF/PPS honest empty states, no unknown products or double reference", async () => {
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
  const cards = r.root
    .findAllByType(Pressable)
    .filter(
      (p: any) =>
        p.props.accessibilityLabel === "View Kovalent Graphene Matrix",
    );
  expect(cards).toHaveLength(1);
  await press(r, "View Kovalent Graphene Matrix");
  expect(opened).toHaveBeenCalledWith(rows[0]);
  await press(r, "Change brand");
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
  for (const b of ["LLumar", "Garware", "XPEL", "Avery Dennison", "AVVYX", "NAR", "GSWF"])
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
  expect(ppsText).toContain("Quote to confirm");
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
