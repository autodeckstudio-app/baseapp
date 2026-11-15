import { describe, expect, it } from "vitest";
import { googleIosRedirectUri } from "./google-ios-config";
describe("Google iOS callback", () => {
 it("uses the registered reversed client ID", () => expect(googleIosRedirectUri("24903853329-tfe3ualcp55o35qa3hupc4ogsu8tr902.apps.googleusercontent.com")).toBe("com.googleusercontent.apps.24903853329-tfe3ualcp55o35qa3hupc4ogsu8tr902:/oauthredirect"));
 it.each([undefined, "", "https://other.example", "web-client"]) ("does not invent a callback for invalid/missing config %s", id => expect(googleIosRedirectUri(id)).toBeUndefined());
});
