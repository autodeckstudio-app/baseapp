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
  // PPF removal: still no confirmed product - honest empty state via help.
  await act(async () => {
    r = create(
      <ServicesExplorer
        services={rows}
        path={{ home: "paint", family: "PPF", work: "removal" }}
        query=""
        onPath={vi.fn()}
        onOpen={opened}
        onHelp={help}
        onReference={vi.fn()}
        priceLabel={() => null}
      />,
    );
  });
  expect(JSON.stringify(r.toJSON())).toContain("No confirmed current product");
  await press(r, "Ask about this service");
  expect(help.mock.calls.at(-1)![0]).toContain("PPF");
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
