import{describe,it,expect}from"vitest";
import nextConfig from"../../next.config";
describe("Firebase auth iframe security boundary",()=>{
 it("keeps default deny and grants only same-origin AuthRelay framing",async()=>{
 const rules=await nextConfig.headers!();expect(rules).toHaveLength(2);
 expect(rules[0]!.source).toBe("/:path*");expect(rules[0]!.headers).toContainEqual({key:"X-Frame-Options",value:"DENY"});
 expect(rules[1]!.source).toBe("/__/auth/iframe");expect(rules[1]!.headers).toEqual([{key:"X-Frame-Options",value:"SAMEORIGIN"},{key:"Content-Security-Policy",value:"frame-ancestors 'self'"}]);
 });
 it("leaves login, app, popup handler and Firebase configuration framing denied",async()=>{
 const rules=await nextConfig.headers!();for(const path of["/login","/people","/jobs/example","/__/auth/handler","/__/auth/iframe.js","/__/firebase/init.json"]){const overrides=rules.filter(r=>r.source===path);expect(overrides).toEqual([])}
 });
 it("retains same-origin popup compatibility and existing protective headers",async()=>{
 const rules=await nextConfig.headers!();expect(rules[0]!.headers).toContainEqual({key:"Cross-Origin-Opener-Policy",value:"same-origin-allow-popups"});expect(rules[0]!.headers).toContainEqual({key:"X-Content-Type-Options",value:"nosniff"});expect(rules[0]!.headers).toContainEqual({key:"Referrer-Policy",value:"strict-origin-when-cross-origin"});
 });
});
