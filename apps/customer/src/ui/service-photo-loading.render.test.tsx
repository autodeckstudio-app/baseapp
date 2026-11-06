import React from "react";
import { afterEach, it, expect, vi } from "vitest";
import { create, act } from "react-test-renderer";
import { Image, Pressable } from "react-native";
vi.mock("react-native", () => ({
  Image: "Image",
  View: "View",
  Pressable: "Pressable",
  ActivityIndicator: "ActivityIndicator",
}));
vi.mock("../lib/catalogue-assets", () => ({
  catalogueAsset: (s: any) =>
    s.id === "mapped"
      ? {
          source: { uri: "exact-detail" },
          thumbnail: { uri: "exact-card" },
          product: true,
        }
      : undefined,
}));
vi.mock("../lib/imagery", () => ({
  serviceVisual: () => ({ photo: { uri: "unrelated-filler" } }),
  hasGaragePhoto: () => false,
}));
vi.mock("./kit", () => ({ T: "T" }));
import { ServicePhoto } from "./ServicePhoto";
afterEach(() => vi.useRealTimers());
it("uses exact card-size source, visible error/manual retry and bounded loading; never substitutes another bottle", async () => {
  vi.useFakeTimers();
  let r: any;
  await act(async () => {
    r = create(
      <ServicePhoto
        service={{
          id: "mapped",
          name: "Exact product",
          brand: "Brand",
          category: "ceramic",
        }}
        height={108}
        width={88}
      />,
    );
  });
  expect(r.root.findByType(Image).props.source).toEqual({ uri: "exact-card" });
  await act(async () => r.root.findByType(Image).props.onError());
  expect(JSON.stringify(r.toJSON())).toContain("Product image unavailable");
  await act(async () => r.root.findByType(Pressable).props.onPress());
  expect(r.root.findAllByType(Image)).toHaveLength(1);
  await act(async () => {
    vi.advanceTimersByTime(15000);
  });
  expect(r.root.findAllByType(Image)).toHaveLength(0);
  expect(JSON.stringify(r.toJSON())).not.toContain("unrelated-filler");
  await act(async () => r.unmount());
});
it("full detail uses detail-size source and missing exact branded art is clearly unavailable", async () => {
  let r: any;
  await act(async () => {
    r = create(
      <ServicePhoto
        service={{
          id: "mapped",
          name: "Exact product",
          brand: "Brand",
          category: "ceramic",
        }}
        aspect={4 / 3}
      />,
    );
  });
  expect(r.root.findByType(Image).props.source).toEqual({
    uri: "exact-detail",
  });
  await act(async () => r.unmount());
  await act(async () => {
    r = create(
      <ServicePhoto
        service={{
          id: "missing",
          name: "Unknown",
          brand: "Brand",
          category: "ceramic",
        }}
        height={108}
      />,
    );
  });
  expect(r.root.findAllByType(Image)).toHaveLength(0);
  expect(JSON.stringify(r.toJSON())).toContain("Product image unavailable");
  await act(async () => r.unmount());
});
