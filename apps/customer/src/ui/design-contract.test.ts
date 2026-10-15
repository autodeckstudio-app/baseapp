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
    const source=read("src/app/(tabs)/cars/sell.tsx");expect(source).toContain("step===2 ? <Button");expect(source).toContain("if (busy) return");expect(source).toContain("validateSellStep(f, step, photos.length)");expect(read("src/lib/sell-validation.ts")).toContain("if (!photoCount)");
  });
  it("makes critical booking load failures retryable without false rollback claims",()=>{
    const booking=read("src/app/(tabs)/book/[serviceId].tsx");expect(booking).toContain('setSelectedCategory(selectedVehicle?.category??null)');expect(booking).toContain('label="Retry"');expect(booking).toContain('date===selectedDate');
    const confirm=read("src/app/(tabs)/book/confirm.tsx");expect(confirm).not.toContain("Nothing was booked");expect(confirm).toContain("Check your bookings before trying again");expect(confirm).toContain("if(booking || !service || !vehicle || !breakdown)");
  });
  it("recovers missing-link reports and membership screens without endless loaders",()=>{
    expect(read("src/app/(tabs)/bookings/inspection.tsx")).toContain("setInspection(null)");
    expect(read("src/app/(tabs)/membership/purchase.tsx")).toContain("Plan unavailable");
    expect(read("src/app/(tabs)/membership/purchase.tsx")).toContain("!plan || purchasing");
    expect(read("src/app/(tabs)/garage/[id].tsx")).toContain("Car records unavailable");
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
describe("home and car imagery guardrails",()=>{
  it("never claims a car health score without data and never shows a stock car as the customer's car",()=>{
    const home=read("src/ui/HomeView.tsx");
    expect(home).not.toContain("Car health");
    expect(home).not.toContain("Excellent");
    expect(home).not.toContain("vehicleImagery");
    expect(read("src/ui/CarThumb.tsx")).not.toContain("vehicleImagery");
  });
  it("keeps one lead card and no pasted-in services modules on Home",()=>{
    const home=read("src/ui/HomeView.tsx");
    expect(home).toContain("<LeadCard");
    expect(home).not.toContain("Popular services");
    expect(home).not.toContain("From the studio");
  });
});
import {readdirSync,statSync} from "node:fs";
const walk=(d:string):string[]=>readdirSync(resolve(".",d)).flatMap((n)=>{const p=d+"/"+n;return statSync(resolve(".",p)).isDirectory()?walk(p):p.endsWith(".tsx")?[p]:[]});
describe("one design system and one place for everything",()=>{
  it("uses only the shared corner radii (12, 16, 24, pill) plus tiny bars and circles",()=>{
    const ok=new Set([0,1,2,4,5,6,7,8,10,12,16,24,28,9999]);
    const bad:string[]=[];
    for(const f of [...walk("src/app"),...walk("src/ui")]){
      for(const m of read(f).matchAll(/borderRadius: (\d+)/g)){const n=Number(m[1]);if(!ok.has(n)&&n<34)bad.push(f+" "+n)}
    }
    expect(bad).toEqual([]);
  });
  it("opens every tab page with the shared PageHeader and the shared section title",()=>{
    for(const f of ["bookings/index","garage/index","membership/index","notifications/index"]) expect(read(`src/app/(tabs)/${f}.tsx`)).toContain("<PageHeader");
    expect(read("src/app/(tabs)/bookings/index.tsx")).not.toContain("fontSize: 19");
  });
  it("keeps one entry point per destination",()=>{
    const profile=read("src/app/(tabs)/profile.tsx");
    expect(profile).not.toContain('label: "My cars"');
    expect(profile).not.toContain('t("Notifications")');
    expect(profile).not.toContain('t("Membership")');
    const home=read("src/ui/HomeView.tsx");
    expect(home).not.toContain("MenuDrawer");
    expect(home).not.toContain("ContactSheet");
    const studio=read("src/app/(tabs)/studio.tsx");
    expect(studio).not.toContain("Change service");
    expect(studio).not.toContain("ROWS");
    expect(read("src/app/(tabs)/garage/index.tsx")).not.toContain("Service history and invoices");
  });
  it("keeps the bottom nav compact",()=>{
    const bar=read("src/ui/RaisedTabBar.tsx");
    expect(bar).toContain("maxWidth: 360");
    expect(bar).toContain("size={20}");
  });
});
import {metrics,SCALE} from "../lib/metrics";
describe("sizes come from one rulebook",()=>{
  it("keeps every shared size on the scale",()=>{
    for(const [k,v] of Object.entries(metrics)) expect([k,(SCALE as readonly number[]).includes(v as number)]).toEqual([k,true]);
  });
  it("uses the same section gap on Home and in Screen",()=>{
    expect(read("src/ui/HomeView.tsx")).toContain("gap: metrics.sectionGap");
    expect(read("src/ui/kit.tsx")).toContain("paddingBottom: 120, gap: 20");
  });
  it("does not leave a tall empty car panel when there is no photo",()=>{
    const home=read("src/ui/HomeView.tsx");expect(home).toContain("metrics.heroCompact");expect(home).not.toContain("height: 210");
  });
});
describe("surfaces share one radius and one padding",()=>{
  it("card and sheet surfaces are 24 and wells 16, nothing is tilted",()=>{
    const r=read("src/lib/raised.ts");
    expect(r).not.toContain("borderRadius: 26");expect(r).not.toContain("borderRadius: 30");expect(r).not.toContain("borderRadius: 18");
    expect(read("src/ui/ProfileHero.tsx")).not.toContain("rotate");
    expect(read("src/ui/kit.tsx")).toContain('pad === "inset" ? 16');
  });
});
it("keeps the Home lead card on the shared card padding",()=>{expect(read("src/ui/HomeView.tsx")).not.toContain("padding: 18")});
it("never shows a made-up health status on car detail",()=>{expect(read("src/ui/CarOverview.tsx")).not.toMatch(/Health/);expect(read("src/app/(tabs)/garage/[id].tsx")).not.toContain("health=")});
it("takes hero heights from metrics on car and booking detail",()=>{expect(read("src/app/(tabs)/garage/[id].tsx")).toContain("metrics");expect(read("src/app/(tabs)/bookings/[id].tsx")).toContain("metrics.heroCompact")});
it("uses the card padding rule on list cards",()=>{for(const f of ["bookings/index","membership/index","garage/index"])expect(read(`src/app/(tabs)/${f}.tsx`)).toContain("padding: metrics.cardPad")});
it("shows the price total on the booking confirm screen",()=>{const s=read("src/app/(tabs)/book/confirm.tsx");expect(s).toContain("breakdown.total");expect(s).toContain("breakdown.tax")});
it("keeps the service price bar on the card edges, hides empty story circles, and names walk-in visits",()=>{
    const svc=read("src/app/(tabs)/catalogue/[id].tsx");expect(svc).toContain("left: 20, right: 20, bottom: 92");expect(svc).not.toContain('width: "92%"');
    expect(read("src/ui/StoryCircles.tsx")).toContain("groups.filter((g) => g.cover)");
    expect(read("src/app/(tabs)/bookings/index.tsx")).toContain('?? "Studio visit"');expect(read("src/app/(tabs)/bookings/index.tsx")).not.toContain('?? "Service"');
  });
it("keeps Home glass to three blur surfaces, hides the campaign slot without real content",async()=>{
  const {hasCampaign,MAX_BLUR_SURFACES}=await import("../lib/campaign");
  expect(MAX_BLUR_SURFACES).toBe(3);
  expect(hasCampaign(null)).toBe(false);expect(hasCampaign({headline:"",imageUrl:"x",onPress:()=>undefined})).toBe(false);expect(hasCampaign({headline:"Real",imageUrl:"",onPress:()=>undefined})).toBe(false);expect(hasCampaign({headline:"Real",imageUrl:"/a.jpg",onPress:()=>undefined})).toBe(true);
  const home=read("src/ui/HomeView.tsx");expect((home.match(/glassPane\(\)/g)??[]).length).toBeLessThanOrEqual(3);expect(home).not.toMatch(/\u2014/);
  expect(read("src/app/(tabs)/index.tsx")).not.toContain("campaign=");
});
it("every journey element has a reason: no None status rows, a call route when online cancel is closed, a next step after pay at the studio",()=>{
  expect(read("src/ui/CarOverview.tsx")).not.toContain('"None"');
  const b=read("src/app/(tabs)/bookings/[id].tsx");expect(b).toContain('label="Call the studio"');expect(b).toContain("tel:${STUDIO_INFO.phone}");expect(b).toContain("Next: bring your car at {displayTime} IST");
});
it("audit batch: no spinner price labels, no icon placeholders over titles, labelled remove, headline on You, action on every notification",()=>{
  expect(read("src/app/(tabs)/catalogue/index.tsx")).not.toContain("Checking price");
  expect(read("src/ui/GarageCard.tsx")).toContain(">Remove<");expect(read("src/ui/GarageCard.tsx")).not.toContain('name="close"');
  expect(read("src/app/(tabs)/garage/index.tsx")).toContain("v.photoUrl ? <CarThumb");
  expect(read("src/app/(tabs)/profile.tsx")).toContain("<PageHeader");
  expect(read("src/app/(tabs)/notifications/index.tsx")).toContain("NOTIFICATION_ACTION");
  const home=read("src/ui/HomeView.tsx");expect(home).toContain("isCompactCarRow");expect(home).not.toContain("{car ? car.title : p.greeting}");
  expect(read("src/ui/kit.tsx")).toContain("paddingBottom: 120");
});
