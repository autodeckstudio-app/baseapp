// What the page is being viewed in. Pure so it can be tested against real
// user-agent strings.
//
// Customers and staff often open links from Instagram, Facebook, WhatsApp
// on Android and similar apps, which load pages in an embedded webview.
// signInWithPopup cannot finish there: the webview blocks window.open or
// opens a view that can never post back. In those webviews sign-in uses
// signInWithRedirect instead.
//
// Deliberately narrow. iOS SFSafariViewController is real Safari and handles
// pop-ups, so it is not matched.
const IN_APP = /(Instagram|FBAN|FBAV|FB_IAB|Snapchat|LinkedInApp|musical_ly|BytedanceWebview|Line\/|; wv\))/i;

export const isInAppBrowser = (ua: string | undefined | null): boolean =>
  typeof ua === "string" && IN_APP.test(ua);

export const currentUserAgent = (): string =>
  typeof navigator === "undefined" ? "" : navigator.userAgent;

// Popup failures that mean "this browser can't do popups here" rather than
// "the person closed the window". These fall back to a redirect.
const POPUP_UNAVAILABLE = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

export function shouldFallBackToRedirect(code: string | undefined): boolean {
  return typeof code === "string" && POPUP_UNAVAILABLE.has(code);
}
