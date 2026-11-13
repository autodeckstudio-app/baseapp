# Garage calendar dates and lifecycle instants

Local source investigation against 9a69e27f, 13 November 2026. No storage or backend mutation.

## Proven contracts

- `packages/core/src/types/protection.ts` declares startDate and expiryDate as ISO dates. Customer entry validation in `document-validation.ts` uses strict real YYYY-MM-DD dates. `createMyProtection.ts:75` preserves this date input; `protection-effects.ts:144` creates a date-only startDate with now.slice(0,10).
- `advanceJobStatus.ts:89` creates now with new Date().toISOString(). Removal and replacement transactions at549/571 write that exact instant as lifecycleAt. It is not a date-only field, and must not be truncated into one.
- Booking scheduledDate and todayStudioDate are calendar dates, whereas sealedAt and lifecycleAt are event instants. Garage previously routed all these through new Date(value).toLocaleDateString without distinguishing them.

## Safe display change

The local `formatGarageDate` helper formats strict date-only values as their stored calendar day, using UTC only as a rendering carrier. It leaves instant formatting viewer-local, preserving existing instant semantics. Date-only rows no longer jump to yesterday on devices west of UTC. It does not touch stored timestamps, invoice snapshots, expiry calculations or performed-work evidence.

## Remaining exact gap

Two existing Garage protection-history render expectations hardcode the UTC calendar date for lifecycleAt instants. They fail in America/Los_Angeles on both unchanged baseline and the candidate because the implementation shows viewer-local dates. Producer/storage resolves instant versus date-only semantics, but does not establish whether the presentation should use the viewer's timezone, studio timezone or an explicitly labelled UTC date. No per-event studio timezone is stored on Protection. Choosing one merely to make those tests pass would invent a display policy. Those failures remain explicit; expectations have not been weakened or changed. A later evidence-backed display contract can settle this without a record backfill.
