import { it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
it("pins the OCR worker parser in deployed npm installs as well as pnpm tests",()=>{
 const pkg=JSON.parse(readFileSync(resolve(__dirname,'../../../package.json'),'utf8'));
 const root=JSON.parse(readFileSync(resolve(__dirname,'../../../../package.json'),'utf8'));
 expect(pkg.overrides['wasm-feature-detect']).toBe('1.9.0');expect(root.pnpm.overrides['wasm-feature-detect']).toBe('1.9.0');
 const require=createRequire(resolve(__dirname,'../../../node_modules/tesseract.js/package.json'));
 expect(()=>require('wasm-feature-detect')).not.toThrow();
 expect(require('wasm-feature-detect/package.json').version).toBe('1.9.0');
});
