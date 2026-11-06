import { describe,it,expect } from 'vitest';
import fs from 'node:fs';
import {swipeTarget} from './segment-swipe-core';
import {SERVICE_TYPES} from './services-tree';
const source=fs.readFileSync(new URL('../app/(tabs)/catalogue/index.tsx',import.meta.url),'utf8');
const imagery=fs.readFileSync(new URL('./imagery.ts',import.meta.url),'utf8');
describe('Services local polish',()=>{
 it('uses same booking gesture and isolates route/search drilldowns',()=>{expect(source).toMatch(/useSegmentSwipe\(\s*filterKeys/);expect(source).toContain('!path.family && !searching ? swipe.handlers');expect(source).toContain('paddingBottom: 16');expect(source).toContain('minHeight: Math.max(winH - 300, 480)');});
 it('swipes categories without wrapping or vertical capture',()=>{const keys=['all','wash','coatings','ppf','garage','mods','pickup'];expect(swipeTarget(keys,'all',-120,5)).toBe('wash');expect(swipeTarget(keys,'wash',120,5)).toBe('all');expect(swipeTarget(keys,'all',120,0)).toBeNull();expect(swipeTarget(keys,'wash',60,140)).toBeNull();});
 it('brand branches use official contained marks, not first product images',()=>{const explorer=fs.readFileSync(new URL('../ui/ServicesExplorer.tsx',import.meta.url),'utf8');expect(explorer).toContain('BRAND_LOGOS[title]');expect(explorer).toContain('resizeMode="contain"');for(const name of ['XPEL','3M','LLumar','Garware','Kovalent','Fireball'])expect(imagery).toContain(name+ (name==='3M'?"'":""));});
 it('all enquiry type keys have intentional matching imagery',()=>{for(const n of Object.values(SERVICE_TYPES).flat().filter(def=>def.enquiryOnly))expect(imagery).toMatch(new RegExp('(?:["\\\']?'+n.key+'["\\\']?)\\s*:'));});
});

describe('unified local navigation spacing',()=>{
 const read=(p:string)=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
 it('one shared safe-area bottom reserve replaces nested100px fillers',()=>{expect(read('../ui/kit.tsx')).toContain('calc(96px + env(safe-area-inset-bottom))');expect(read('../ui/HomeView.tsx')).not.toContain('paddingBottom: 100');expect(read('../app/(tabs)/garage/index.tsx')).not.toContain('paddingBottom: 100');});
 it('Garage uses same gesture before loading returns',()=>{const g=read('../app/(tabs)/garage/index.tsx');expect(g.indexOf('useSegmentSwipe(')).toBeLessThan(g.indexOf('if (!vehicles && !error)'));expect(g).toContain('...swipe.handlers');expect(g).toContain('key=>setPick(key === "all" ? null : key)');});
 it('drawer opens a single page and that page preserves referral and native gift gates',()=>{const d=read('./drawer-items.ts');expect(d).toContain('key: "friends-gifts"');expect(d).not.toContain('key: "friend"');expect(d).not.toContain('key: "gifts"');const gifts=read('../app/(tabs)/gifts.tsx');expect(gifts).toContain('referralShareMessage(referralCode)');expect(gifts).toContain('NATIVE_GIFT_PAYMENT_ENABLED');expect(gifts).toContain('if (!GIFT_LIVE)');});
});

describe("Garage photo overlay contrast",()=>{it("uses opaque white under dark due text in both themes",()=>{const g=fs.readFileSync(new URL("../app/(tabs)/garage/index.tsx",import.meta.url),"utf8");const due=g.slice(g.indexOf("function DueChip"),g.indexOf("export default function GarageScreen"));expect(due).toContain('backgroundColor: "#FFFFFF"');expect(due).toContain('color: "#1D1B26"');expect(due).not.toContain("colors.textPrimary");});});

describe("studio and support consolidation",()=>{it("has one help destination with hours and directions and keeps old studio links valid",()=>{const read=(p:string)=>fs.readFileSync(new URL(p,import.meta.url),"utf8");expect(read("./drawer-items.ts")).not.toContain('key: "studio"');expect(read("./drawer-items.ts")).toContain('label: "Help & contact"');const help=read("../app/(tabs)/help.tsx");for(const x of ["Opening hours","Directions","s.address","s.phone","s.whatsapp","searchFaq"])expect(help).toContain(x);expect(read("../app/(tabs)/studio.tsx")).toContain('export { default } from "./help"');});});

describe('studio merge preserves prior visual and current-status behavior',()=>{it('reuses the exact old map body and live-hours status',()=>{const help=fs.readFileSync(new URL('../app/(tabs)/help.tsx',import.meta.url),'utf8');expect(help).toContain('StudioMapCanvas');expect(help).toContain('isOpenNow(liveOperatingHours, new Date())');expect(help).toContain('OPEN NOW');expect(help).toContain('CLOSED NOW');});it('renders full due-service meaning in an accessibility label while showing one line',()=>{const g=fs.readFileSync(new URL('../app/(tabs)/garage/index.tsx',import.meta.url),'utf8');const due=g.slice(g.indexOf('function DueChip'),g.indexOf('export default function GarageScreen'));expect(due).toContain('accessible accessibilityLabel={text}');expect(due).toContain('numberOfLines={1}');expect(due).toContain('compactDueChip(text)');});});
