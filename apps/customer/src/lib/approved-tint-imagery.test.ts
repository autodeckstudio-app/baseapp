import {test,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
test('official tint images map to exact verified film IDs without generic or Garware substitution',()=>{
 const code=readFileSync(resolve('src/lib/choice-media.ts'),'utf8');
 expect(code).toContain('"svc_b020022e661acabd1a65ca79886fae98":{"product":"llumar-window-tint.webp"');
 expect(code).toContain('"svc_2f341c450be046784da9d4e9e0174a4f":{"product":"3m-crystalline-tint.webp"');
 expect(code).toContain('"svc_27492a910747236a1fbfeeffa84f4017":{"product":null');
 expect(code).toContain('"svc_c92af73f10c3107a395e31fb65b1ce5c":{"product":null');
 expect(code).not.toContain('garware-ice-cool-shield');
 for(const file of ['llumar-window-tint.webp','3m-crystalline-tint.webp'])expect(existsSync(resolve('assets/product-choice',file))).toBe(true);
});
