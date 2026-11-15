import {describe,it,expect} from "vitest";
import {createStoryRefreshGate} from "./story-refresh";
describe("story refresh identity gate",()=>{
 it("only latest same-account request may update",()=>{const g=createStoryRefreshGate(),a=g.begin("a:tenant:Washing"),b=g.begin("a:tenant:Washing");expect(a.current()).toBe(false);expect(b.current()).toBe(true)});
 it("close/account change invalidates pending work",()=>{const g=createStoryRefreshGate(),a=g.begin("a:tenant:Washing");g.invalidate();expect(a.current()).toBe(false);const b=g.begin("b:tenant:Washing");expect(a.current()).toBe(false);expect(b.current()).toBe(true)});
});
