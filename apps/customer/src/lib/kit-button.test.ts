import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const kit=readFileSync(join(__dirname,"..","ui","kit.tsx"),"utf8");
describe("compact glass action contract",()=>{
 it("uses translucent glass with a restrained warm rim, not a solid orange fill",()=>{const line=kit.split("\n").find(l=>l.includes("inkButton ="));expect(line).toContain("...glassQuiet");expect(line).not.toContain('backgroundColor: "#EC8638"');expect(line).toContain("rgba(225,184,143,0.48)");});
 it("keeps labelled primary intent and compact secondary controls with 48px hit areas",()=>{expect(kit).toContain('minHeight: 48');expect(kit).toContain('alignSelf: "flex-start"');expect(kit).toContain('{label}');expect(kit).toContain('accessibilityState={{ disabled: !!off, busy: !!busy }}');});
 it("retains destructive meaning, disabled and loading states",()=>{expect(kit).toContain('kind === "danger" ? "danger" : "primary"');expect(kit).toContain('disabled={off}');expect(kit).toContain('<ActivityIndicator color={colors.textPrimary}');expect(kit).not.toContain('tone={primary ? "onAccent"');});
});
