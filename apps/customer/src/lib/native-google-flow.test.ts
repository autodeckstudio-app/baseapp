import { describe, it, expect, vi } from "vitest";
import { runNativeGoogleSignIn } from "./native-google-flow";
function fixture(result: { type: string; data: { idToken: string } | null } = { type: "success", data: { idToken: "verified-by-firebase" } }) {
 const sdk = { configure: vi.fn(), checkPlayServices: vi.fn().mockResolvedValue(true), presentExplicitSignIn: vi.fn().mockResolvedValue(result) };
 const exchange = vi.fn().mockResolvedValue({ uid: "firebase-user" }); return { sdk, exchange };
}
describe("native Google SDK to Firebase boundary",()=>{
 it("uses Web audience on Android, no browser redirect, offline access or automatic selection",async()=>{const {sdk,exchange}=fixture();expect(await runNativeGoogleSignIn(sdk,{webClientId:"web",iosClientId:"ios"},"android",exchange)).toEqual({uid:"firebase-user"});expect(sdk.configure).toHaveBeenCalledWith({webClientId:"web",offlineAccess:false,autoSelectOnSignIn:false});expect(exchange).toHaveBeenCalledOnce();expect(exchange).toHaveBeenCalledWith("verified-by-firebase");});
 it("configures explicit iOS client",async()=>{const {sdk,exchange}=fixture();await runNativeGoogleSignIn(sdk,{webClientId:"web",iosClientId:"ios"},"ios",exchange);expect(sdk.configure).toHaveBeenCalledWith({webClientId:"web",iosClientId:"ios",offlineAccess:false,autoSelectOnSignIn:false});});
 it.each(["cancelled","noSavedCredentialFound","unknown"])("never exchanges a token for %s",async type=>{const {sdk,exchange}=fixture({type,data:null});const p=runNativeGoogleSignIn(sdk,{webClientId:"web"},"android",exchange);if(type==="cancelled")expect(await p).toBeNull();else await expect(p).rejects.toThrow();expect(exchange).not.toHaveBeenCalled();});
 it.each(["", "   "])("rejects empty token",async idToken=>{const {sdk,exchange}=fixture({type:"success",data:{idToken}});await expect(runNativeGoogleSignIn(sdk,{webClientId:"web"},"android",exchange)).rejects.toThrow();expect(exchange).not.toHaveBeenCalled();});
 it("no SDK action without config",async()=>{const {sdk,exchange}=fixture();await expect(runNativeGoogleSignIn(sdk,{webClientId:"web"},"ios",exchange)).rejects.toThrow();expect(sdk.configure).not.toHaveBeenCalled();});
 it("native failure does not authenticate",async()=>{const {sdk,exchange}=fixture();sdk.checkPlayServices.mockRejectedValue(Error("unavailable"));await expect(runNativeGoogleSignIn(sdk,{webClientId:"web"},"android",exchange)).rejects.toThrow();expect(exchange).not.toHaveBeenCalled();expect(sdk.presentExplicitSignIn).not.toHaveBeenCalled();});
 it("Firebase refusal propagates, never invents session",async()=>{const {sdk,exchange}=fixture();exchange.mockRejectedValue(Error("invalid token"));await expect(runNativeGoogleSignIn(sdk,{webClientId:"web"},"android",exchange)).rejects.toThrow("invalid token");});
});
