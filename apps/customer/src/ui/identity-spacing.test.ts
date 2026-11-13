import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {metrics} from '../lib/metrics';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
it('identity rhythm has one eight-point spacing token',()=>{expect(metrics.identityGap).toBe(8);for(const path of ['./kit.tsx','./ProfileHero.tsx','./CarHero.tsx','./NextVisitHero.tsx','./GarageShowroom.tsx'])expect(read(path),path).toContain('metrics.identityGap')});
it('booking header content participates in flow, wraps badges and lets title grow',()=>{const s=read('../app/(tabs)/bookings/[id].tsx');expect(s).toContain('testID="booking-identity-stack" style={{padding:metrics.cardPad,gap:metrics.identityGap}}');expect(s).toContain('testID="booking-identity-header" style={{ minHeight:metrics.heroCompact+60');expect(s).toContain('flexWrap:"wrap",gap: 8');expect(s).not.toContain('<T role="heading" numberOfLines={1} style={{ color: "#FFFFFF" }}>{svc?.name')});
it('compact car next-action strip stacks before labels collide with the booking button',()=>{const s=read('./CarHero.tsx');expect(s).toContain('const narrowStrip = stripWidth < 480');expect(s).toContain('flexDirection: narrowStrip ? "column" : "row"');expect(s).toContain('numberOfLines={narrowStrip ? 3 : 1}')});
