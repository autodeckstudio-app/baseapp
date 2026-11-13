# Studio public contact and timezone migration proposal

Prepared and installed-qualified against the complete released repository at 9a69e27f2dbf57916d9b2d1b230468c0c3e873c3. Proposal only. No configuration, schema, record, invoice or deployment changed.

## Current source evidence

- `packages/core/src/types/studio.ts`: StudioConfig has name, timezone, operatingHours, holidays and a separate optional invoiceIssuer. It has no operating address or contact object.
- `functions/src/functions/studio/getStudioInfo.ts`: returns the public name/timezone/hours/holiday subset under tenant and rate checks, not bays or tax settings. Existing code filtered on UTC date and kept only ten dates. Local patch uses the studio date and all configured future dates.
- `apps/admin/src/lib/studio-service.ts` and `functions/src/schemas/studio.ts`: Admin settings can update name/timezone/hours/tax/invoiceIssuer. Contact/address is not in that contract. Holidays have dedicated add/remove functions.
- `apps/customer/src/lib/studio-info.ts`: operating contact and address are bundled constants. These remain unchanged; the local patch only removes constant opening-hours fallback from Home and Help.
- `functions/src/functions/booking/createBooking.ts`: requestedStart is constructed with Asia/Kolkata at line66 and is used for future-time validation, conflict checks and saved scheduledAt. Availability and reschedule code use config.timezone. Attendance callables also explicitly key records by Asia/Kolkata.

## Proposed public data contract, not implemented

Add optional `publicContact` to StudioConfig, separate from invoiceIssuer, with operating address, phone, WhatsApp digits and verified maps destination. Keep each field optional or nullable so unavailable contact actions are hidden. Use the existing name/timezone/hours/holidays as the operational truth, not copies in this object. Include an updatedAt/version in the public response for change visibility. Do not expose internal notes, tax, bays or staff data.

Validate phone formats, length limits, safe HTTPS maps destinations and IANA timezone validity on the server. Validate exactly one hours row per weekday, valid HH:mm values, supported same-day intervals, and real YYYY-MM-DD holiday dates. If overnight hours are needed, specify and test that semantics separately instead of guessing. Preserve existing field values on partial updates.

## Safe rollout sequence

1. Prepare backwards-compatible optional schema/API/Admin editor changes with tenant/role/audit tests. No invoice renderer or invoiceIssuer substitution.
2. Have the owner verify the exact operating address, phone, WhatsApp and maps destination in an Admin draft. Current bundled constants are migration leads, not approval to write records.
3. Stage the API/editor before any contact record backfill. Preview the new Customer reader against synthetic present/missing/partial config states and both old/new response shapes.
4. Obtain the new batch's publish approval and separate authority for any real config/backfill mutation. Keep the existing branded operating contacts until confirmed data is staged, then switch readers together. An empty or failed read must not silently produce a new address, guessed open status or misleading availability.
5. Verify live read-only responses and actual Home/Help pixels after the approved release. No bookings, payment writes or record alterations as QA. Rollback should revert readers or restore the previously approved publicContact, never rewrite historical financial snapshots.

## Transactional timezone work remains separate

Do not advertise arbitrary timezone support from this display patch. Changing createBooking's requestedStart changes validation, conflict evaluation and stored times. It needs a unified date/time contract across create/reschedule/availability, server jobs, cancellation deadlines, attendance and admin/studio date filters. Qualify UTC midnight, IST midnight, year rollover and DST zones before approving that migration. Existing bookings, quoted totals, invoice issuer snapshots and payment records remain immutable.

## Bounded Admin lists

Bookings query up to300 newest scheduledAt descending. Payments query up to300 newest createdAt descending. Filters and figures operate on loaded rows. A missing match cannot prove no older record exists. This patch labels the bounds and makes payment KPI/empty wording local to the loaded feed; it does not add exhaustive history, cursor pagination, aggregate ledger totals, or search by exact ID outside the loaded set. Those are separate reader capabilities to design and test.

## Qualification boundary

The installed candidate passed sequential typechecks for Customer, Studio, Admin, core and functions; all five unit suites; default-zone render suites; Functions build; Admin production build; and Customer/Studio web exports. Builds use synthetic demo-project emulator settings for local compilation, not production configuration or release credentials. Full-screen local previews render actual Customer Home/Help, Studio floor and Admin shell/Bookings/Payments components with synthetic data and mocked auth/data/native route boundaries. No real attendance, payment or config writes are exercised.

No emulator authorization or native iOS/Android certification is claimed. The extra America/Los_Angeles Customer render run found two existing Garage protection-history date failures, reproduced on the unchanged exact baseline. That route formats UTC timestamps in device-local time. It is outside this operational-hours patch and remains open, not waived. Studio people/labels caches also still need a separate owner-scope and freshness audit before claiming all app data is consistent. No production deployment certification is made.
