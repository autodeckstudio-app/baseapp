import { readFileSync, writeFileSync, mkdtempSync, chmodSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { it, expect } from "vitest";
const script=resolve(__dirname,"../../../../scripts/vercel-ignore.sh");
const text=readFileSync(script,"utf8");
it("exact Gauri payment UI branch and direct main landing build only Customer, refusing path/parent/diff drift",()=>{
 const root=mkdtempSync(join(tmpdir(),'autodeck-ignore-'));
 const expected=text.match(/<<'GAURI_UI_PATHS'\n([\s\S]*?)\nGAURI_UI_PATHS/)?.[1];expect(expected).toBeTruthy();
 writeFileSync(join(root,'paths'),expected!+'\n');
 writeFileSync(join(root,'git'),`#!/bin/sh
if [ "$1" = rev-parse ]; then
 case "$2" in --show-toplevel) printf '%s\\n' "$FAKE_ROOT";; --verify) printf '%s\\n' "$FAKE_PARENT";; *) exit 1;; esac
elif [ "$1" = diff ]; then [ "$FAIL_DIFF" = yes ] && exit 1; cat "$FAKE_ROOT/paths"
else exit 1; fi
`);chmodSync(join(root,'git'),0o755);
 const run=(app:string,extra:Record<string,string>={})=>spawnSync('bash',[script,app],{encoding:'utf8',env:{...process.env,PATH:`${root}:${process.env.PATH}`,FAKE_ROOT:root,FAKE_PARENT:'eb4b39ccd1ef6c9e49449abbff5149d271942e10',VERCEL_GIT_COMMIT_REF:'fix/gauri-payment-ui-20261112',...extra}});
 try{
 for(const ref of ['fix/gauri-payment-ui-20261112','main'])for(const app of ['customer','admin','studio','site']){
  const result=run(app,{VERCEL_GIT_COMMIT_REF:ref});expect(result.status).toBe(app==='customer'?1:0);expect(result.stdout).toContain('Pinned Customer Gauri payment UI');
 }
 for(const app of ['customer','admin','studio','site']){
  expect(run(app,{FAKE_PARENT:'wrong-parent'}).status).toBe(0);expect(run(app,{FAIL_DIFF:'yes'}).status).toBe(0);
 }
 writeFileSync(join(root,'paths'),expected+'\nunexpected-file.ts\n');
 for(const app of ['customer','admin','studio','site'])expect(run(app).status).toBe(0);
 }finally{rmSync(root,{recursive:true,force:true})}
});
