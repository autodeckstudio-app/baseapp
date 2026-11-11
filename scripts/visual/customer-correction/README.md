# Read-only Customer correction preview

Run `node scripts/visual/customer-correction/build.mjs` from the repository after installing its frozen dependencies. Open `index.html` locally. Query flags: `?photos`, `?home`, `?story&visits=3`, `&light`, `?partial`.

The real mounted components use synthetic sample cars and delivered-visit counts. Account/service imports are replaced by local read-only sources. No production data or credentials are used. Illustration cards are labeled, not real customer photos. The first-visit date is a sample.

To repeat touch/keyboard, brand, screenshot and reduced-motion checks, provide `playwright-core` via NODE_PATH and run the two `.cjs` scripts. Set CHROME_PATH if needed. Screenshots and JSON go to /downloads. This is Chrome browser evidence, not iOS Safari or native device acceptance.

`?header-options` compares title-only, orange accent and existing Ceramic illustration alongside the actual service-header component. These are local design alternatives only, not selected production behavior. `&light` checks day mode.
