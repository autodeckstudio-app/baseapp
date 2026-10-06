import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=(p:string)=>readFileSync(resolve(".",p),"utf8");
describe("unified product design contract",()=>{
  it("keeps user-uploaded service photos untreated",()=>{
    expect(read("src/ui/ServicePhoto.tsx")).not.toContain("filter:");
  });
  it("labels shared input controls and preserves minimum back target",()=>{
    const source=read("src/ui/kit.tsx");expect(source).toContain("accessibilityLabel={label}");expect(source).toContain("minHeight: 44");
  });
  it("does not send or upload before the staged sell review",()=>{
    const source=read("src/app/(tabs)/cars/sell.tsx");expect(source).toContain("step===2 ? <Button");expect(source).toContain("if (busy) return");expect(source).toContain("photos.length===0");
  });
  it("keeps car filtering available during search and normalizes legacy fuel values",()=>{
    const source=read("src/app/(tabs)/cars/index.tsx");expect(source).not.toContain("searching ?");expect(source).toContain('filterCars(all??[]');expect(source).toContain('label="Car body type"');expect(source).toContain('label="Sort cars"');expect(source).toContain('Clear all');
  });
  it("removes inactive tab controls from the accessibility and keyboard tree",()=>{
    expect(read("src/ui/kit.tsx")).toContain("if (!focused) return null");
  });
  it("waits for the core home feeds before claiming all clear",()=>{
    const source=read("src/hooks/useCustomerHome.ts");expect(source).toContain("settled.size === 6");expect(source).toContain("vehicles === null || !coreReady");expect(source).toContain('failFor("memberships")');
  });
  it("does not choose unrelated images for vehicle fallbacks",()=>{
    const source=read("src/lib/imagery.ts");expect(source).toContain("suv: heroAlt");expect(source).toContain("luxury: heroAlt");expect(source).not.toContain("ALL_POOL");
  });
});
