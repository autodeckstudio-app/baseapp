import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
const src = (f: string) => readFileSync(join(__dirname, f), "utf8");
describe("admin car page shows the car's actual documents", () => {
  it("the lookup loads papers-collection documents, not only the protections subcollection", () => {
    const page = src("../app/(admin)/vehicles/page.tsx");
    expect(page).toContain("getVehiclePapers");
    expect(page).toContain("documents={documents}");
  });
  it("the view lists customer documents with status and never claims 'Nothing on file' while documents exist", () => {
    const view = src("../experience/VehiclesView.tsx");
    expect(view).toContain("Customer documents");
    expect(view).toContain("p.protections.length === 0 && p.documents.length === 0");
  });
  it("getVehiclePapers reads the papers collection for the vehicle and hides superseded rows", () => {
    const svc = src("./papers-service.ts");
    expect(svc).toContain('where("vehicleId", "==", vehicleId)');
    // Rules deny a papers list query that is not tenant-filtered (see functions admin-car-lookup-rules.emulator.test.ts).
    expect(svc).toContain('where("tenantId", "==", tenantId)');
    expect(svc).toContain(".filter((x) => !x.supersededAt)");
  });
  it("protections lookup is tenant-filtered too, and the page passes the admin's tenant", () => {
    expect(src("./protection-service.ts")).toContain('where("tenantId", "==", tenantId)');
    expect(src("../app/(admin)/vehicles/page.tsx")).toContain("getVehicleProtections(claims!.tenantId, vehicleId)");
    expect(src("../app/(admin)/vehicles/page.tsx")).toContain("getVehiclePapers(claims!.tenantId, vehicleId)");
  });
  it("the due-soon KPI is labelled as studio papers only, since it ignores customer documents", () => {
    expect(src("../experience/VehiclesView.tsx")).toContain("Studio papers due in 30 days");
  });
});
