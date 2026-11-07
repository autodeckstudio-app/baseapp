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
it("connected home -> ceramic -> brand -> exact service, PPF enquiry-only film lineup and PPS concept card, no unknown products or double reference", async () => {
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
  expect(ppfText).toContain("Confirm Remove existing film with the studio");
  expect(ppfText).not.toContain("Choose a brand");
  expect(ppfText).not.toContain("Garware");
  await press(r, "Ask about this service");
  expect(help).toHaveBeenCalledWith("Paint Protection · PPF · Remove existing film");
  await act(async () => r.unmount());
  // Full-body fitting: the confirmed sheet film lineup shows enquiry-only (no
  // product, price or booking); held references stay hidden.
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
  expect(fullText).toContain("Choose a brand to see its current offerings");
  expect(fullText).not.toContain("No confirmed current product");
  await press(r, "Garware");
  const gText = JSON.stringify(r.toJSON());
  expect(gText).toContain("Premium PPF");
  expect(gText).toContain("Quote to confirm");
  expect(gText).not.toContain("Black PPF");
  expect(gText).not.toContain("Avery Dennison");
  expect(gText).not.toContain("\u20b9");
  await press(r, "View Premium PPF");
  expect((ppfReference.mock.calls.at(-1)![0] as any).key).toBe("garware-premium-exact");
  expect(opened).toHaveBeenCalledTimes(1);
  await act(async () => r.unmount());
  // Colour PPF: black/white films live under Modifications & Wraps > Colour PPF
  // (owner taxonomy, 5 Nov), enquiry-only, not under Paint Protection.
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
  expect(cText).toContain("Choose a brand to see its current offerings");
  expect(cText).not.toContain("Premium PPF");
  await press(r, "Garware");
  const cgText = JSON.stringify(r.toJSON());
  expect(cgText).toContain("Black PPF");
  expect(cgText).toContain("White PPF");
  expect(cgText).toContain("Quote to confirm");
  expect(cgText).not.toContain("Premium PPF");
  expect(cgText).not.toContain("\u20b9");
  await press(r, "View Black PPF");
  expect((colourReference.mock.calls.at(-1)![0] as any).key).toBe("garware-black-ppf");
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
