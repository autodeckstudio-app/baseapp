# Remote pickup pin qualification

Local implementation only. No production deployment or release approval.

- Entry: Customer > book service > confirm > Pickup/Drop-off/Both > Choose on map.
- Map center starts at the current selected point or studio. No default point is selected for a new choice.
- A map tap or marker drag is tentative. Use this location confirms it and calls the existing server quote with the exact selected point.
- Use current location remains separate. Typed address is not geocoded or substituted for the pin. Confirm screen asks the customer to check the selected location matches the address.
- Address/leg/route changes invalidate stale quote responses. No guessed fee, bypass, or routing-policy change.
- Local component pixels: real Customer kit/theme and Leaflet with synthetic tiles, at320/390/1280. No actual OSM tile or paid routing requests in automated tests. Full routed before/after preview remains required before live release.

## Dependencies and terms checked14November2026

Leaflet1.9.4 stable, types1.9.21 pinned. The documented2.0 line is still beta: https://leafletjs.com/install.html

OSM standard tile policy: https://operations.osmfoundation.org/policies/tiles/

The implementation requests only a human-opened visible viewport through browser image fetching, retains visible linked attribution, does not proxy, prefetch, bulk-download, override caching, strip referer, or send addresses/account/booking IDs. Existing app policy strict-origin-when-cross-origin sends origin identification. Availability is best-effort with no SLA and can be withdrawn. This is not a paid map subscription or guarantee of permanent access. The existing server routing service is unchanged; its source comments do not establish user spending authority.

A native fallback deliberately offers no map. The supported app is web. No claims of native functionality.
