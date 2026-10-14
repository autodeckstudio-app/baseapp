// Firebase sign-in needs the auth handler on the same site as the app, or
// Safari (iPhone) drops the result of a redirect sign-in. On our own hosts the
// handler is proxied through /__/auth (see vercel.json), so use the page's own
// host. Everywhere else (localhost, previews, native) use the configured one.
const OWN_SUFFIX = ".autodeck.in";

export function resolveAuthDomain(configured: string, host: string | undefined): string {
  if (host && host.endsWith(OWN_SUFFIX)) return host;
  return configured;
}
