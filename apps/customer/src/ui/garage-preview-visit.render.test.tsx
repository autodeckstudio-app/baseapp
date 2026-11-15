import { it, expect } from "vitest";
import { createElement } from "react";
import { create, act } from "react-test-renderer";
import { GaragePreviewVisitRow } from "./GaragePreviewVisitRow";
it("approved compact preview has one full date and no shared history-card treatment", async () => {
  let el: any;
  await act(async () => {
    el = create(
      createElement(GaragePreviewVisitRow, {
        at: "2026-11-09T10:00:00Z",
        title: "Interior clean",
        status: "READY_FOR_DELIVERY",
        first: true,
      }),
    );
  });
  const tree = JSON.stringify(el.toJSON());
  expect(tree.match(/9 Nov 2026/g)).toHaveLength(1);
  expect(tree).toContain("Interior clean");
  expect(tree).toContain("READY FOR DELIVERY");
  expect(tree).not.toContain("CARE RECORD");
  await act(async () => el.unmount());
});
