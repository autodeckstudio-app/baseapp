import {describe,it,expect} from "vitest";import {readFileSync} from "node:fs";
const source=(file:string)=>readFileSync(new URL(file,import.meta.url),"utf8");
describe("native photo entry points",()=>{
 it.each(["../ui/LicenceSection.tsx","../app/(tabs)/garage/add.tsx","../app/(tabs)/garage/[id].tsx","../app/(tabs)/cars/sell.tsx","../app/(tabs)/cars/[id].tsx"])("has native picker wiring in %s",file=>{const s=source(file);expect(s).toContain("nativeEnabled nativeFileCount=");expect(s).toContain("onNativeChange=");expect(s).not.toMatch(/Platform.OS === "web" \? \(\s*<View[^>]*>\s*<Kicker>(?:Car photo|RC photo|Photo \(optional\))/);});
 it("profile update targets canonical record and blocks unresolved identity",()=>{const s=source("../app/(tabs)/profile.tsx");expect(s).toContain("if (!auth.customerDocId)");expect(s).toContain("COLLECTIONS.customers(), auth.customerDocId");expect(s).not.toContain("COLLECTIONS.customers(), auth.user.uid");});
 it("pricing vehicle and duplicate lookup follow canonical identity",()=>{expect(source("./vehicle-size.ts")).toContain("auth.status===\"ready\"?auth.customerDocId:null");expect(source("../app/(tabs)/garage/add.tsx")).not.toContain("plate, auth.user.uid");});
});
