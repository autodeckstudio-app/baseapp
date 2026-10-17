import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=(p:string)=>readFileSync(resolve(".",p),"utf8");
describe("unified product design contract",()=>{
  it("keeps user-uploaded service photos untreated",()=>{
    expect(read("src/ui/ServicePhoto.tsx")).not.toContain("filter:");
  });
  it("labels shared input controls and preserves minimum back target",()=>{
    const source=read("src/ui/kit.tsx");expect(source).toContain("accessibilityLabel={label}");expect(read("src/ui/AppBar.tsx")).toMatch(/accessibilityLabel="Back"[^\n]*width: 46, height: 46/);
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
    expect(bar).toContain("size={26}");
    expect(bar).toContain("onNavCompact");
    expect(bar).not.toContain("<Text");
  });
  it("puts Home in the centre with the AD monogram and Services beside it",()=>{
    const bar=read("src/ui/RaisedTabBar.tsx");
    expect(bar).toContain('route.name === "index"');
    const lay=read("src/app/(tabs)/_layout.tsx");
    const order=["bookings","catalogue","index","garage","profile"].map((n)=>lay.indexOf('<Tabs.Screen name="'+n+'"'));
    expect(order.every((v)=>v>=0)).toBe(true);
    expect([...order].sort((a,b)=>a-b)).toEqual(order);
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
    const home=read("src/ui/HomeView.tsx");expect(home).toContain("metrics.heroCompact");expect(home).toContain("HeroStage");expect(home).not.toContain("height: 210");
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
    const svc=read("src/app/(tabs)/catalogue/[id].tsx");expect(svc).toContain("left: 0, right: 0, bottom: 92");expect(svc).toContain("maxWidth: 480");expect(svc).toContain('alignItems: "center", paddingHorizontal: 20');expect(svc).not.toContain('width: "92%"');
    expect(read("src/ui/StoryCircles.tsx")).toContain("groups.filter((g) => g.cover)");
    expect(read("src/app/(tabs)/bookings/index.tsx")).toContain('?? "Service visit"');expect(read("src/app/(tabs)/bookings/index.tsx")).not.toContain('?? "Service"');
  });
it("keeps Home glass to three blur surfaces, hides the campaign slot without real content",async()=>{
  const {hasCampaign,MAX_BLUR_SURFACES}=await import("../lib/campaign");
  expect(MAX_BLUR_SURFACES).toBe(3);
  expect(hasCampaign(null)).toBe(false);expect(hasCampaign({headline:"",imageUrl:"x",onPress:()=>undefined})).toBe(false);expect(hasCampaign({headline:"Real",imageUrl:"",onPress:()=>undefined})).toBe(false);expect(hasCampaign({headline:"Real",imageUrl:"/a.jpg",onPress:()=>undefined})).toBe(true);
  const home=read("src/ui/HomeView.tsx");expect((home.match(/glassPane\(\)/g)??[]).length).toBeLessThanOrEqual(3);expect(home).not.toMatch(/\u2014/);
  const idx=read("src/app/(tabs)/index.tsx");expect(idx).toContain("campaign={offerToCampaign(");expect(idx).not.toMatch(/campaign=\{\{/);
});
it("every journey element has a reason: no None status rows, a call route when online cancel is closed, a next step after pay at the studio",()=>{
  expect(read("src/ui/CarOverview.tsx")).not.toContain('"None"');
  const b=read("src/app/(tabs)/bookings/[id].tsx");expect(b).toContain('label="Call the studio"');expect(b).toContain("tel:${STUDIO_INFO.phone}");expect(b).toContain("Next: bring your car at {displayTime}");
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

describe("booking flow guardrails", () => {
  const rd = (p: string) => read("src/" + p);
  it("list prices never fall back to the unadjusted base price once the car size is known", () => {
    const vs = rd("lib/vehicle-size.ts");
    expect(vs).toMatch(/export function servicePriceText/);
    expect(vs).toMatch(/t === undefined \? null/);
    expect(rd("app/(tabs)/catalogue/index.tsx")).not.toMatch(/priceLabel\(/);
    expect(rd("app/(tabs)/index.tsx")).toMatch(/servicePriceText\(/);
    expect(rd("app/(tabs)/index.tsx")).not.toMatch(/priceLabel\(/);
  });
  it("calculateServicePrice feeds the shared total cache the lists read", () => {
    expect(rd("lib/catalogue-service.ts")).toMatch(/totalCache\.set\(/);
  });
  it("no timezone suffix in booking times", () => {
    for (const f of ["app/(tabs)/book/confirm.tsx", "app/(tabs)/bookings/[id].tsx", "app/(tabs)/bookings/reschedule.tsx"]) {
      expect(rd(f)).not.toMatch(/ IST[`"<. ]/);
    }
  });
  it("Book shows times from a warm cache and no plain-text calendar wait", () => {
    expect(rd("app/(tabs)/book/[serviceId].tsx")).toMatch(/peekAvailability\(/);
    expect(rd("app/(tabs)/book/[serviceId].tsx")).not.toMatch(/Checking the studio/);
  });
  it("the booking car card has no photo placeholder when the car has no photo", () => {
    expect(rd("app/(tabs)/book/[serviceId].tsx")).toMatch(/selectedVehicle\.photoUrl\?<CarThumb/);
  });
});

describe("Book shows the price and time picker early", () => {
  it("price in the header, short photo, so times sit above the fold", () => {
    const b = read("src/app/(tabs)/book/[serviceId].tsx");
    expect(b).toMatch(/total !== null \? <T role="bodyStrong" tone="accent">\{rupees\(total\)\}/);
    expect(b).toMatch(/aspect=\{3\}/);
  });
});

it("Garage last service and the service reminder count delivered visits only", () => {
  expect(read("src/app/(tabs)/garage/[id].tsx")).toMatch(/mostRecentJob = lastFinishedJob\(jobs\)/);
});

describe("Home hero stage", () => {
  it("a single car is the hero on black with the orange glow, and its height comes from metrics", () => {
    const h = read("src/ui/HeroStage.tsx");
    expect(h).toContain("metrics.heroStage");
    expect(h).toMatch(/radial-gradient/);
    expect(h).not.toMatch(/\u2014/);
    expect(read("src/ui/HomeView.tsx")).toMatch(/<HeroStage car=/);
  });
  it("Home keeps orange to small highlights: no orange kicker or orange text links", () => {
    const home = read("src/ui/HomeView.tsx");
    expect(home).not.toMatch(/colors\.accentStrong, fontSize: 14, fontWeight: "600"/);
    expect(home).not.toMatch(/<Icon name=\{icon\} color="#EC8638"/);
  });
});

describe("slide to confirm", () => {
  it("the Review step confirms by slide with a visible tap fallback, and the booking still goes through handleConfirm", () => {
    const c = read("src/app/(tabs)/book/confirm.tsx");
    expect(c).toMatch(/<SlideToConfirm /);
    expect(c).toMatch(/onConfirm=\{\(\) => void handleConfirm\(\)\}/);
    const s = read("src/ui/SlideToConfirm.tsx");
    expect(s).toMatch(/Or tap here to confirm/);
    expect(s).not.toMatch(/\u2014/);
  });
});

describe("garage cards", () => {
  it("never reuse one photo: garage services use an icon tile", () => {
    const src = read("src/ui/ServicePhoto.tsx");
    expect(src).toContain('service.category === "garage"');
    expect(src).toContain("garageIconFor");
  });
});

describe("home cars", () => {
  it("shows each car once: no tripled looping list", () => {
    expect(read("src/ui/HomeView.tsx")).not.toContain("[...cars, ...cars, ...cars]");
  });
  it("light surfaces are warm and flat: no white offset highlights", () => {
    const src = read("src/lib/raised.ts");
    expect(src).not.toContain("-8px -8px 20px rgba(255,255,255,0.95)");
    expect(src).toContain("#FBF8F3");
  });
});

describe("home menu", () => {
  it("the avatar opens the side drawer", () => {
    expect(read("src/ui/HomeView.tsx")).toContain("SideDrawer");
    expect(read("src/app/(tabs)/index.tsx")).toContain("drawer={[");
  });
});

describe("services filters", () => {
  it("a chip opens the group's products, not a card for the same group", () => {
    const src = read("src/app/(tabs)/catalogue/index.tsx");
    expect(src).toContain("const cat = fromRoute ?? grp ?? undefined");
    expect(src).toContain("!fromRoute && !searching ? <GroupChips");
  });
});

describe("service photos", () => {
  it("every photo pool has distinct files so neighbouring cards differ", () => {
    const src = read("src/lib/imagery.ts");
    const pools = src.slice(src.indexOf("const POOLS"), src.indexOf("/** Pick the Nth"));
    for (const line of pools.split("\n").filter((l) => l.includes("require("))) {
      const files = [...line.matchAll(/imagery\/([\w/.-]+\.jpg)/g)].map((m) => m[1]);
      expect(files.length).toBeGreaterThanOrEqual(3);
      expect(new Set(files).size).toBe(files.length);
    }
  });
});

describe("catalogue loading", () => {
  it("shares one catalogue request and paints the saved copy first", () => {
    expect(read("src/lib/catalogue-service.ts")).toContain("TTL_MS");
    expect(read("src/app/(tabs)/catalogue/index.tsx")).toContain("peekCatalogue()");
  });
});

describe("garage brand filter", () => {
  it("filters the account's cars by make with an All chip", () => {
    const g = read("src/app/(tabs)/garage/index.tsx");
    expect(g).toContain("const brands =");
    expect(g).toContain('b ?? "All"');
  });
});

describe("provenance", () => {
  it("does not attribute web-researched facts to the owner", () => {
    expect(read("src/lib/catalogue-service.ts")).not.toContain("Per Meet");
    expect(read("src/lib/warranty-labels.ts")).toContain("WARRANTY-CLAIMS.md");
  });
});

describe("shared header", () => {
  it("every tab screen uses the same app bar", () => {
    for (const f of ["garage/index", "bookings/index", "catalogue/index", "profile"]) {
      expect(read(`src/app/(tabs)/${f}.tsx`)).toContain("appBar=");
    }
  });
});

describe("bookings page", () => {
  it("holds booking content only: no Explore tiles", () => {
    expect(read("src/app/(tabs)/bookings/index.tsx")).not.toContain("Explore");
  });
});

describe("actionable notifications", () => {
  it("each notification action is a real button; money decisions stay on the confirm screen", () => {
    const n = read("src/app/(tabs)/notifications/index.tsx");
    expect(n).toContain("accessibilityLabel={NOTIFICATION_ACTION[item.entityType");
    expect(n).not.toContain("respondToApproval");
  });
});

describe("one icon set", () => {
  it("drawer, app bar, home bell, top picks and notifications draw the thin-line set", () => {
    for (const f of ["src/ui/SideDrawer.tsx", "src/ui/AppBar.tsx", "src/ui/HomeView.tsx", "src/app/(tabs)/notifications/index.tsx"]) {
      expect(read(f)).toContain("NavIcon");
    }
  });
  it("top services cards carry a photo", () => {
    expect(read("src/ui/HomeView.tsx")).toContain("<ServicePhoto service={{ name: pick.service.name");
  });
  it("night surfaces use one charcoal card colour", () => {
    expect(read("src/lib/raised.ts")).toContain('#1B1B1F');
  });
});

describe("home car cards", () => {
  it("show the car name and number plate only, no stray icons", () => {
    const h = read("src/ui/HomeView.tsx");
    expect(h).not.toContain('<Icon name="car"');
    expect(h).not.toContain("Care map</Text>");
    expect(read("src/ui/HeroStage.tsx")).toContain("<Plate value={car.plate} />");
  });
});

describe("membership wash", () => {
  it("stays dark until the server records redemptions", () => {
    expect(read("src/lib/membership-wash.ts")).toContain("export const MEMBERSHIP_WASH_LIVE = false");
    const c = read("src/app/(tabs)/book/confirm.tsx");
    expect(c).toContain("MEMBERSHIP_WASH_LIVE && wash && wash.ok");
    expect(c).toContain("...(washOn ? { useMembershipWash: true } : {})");
  });
});

describe("referral wording", () => {
  it("every Bring a friend button uses the one share message", () => {
    for (const f of ["src/ui/AppBar.tsx", "src/app/(tabs)/index.tsx"]) {
      const s = read(f);
      expect(s).toContain("referralSubtitle(myCode)");
      expect(s).not.toContain("Book on https://app.autodeck.in");
    }
  });
});

describe("one tile size everywhere", () => {
  it("PhotoCard has a single aspect and no size variants", () => {
    const h = read("src/ui/HomeView.tsx");
    expect(h).toContain("export const TILE_ASPECT = 1.4");
    expect(h).not.toContain("compact?: boolean");
    expect((h.match(/aspectRatio: TILE_ASPECT/g) ?? []).length).toBe(1);
  });
  it("Services and Home Top services use PhotoCard and TILE_GAP", () => {
    expect(read("src/app/(tabs)/catalogue/index.tsx")).toContain("TILE_GAP");
    expect(read("src/ui/HomeView.tsx")).toMatch(/function TopPickCard[\s\S]*<PhotoCard/);
  });
});

describe("nav order and drawer", () => {
  it("tabs are Bookings, Services, Home (centre), Garage, You, in that order", () => {
    const s = read("src/app/(tabs)/_layout.tsx");
    const order = ["bookings", "catalogue", "index", "garage", "profile"].map((n) => s.indexOf(`<Tabs.Screen name="${n}"`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it("Home has one entry point per thing: no service grid, reminders list, friend row or drawer copies", () => {
    const h = read("src/ui/HomeView.tsx");
    for (const dup of ['"Top services"', 'Heading title="Reminders"', 'title="Bring a friend"', 'Your car needs</Text>', '>Last time</Text>']) expect(h).not.toContain(dup);
    expect(h).toContain("pickIdleNudge(");
    const idx = read("src/app/(tabs)/index.tsx");
    for (const key of ["membership", "notifications", "studio", "help"]) expect(idx).not.toContain(`{ key: "${key}", label:`);
  });
  it("Day hero: the car name gets a light pill when a photo sits under it", () => {
    const h = read("src/ui/HeroStage.tsx");
    expect(h).toContain("titleNeedsPill(day, !!car.hasPhoto)");
    expect(h).toContain("export const titleNeedsPill = (day: boolean, hasPhoto: boolean): boolean => day && hasPhoto;");
  });
  it("no back button on a tab root: tab names never appear in the back bar's SUB_ROOTS", () => {
    const kit = read("src/ui/kit.tsx");
    const m = kit.match(/const SUB_ROOTS: Record<string, string> = \{([^}]*)\}/);
    expect(m).not.toBeNull();
    for (const tab of ["index", "bookings", "catalogue", "garage", "profile"]) expect(m![1]).not.toMatch(new RegExp(`\\b${tab}:`));
  });
  it("one header on every screen: Screen renders AppBar itself, Back lives inside it, no separate back bar", () => {
    const kit = read("src/ui/kit.tsx");
    expect(kit).not.toContain("function BackBar");
    expect(kit).toContain("<AppBar title={bar.title} onBack={bar.back} />");
    expect(read("src/ui/AppBar.tsx")).toContain("onBack");
    for (const t of ["bookings", "catalogue", "garage", "profile", "membership", "notifications", "studio", "help", "cars", "book", "approvals", "invoice"]) expect(kit).toMatch(new RegExp(`\\b${t}: "`));
  });
  it("the drawer does not repeat anything already in the nav", () => {
    for (const f of ["src/ui/AppBar.tsx", "src/app/(tabs)/index.tsx"]) {
      const s = read(f);
      for (const k of ["garage", "bookings", "services", "profile"]) expect(s).not.toContain(`key: "${k}", label`);
    }
  });
  it("the centre button uses the official monogram paths, unchanged", () => {
    const m = read("src/ui/AdMonogram.tsx");
    expect(m).toContain("M1447,666 L1953,666 A500,500 0 0 1 1953,1666");
    expect(m).toContain("M756,1494 L995,1500 L1072,1662 L612,1662 Z");
  });
});

describe("referral code stays dark", () => {
  it("the Have a code field and the sent code are both gated by REFERRAL_LIVE", () => {
    const c = read("src/app/(tabs)/book/confirm.tsx");
    expect(c).toContain("{REFERRAL_LIVE ? (");
    expect(c).toContain("referralCodeToSend(friendCode");
    expect(read("src/lib/referral.ts")).toContain("export const REFERRAL_LIVE = false");
  });
});

describe("care map is gone", () => {
  it("has no Care map code, route or label in the customer app", () => {
    const { execSync } = require("node:child_process");
    const hits = execSync(`grep -rniE "care ?map|CareMap|Car3D" src --include=*.ts --include=*.tsx -l || true`, { cwd: process.cwd() }).toString().split("\n").filter((f: string) => f && !f.endsWith("design-contract.test.ts") && !f.endsWith("bookings-view.test.ts"));
    expect(hits).toEqual([]);
  });
});

it("lists every stock image in the imagery register",()=>{
  const fs=require("fs") as typeof import("fs");const path=require("path") as typeof import("path");
  const dir=path.join(__dirname,"../../assets/imagery/stock");
  const reg=fs.readFileSync(path.join(__dirname,"../../assets/imagery/REGISTER.md"),"utf8");
  const missing=fs.readdirSync(dir).filter(f=>/\.(jpe?g|png|webp)$/i.test(f)).filter(f=>!reg.includes(f));
  expect(missing).toEqual([]);
});

it("profile settings sit in glass cards, one per topic, with no stray links repeated from the tabs",()=>{
  const p=read("src/app/(tabs)/profile.tsx");
  for(const k of ["Appearance","Driving licence","Account"]) expect(p).toContain(`<Kicker>${k}</Kicker>`);
  expect((p.match(/<Pane pad="inset">/g)??[]).length).toBeGreaterThanOrEqual(3);
  expect(p).toContain('title="Help and contact"');
});

it("car overview shows a concrete Next due, not vague count tiles or a one-row details card",()=>{
  const o=read("src/ui/CarOverview.tsx");
  expect(o).toContain('title="Next due"');
  expect(o).not.toContain('title="Car details"');
  expect(o).not.toMatch(/label="Protection"|label="Warranty"/);
});
