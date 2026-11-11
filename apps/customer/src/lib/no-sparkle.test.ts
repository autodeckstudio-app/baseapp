import {it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
it("removes the pictured services sparkle and shared decorative variants, not rating stars",()=>{
 const nav=readFileSync('src/ui/NavIcon.tsx','utf8');
 expect(nav).toContain('services: { body: \'<rect');expect(nav).not.toContain('M10.5 4.5');
 const icons=readFileSync(resolve('../../packages/ui/src/theme/icons.ts'),'utf8');
 const glyphs=readFileSync(resolve('../../packages/ui/src/theme/glyphs.ts'),'utf8');
 expect(icons).not.toMatch(/M9\.937 15\.5|M12 3l1\.9/);expect(glyphs).not.toContain('M0,-10');
 expect(icons).toContain('star:');expect(nav).toContain('accessibilityElementsHidden');
});
