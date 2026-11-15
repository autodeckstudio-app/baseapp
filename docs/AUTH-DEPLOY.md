# Sign-in on our domains (Google, Firebase)

Why this exists: with the default `*.firebaseapp.com` auth domain, iPhone Safari drops the result of a Google redirect sign-in (cross-site storage). The fix is to serve Firebase's handler from the app's own host.

## Rules for every web app (admin, studio, customer)
1. Proxy `/__/auth/*` and `/__/firebase/*` to `https://autodeck-studio.firebaseapp.com` (admin: `next.config.ts` rewrites; studio and customer: `vercel.json` rewrites, before the catch-all).
2. Set the Firebase `authDomain` to the page host on `*.autodeck.in` (`apps/*/src/lib/auth-domain.ts`).
3. In Google Cloud console (project autodeck-studio) > APIs and Services > Credentials > the Web client used by Firebase (client id starts `24903853329-37c9`), add to Authorised redirect URIs: `https://<host>/__/auth/handler` for each of admin.autodeck.in, studio.autodeck.in, app.autodeck.in. Add the host as an Authorised JavaScript origin too.
4. Add the host to Firebase Authentication > Settings > Authorized domains.

A new domain is not done until all four are set.

## Checks
- Unit guards: `auth-domain.test.ts`, `auth-proxy-guard.test.ts` (customer app).
- Live: open `https://<host>/__/auth/handler` - must answer, not 404. A Google sign-in URL with `redirect_uri=https://<host>/__/auth/handler` must not show `redirect_uri_mismatch`.
- Real device: sign in on iPhone Safari with the redirect flow and confirm you land signed in.
